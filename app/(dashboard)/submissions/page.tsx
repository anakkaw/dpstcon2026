import { redirect } from "next/navigation";
import { desc, eq, sql } from "drizzle-orm";
import { getTrackRoleIds, hasRole } from "@/lib/permissions";
import { getServerAuthContext } from "@/server/auth-helpers";
import { db } from "@/server/db";
import { reviewAssignments, submissions } from "@/server/db/schema";
import { SubmissionsPageClient, type SubmissionData } from "./submissions-page-client";

async function loadInitialSubmissions(
  currentUser: NonNullable<Awaited<ReturnType<typeof getServerAuthContext>>>["user"]
): Promise<SubmissionData[]> {
  if (hasRole(currentUser, "ADMIN")) {
    const results = await db.query.submissions.findMany({
      with: {
        author: { columns: { id: true, name: true, email: true } },
        track: { columns: { id: true, name: true } },
        reviews: { columns: { id: true, recommendation: true, completedAt: true } },
        reviewAssignments: { columns: { id: true, status: true } },
      },
      orderBy: [desc(submissions.createdAt)],
    });

    return results.map((submission) => ({
      ...submission,
      createdAt: submission.createdAt.toISOString(),
      reviews: submission.reviews.map((review) => ({
        ...review,
        completedAt: review.completedAt?.toISOString() || null,
      })),
    }));
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

  if (hasRole(currentUser, "AUTHOR")) {
    roleFetches.push(
      db.select({ id: submissions.id }).from(submissions).where(eq(submissions.authorId, currentUser.id))
        .then((rows) => rows.forEach((submission) => submissionIds.add(submission.id)))
    );
  }

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
      reviewAssignments: { columns: { id: true, status: true } },
    },
    orderBy: [desc(submissions.createdAt)],
  });

  return results.map((submission) => ({
    ...submission,
    createdAt: submission.createdAt.toISOString(),
    reviews: submission.reviews.map((review) => ({
      ...review,
      completedAt: review.completedAt?.toISOString() || null,
    })),
  }));
}

export default async function SubmissionsPage() {
  const authContext = await getServerAuthContext();
  if (!authContext?.user.isActive) redirect("/login");

  const initialSubmissions = await loadInitialSubmissions(authContext.user);

  return <SubmissionsPageClient initialSubmissions={initialSubmissions} />;
}
