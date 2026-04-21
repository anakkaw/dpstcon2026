import { redirect } from "next/navigation";
import { desc, eq, sql } from "drizzle-orm";
import { getTrackRoleIds, hasRole } from "@/lib/permissions";
import { getServerAuthContext } from "@/server/auth-helpers";
import { db } from "@/server/db";
import { reviewAssignments, storedFiles, submissions } from "@/server/db/schema";
import { loadReviewerPool } from "@/server/reviewer-pool";
import { SubmissionsPageClient, type SubmissionData } from "./submissions-page-client";

/**
 * For each submission, fetch the latest MANUSCRIPT file so the workbench can
 * offer a 1-click PDF preview. Returns a map of submissionId → { id, originalName, mimeType }.
 */
async function loadLatestManuscripts(submissionIds: string[]) {
  if (submissionIds.length === 0) return new Map<string, { id: string; originalName: string; mimeType: string }>();
  const rows = await db
    .select({
      id: storedFiles.id,
      submissionId: storedFiles.submissionId,
      originalName: storedFiles.originalName,
      mimeType: storedFiles.mimeType,
      uploadedAt: storedFiles.uploadedAt,
    })
    .from(storedFiles)
    .where(
      sql`${storedFiles.kind} = 'MANUSCRIPT' AND ${storedFiles.submissionId} IN ${submissionIds}`
    );
  // Keep only the newest MANUSCRIPT per submission
  const map = new Map<string, { id: string; originalName: string; mimeType: string; uploadedAt: Date }>();
  for (const row of rows) {
    if (!row.submissionId) continue;
    const existing = map.get(row.submissionId);
    if (!existing || row.uploadedAt > existing.uploadedAt) {
      map.set(row.submissionId, {
        id: row.id,
        originalName: row.originalName,
        mimeType: row.mimeType,
        uploadedAt: row.uploadedAt,
      });
    }
  }
  return new Map(
    Array.from(map.entries()).map(([subId, f]) => [
      subId,
      { id: f.id, originalName: f.originalName, mimeType: f.mimeType },
    ])
  );
}

