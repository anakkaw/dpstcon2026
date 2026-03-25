import { auth } from "@/server/auth";
import { headers } from "next/headers";
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
import { eq, and, sql } from "drizzle-orm";
import { SubmissionDetail } from "./submission-detail";

export default async function SubmissionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  const currentUser = session.user as { id: string; role: string };
  const isAdmin = ["ADMIN", "PROGRAM_CHAIR"].includes(currentUser.role);
  const isAuthor = currentUser.role === "AUTHOR";

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

  if (isAuthor && submission.authorId !== currentUser.id) {
    notFound();
  }

  // PROGRAM_CHAIR can only access submissions in their tracks
  if (currentUser.role === "PROGRAM_CHAIR" && submission.trackId) {
    const track = await db.query.tracks.findFirst({
      where: eq(tracks.id, submission.trackId),
      columns: { headUserId: true },
    });
    if (!track || track.headUserId !== currentUser.id) notFound();
  } else if (currentUser.role === "PROGRAM_CHAIR" && !submission.trackId) {
    notFound();
  }

  let filteredDiscussions = submission.discussions;
  let filteredReviews = submission.reviews;

  if (isAuthor) {
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
    isAdmin
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
