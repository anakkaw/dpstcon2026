import { redirect, notFound } from "next/navigation";
import { db } from "@/server/db";
import {
  submissions,
  user,
  storedFiles,
  decisions,
  presentationAssignments,
  reviewAssignments,
  settings,
  userRoles,
  outgoingEmails,
} from "@/server/db/schema";
import { eq, sql, and, inArray, desc } from "drizzle-orm";
import { SubmissionDetail } from "./submission-detail";
import { getServerAuthContext } from "@/server/auth-helpers";
import { hasTrackRole, hasRole } from "@/lib/permissions";
import { canRevealReviewerIdentity } from "@/server/access-policies";
import {
  getPresentationRubrics,
  type PresentationType,
} from "@/server/presentation-rubrics";

export default async function SubmissionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const authContext = await getServerAuthContext();
  if (!authContext?.user.isActive) redirect("/login");

  const currentUser = authContext.user;
  let isAssignedReviewer = false;
  let reviewerAssignmentId: string | null = null;
  let isTrackHead = false;
  let canManageSubmission = hasRole(currentUser, "ADMIN");

  const submission = await db.query.submissions.findFirst({
    where: eq(submissions.id, id),
    with: {
      author: { columns: { id: true, name: true, email: true, affiliation: true } },
      track: { columns: { id: true, name: true } },
      coAuthors: true,
      reviews: {
        with: { reviewer: { columns: { id: true, name: true } } },
      },
      discussions: {
        with: { author: { columns: { id: true, name: true } } },
      },
    },
  });

  if (!submission) notFound();

  // Check reviewer assignment independently of access chain
  // so PROGRAM_CHAIR who is also a reviewer gets isAssignedReviewer set correctly
  if (hasRole(currentUser, "REVIEWER")) {
    const reviewerAssignment = await db.query.reviewAssignments.findFirst({
      where: and(
        eq(reviewAssignments.submissionId, id),
        eq(reviewAssignments.reviewerId, currentUser.id)
      ),
      columns: { id: true },
    });
    isAssignedReviewer = !!reviewerAssignment;
    reviewerAssignmentId = reviewerAssignment?.id ?? null;
  }

  let hasAccess = hasRole(currentUser, "ADMIN");

  if (!hasAccess && submission.authorId === currentUser.id) {
    hasAccess = true;
  }

  if (!hasAccess && isAssignedReviewer) {
    hasAccess = true;
  }

  if (!hasAccess && hasRole(currentUser, "PROGRAM_CHAIR") && submission.trackId) {
    isTrackHead = hasTrackRole(currentUser, submission.trackId, "PROGRAM_CHAIR");
    hasAccess = isTrackHead;
    canManageSubmission = canManageSubmission || isTrackHead;
  }

  if (!hasAccess) {
    notFound();
  }

  let filteredDiscussions = submission.discussions;
  let filteredReviews = submission.reviews;

  if (
    submission.authorId === currentUser.id &&
    !canRevealReviewerIdentity({
      isAdmin: hasRole(currentUser, "ADMIN"),
      isTrackHead,
      isAssignedReviewer,
      isAuthor: true,
    })
  ) {
    filteredDiscussions = submission.discussions.filter((d) => d.visibility === "AUTHOR_VISIBLE");
    filteredReviews = submission.reviews.map((r) => ({
      ...r,
      reviewer: { id: "", name: "" },
      commentsToChair: null,
    }));
  }

  // Fetch all supplementary data in parallel (was 7 sequential queries)
  const [reviewers, files, assignmentRows, decision, presRows, deadlineRows, lastAdvisorEmailRows] = await Promise.all([
    // Reviewers list (only needed for admin on SUBMITTED/UNDER_REVIEW status)
    canManageSubmission && ["SUBMITTED", "UNDER_REVIEW"].includes(submission.status)
      ? (async () => {
          if (hasRole(currentUser, "ADMIN")) {
            const reviewerRoleRows = await db
              .select({ userId: userRoles.userId })
              .from(userRoles)
              .where(eq(userRoles.role, "REVIEWER"));

            const reviewerIds = Array.from(
              new Set(reviewerRoleRows.map((row) => row.userId))
            );

            if (reviewerIds.length === 0) return [];

            return db
              .select({
                id: user.id,
                name: user.name,
                email: user.email,
                prefixTh: user.prefixTh,
                firstNameTh: user.firstNameTh,
                lastNameTh: user.lastNameTh,
                prefixEn: user.prefixEn,
                firstNameEn: user.firstNameEn,
                lastNameEn: user.lastNameEn,
              })
              .from(user)
              .where(inArray(user.id, reviewerIds));
          }

          if (!submission.trackId) return [];

          const reviewerRoleRows = await db
            .select({ userId: userRoles.userId })
            .from(userRoles)
            .where(
              and(
                eq(userRoles.role, "REVIEWER"),
                eq(userRoles.trackId, submission.trackId)
              )
            );

          const reviewerIds = Array.from(
            new Set(reviewerRoleRows.map((row) => row.userId))
          );

          if (reviewerIds.length === 0) return [];

          return db
            .select({
              id: user.id,
              name: user.name,
              email: user.email,
              prefixTh: user.prefixTh,
              firstNameTh: user.firstNameTh,
              lastNameTh: user.lastNameTh,
              prefixEn: user.prefixEn,
              firstNameEn: user.firstNameEn,
              lastNameEn: user.lastNameEn,
            })
            .from(user)
            .where(inArray(user.id, reviewerIds));
        })()
      : Promise.resolve([]),
    // Uploaded files
    db.select().from(storedFiles).where(eq(storedFiles.submissionId, id)),
    // Review assignment counts
    db.select({ status: reviewAssignments.status }).from(reviewAssignments).where(eq(reviewAssignments.submissionId, id)),
    // Decision
    db.query.decisions.findFirst({ where: eq(decisions.submissionId, id) }),
    // Presentation assignments
    db.select().from(presentationAssignments).where(eq(presentationAssignments.submissionId, id)),
    // Deadlines from settings
    db.select().from(settings).where(
      sql`${settings.key} IN ('submissionDeadline', 'reviewDeadline', 'notificationDate', 'cameraReadyDeadline')`
    ),
    // Last advisor approval email status (for FAILED banner)
    submission.advisorEmail
      ? db
          .select({
            status: outgoingEmails.status,
            sentAt: outgoingEmails.sentAt,
            error: outgoingEmails.error,
            createdAt: outgoingEmails.createdAt,
          })
          .from(outgoingEmails)
          .where(
            and(
              eq(outgoingEmails.to, submission.advisorEmail),
              sql`${outgoingEmails.subject} LIKE '%ขอความอนุเคราะห์รับรองบทความ%'`
            )
          )
          .orderBy(desc(outgoingEmails.createdAt))
          .limit(1)
      : Promise.resolve([] as Array<{ status: string; sentAt: Date | null; error: string | null; createdAt: Date }>),
  ]);

  const presentationTypes = Array.from(
    new Set(presRows.map((presentation) => presentation.type as PresentationType))
  );
  const criteriaByType =
    presentationTypes.length > 0
      ? await getPresentationRubrics(presentationTypes)
      : { ORAL: [], POSTER: [] };

  const reviewCounts = {
    total: assignmentRows.length,
    completed: assignmentRows.filter((r) => r.status === "COMPLETED").length,
  };

  const deadlineMap: Record<string, string> = {};
  for (const row of deadlineRows) {
    if (row.value && typeof row.value === "string") deadlineMap[row.key] = row.value;
  }
  if (!deadlineMap.submissionDeadline) deadlineMap.submissionDeadline = "2026-06-30";
  if (!deadlineMap.cameraReadyDeadline) deadlineMap.cameraReadyDeadline = "2026-09-30";

  return (
    <SubmissionDetail
      submission={{ ...submission, discussions: filteredDiscussions, reviews: filteredReviews }}
      currentUserRoles={currentUser.roles}
      currentUserId={currentUser.id}
      reviewers={reviewers}
      files={files.map((f) => ({
        ...f,
        uploadedAt: f.uploadedAt.toISOString(),
      }))}
      reviewCounts={reviewCounts}
      decision={decision ? {
        outcome: decision.outcome,
        comments: decision.comments,
        conditions: decision.conditions,
        decidedAt: decision.decidedAt.toISOString(),
      } : null}
      presentations={presRows.map((p) => ({
        type: p.type,
        status: p.status,
        paperCode: submission.paperCode,
        scheduledAt: p.scheduledAt?.toISOString() || null,
        room: p.room,
        duration: p.duration,
      }))}
      criteriaByType={criteriaByType}
      deadlines={deadlineMap}
      isAssignedReviewer={isAssignedReviewer}
      reviewerAssignmentId={reviewerAssignmentId}
      lastAdvisorEmail={
        lastAdvisorEmailRows[0]
          ? {
              status: lastAdvisorEmailRows[0].status as "PENDING" | "SENT" | "FAILED",
              sentAt: lastAdvisorEmailRows[0].sentAt?.toISOString() ?? null,
              error: lastAdvisorEmailRows[0].error,
              createdAt: lastAdvisorEmailRows[0].createdAt.toISOString(),
            }
          : null
      }
    />
  );
}