async function loadInitialSubmissions(
  currentUser: NonNullable<Awaited<ReturnType<typeof getServerAuthContext>>>["user"]
): Promise<SubmissionData[]> {
  // Always fetch the full reviewer-aware assignment shape — we'll strip it
  // downstream for pure authors. This avoids branching query return types.
  const assignmentWith = {
    columns: {
      id: true,
      status: true,
      assignedAt: true,
      dueDate: true,
      reviewerId: true,
    } as const,
    with: {
      reviewer: {
        columns: {
          id: true,
          name: true,
          affiliation: true,
          prefixTh: true,
          firstNameTh: true,
          lastNameTh: true,
        },
      },
    },
  };

  type RawAssignment = {
    id: string;
    status: string;
    assignedAt: Date;
    dueDate: Date | null;
    reviewer: {
      id: string;
      name: string;
      affiliation: string | null;
      prefixTh: string | null;
      firstNameTh: string | null;
      lastNameTh: string | null;
    } | null;
  };

  function serializeAssignment(a: RawAssignment) {
    return {
      id: a.id,
      status: a.status,
      assignedAt: a.assignedAt.toISOString(),
      dueDate: a.dueDate ? a.dueDate.toISOString() : null,
      reviewer: a.reviewer
        ? {
            id: a.reviewer.id,
            name: a.reviewer.name,
            affiliation: a.reviewer.affiliation,
            prefixTh: a.reviewer.prefixTh,
            firstNameTh: a.reviewer.firstNameTh,
            lastNameTh: a.reviewer.lastNameTh,
          }
        : null,
    };
  }

  if (hasRole(currentUser, "ADMIN")) {
    const results = await db.query.submissions.findMany({
      with: {
        author: { columns: { id: true, name: true, email: true } },
        track: { columns: { id: true, name: true } },
        reviews: { columns: { id: true, recommendation: true, completedAt: true } },
        reviewAssignments: assignmentWith,
      },
      orderBy: [desc(submissions.createdAt)],
    });

    const manuscripts = await loadLatestManuscripts(results.map((s) => s.id));

    return results.map((submission) => {
      const manuscript = manuscripts.get(submission.id) ?? null;
      return {
        ...submission,
        createdAt: submission.createdAt.toISOString(),
        submittedAt: submission.submittedAt?.toISOString() || null,
        advisorApprovalAt: submission.advisorApprovalAt?.toISOString() || null,
        manuscriptFile: manuscript,
        reviews: submission.reviews.map((review) => ({
          ...review,
          completedAt: review.completedAt?.toISOString() || null,
        })),
        reviewAssignments: submission.reviewAssignments.map((a) =>
          serializeAssignment(a as unknown as RawAssignment)
        ),
      };
    });
  }

  const submissionIds = new Set<string>();
  const roleFetches: Promise<void>[] = [];

  if (hasRole(currentUser, "PROGRAM_CHAIR")) {
    const trackIds = getTrackRoleIds(currentUser, "PROGRAM_CHAIR");
    roleFetches.push(
      Promise.resolve().then(async () => {
        if (trackIds.length > 0) {
          const trackSubs = await db.select({ id: submissions.id }).from(submissions).where(sql`${submissions.trackId} IN ${trackIds}`);
          trackSubs.forEach((submission) => submissionIds.add(submission.id));
        }
      })
    );
  }

  if (hasRole(currentUser, "REVIEWER")) {
    roleFetches.push(
      db.select({ submissionId: reviewAssignments.submissionId }).from(reviewAssignments).where(eq(reviewAssignments.reviewerId, currentUser.id))
        .then((rows) => rows.forEach((assignment) => submissionIds.add(assignment.submissionId)))
    );
  }

  roleFetches.push(
    db.select({ id: submissions.id }).from(submissions).where(eq(submissions.authorId, currentUser.id))
      .then((rows) => rows.forEach((submission) => submissionIds.add(submission.id)))
  );

  await Promise.all(roleFetches);

  if (submissionIds.size === 0) {
    return [];
  }

  const ids = Array.from(submissionIds);
  const results = await db.query.submissions.findMany({
    where: sql`${submissions.id} IN ${ids}`,
    with: {
      author: { columns: { id: true, name: true, email: true } },
      track: { columns: { id: true, name: true } },
      reviews: { columns: { id: true, recommendation: true, completedAt: true } },
      reviewAssignments: assignmentWith,
    },
    orderBy: [desc(submissions.createdAt)],
  });

  // Gate reviewer identity from pure authors — they should only see their own
  // paper's reviewers if they're also an admin or chair (handled above).
  const isAuthorOnly =
    !hasRole(currentUser, "ADMIN", "PROGRAM_CHAIR", "REVIEWER");

  const manuscripts = await loadLatestManuscripts(results.map((s) => s.id));

  return results.map((submission) => {
    const manuscript = manuscripts.get(submission.id) ?? null;
    return {
      ...submission,
      createdAt: submission.createdAt.toISOString(),
      submittedAt: submission.submittedAt?.toISOString() || null,
      advisorApprovalAt: submission.advisorApprovalAt?.toISOString() || null,
      manuscriptFile: manuscript,
      reviews: submission.reviews.map((review) => ({
        ...review,
        completedAt: review.completedAt?.toISOString() || null,
      })),
      reviewAssignments: submission.reviewAssignments.map((a) => {
        const serialized = serializeAssignment(a as unknown as RawAssignment);
        if (isAuthorOnly) {
          // strip reviewer identity but keep the counts so progress bars still work
          return { id: serialized.id, status: serialized.status };
        }
        return serialized;
      }),
    };
  });
}

export default async function SubmissionsPage() {
  const authContext = await getServerAuthContext();
  if (!authContext?.user.isActive) redirect("/login");

  const [initialSubmissions, reviewerPool] = await Promise.all([
    loadInitialSubmissions(authContext.user),
    loadReviewerPool(authContext.user),
  ]);

  return (
    <SubmissionsPageClient
      initialSubmissions={initialSubmissions}
      reviewerPool={reviewerPool}
    />
  );
}
