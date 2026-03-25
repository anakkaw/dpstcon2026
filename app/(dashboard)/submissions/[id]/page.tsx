import { redirect, notFound } from "next/navigation";
import { db } from "@/server/db";
import {
  submissions,
  user,
  storedFiles,
  decisions,
  presentationAssignments,
  presentationCriteria,
  reviewAssignments,
  settings,
  tracks,
} from "@/server/db/schema";
import { eq, sql, and } from "drizzle-orm";
import { SubmissionDetail } from "./submission-detail";
import { getServerAuthContext } from "@/server/auth-helpers";
import { hasRole } from "@/lib/permissions";

export default async function SubmissionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const authContext = await getServerAuthContext();
  if (!authContext?.user.isActive) redirect("/login");

  const currentUser = authContext.user;
  const canManageSubmission = hasRole(currentUser, "ADMIN", "PROGRAM_CHAIR");
  const isAuthorOnly = currentUser.role === "AUTHOR";

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

  let hasAccess = hasRole(currentUser, "ADMIN");

  if (!hasAccess && submission.authorId === currentUser.id) {
    hasAccess = true;
  }

  if (!hasAccess && hasRole(currentUser, "REVIEWER")) {
    const assignment = await db.query.reviewAssignments.findFirst({
      where: and(
        eq(reviewAssignments.submissionId, id),
        eq(reviewAssignments.reviewerId, currentUser.id)
      ),
      columns: { id: true },
    });
    hasAccess = !!assignment;
  }

  if (!hasAccess && hasRole(currentUser, "PROGRAM_CHAIR") && submission.trackId) {
    const track = await db.query.tracks.findFirst({
      where: eq(tracks.id, submission.trackId),
      columns: { headUserId: true },
    });
    hasAccess = track?.headUserId === currentUser.id;
  }

  if (!hasAccess) {
    notFound();
  }

  let filteredDiscussions = submission.discussions;
  let filteredReviews = submission.reviews;

  if (isAuthorOnly) {
    filteredDiscussions = submission.discussions.filter((d) => d.visibility === "AUTHOR_VISIBLE");
    filteredReviews = submission.reviews.map((r) => ({
      ...r,
      reviewer: { id: "", name: "" },
      commentsToChair: null,
    }));
  }

  // Fetch all supplementary data in parallel (was 7 sequential queries)
  const [reviewers, files, assignmentRows, decision, presRows, criteria, deadlineRows] = await Promise.all([
    // Reviewers list (admin only)
    canManageSubmission
      ? db.select({ id: user.id, name: user.name, email: user.email, prefixTh: user.prefixTh, firstNameTh: user.firstNameTh, lastNameTh: user.lastNameTh, prefixEn: user.prefixEn, firstNameEn: user.firstNameEn, lastNameEn: user.lastNameEn }).from(user).where(eq(user.role, "REVIEWER"))
      : Promise.resolve([]),
    // Uploaded files
    db.select().from(storedFiles).where(eq(storedFiles.submissionId, id)),
    // Review assignment counts
    db.select({ status: reviewAssignments.status }).from(reviewAssignments).where(eq(reviewAssignments.submissionId, id)),
    // Decision
    db.query.decisions.findFirst({ where: eq(decisions.submissionId, id) }),
    // Presentation assignments
    db.select().from(presentationAssignments).where(eq(presentationAssignments.submissionId, id)),
    // Presentation criteria
    db.select().from(presentationCriteria),
    // Deadlines from settings
    db.select().from(settings).where(
      sql`${settings.key} IN ('submissionDeadline', 'reviewDeadline', 'notificationDate', 'cameraReadyDeadline')`
    ),
  ]);

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
      currentUserRole={currentUser.role}
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
        scheduledAt: p.scheduledAt?.toISOString() || null,
        room: p.room,
        duration: p.duration,
      }))}
      criteria={criteria.map((c) => ({
        id: c.id,
        name: c.name,
        description: c.description,
        maxScore: c.maxScore,
        weight: c.weight,
      }))}
      deadlines={deadlineMap}
    />
  );
}
