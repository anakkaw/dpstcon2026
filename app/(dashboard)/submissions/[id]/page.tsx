import { redirect, notFound } from "next/navigation";
import { db } from "@/server/db";
import {
  submissions,
  user,
  storedFiles,
  decisions,
  decisionHistory,
  submissionResubmissions,
  presentationAssignments,
  posterSlotJudges,
  reviewAssignments,
  settings,
  userRoles,
  outgoingEmails,
} from "@/server/db/schema";
import { eq, sql, and, inArray, desc, asc, count } from "drizzle-orm";
import { SubmissionDetail } from "./submission-detail";
import { getServerAuthContext } from "@/server/auth-helpers";
import { hasTrackRole, hasRole } from "@/lib/permissions";
import {
  PUBLISHED_POSTER_SLOT_STATUSES,
  isPublishedPresentationStatus,
} from "@/lib/presentation-status";
import { normalizeSubmissionStatus } from "@/lib/submission-status";
import {
  getPosterScheduleSortAt,
  sortPosterScheduleSlots,
} from "@/lib/poster-schedule";
import { canRevealReviewerIdentity } from "@/server/access-policies";
import {
  getPresentationRubrics,
  type PresentationType,
} from "@/server/presentation-rubrics";
import { canMakeSubmissionDecision } from "@/server/submission-workflow";

export default async function SubmissionDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const submissionListHref = getSubmissionListHref(resolvedSearchParams.returnTo);
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
        with: {
          reviewer: {
            columns: {
              id: true,
              name: true,
              prefixTh: true,
              firstNameTh: true,
              lastNameTh: true,
              prefixEn: true,
              firstNameEn: true,
              lastNameEn: true,
            },
          },
        },
      },
      discussions: {
        with: { author: { columns: { id: true, name: true } } },
      },
    },
  });

  if (!submission) notFound();
  const submissionStatus = normalizeSubmissionStatus(submission.status);

  // Check reviewer assignment independently of access chain
  // so PROGRAM_CHAIR who is also a reviewer gets isAssignedReviewer set correctly
  let reviewerAssignmentStatus: string | null = null;
  let reviewerAssignmentAssignedAt: string | null = null;
  if (hasRole(currentUser, "REVIEWER")) {
    const reviewerAssignment = await db.query.reviewAssignments.findFirst({
      where: and(
        eq(reviewAssignments.submissionId, id),
        eq(reviewAssignments.reviewerId, currentUser.id)
      ),
      columns: { id: true, status: true, assignedAt: true },
    });
    isAssignedReviewer = !!reviewerAssignment && reviewerAssignment.status !== "DECLINED";
    reviewerAssignmentId = reviewerAssignment?.id ?? null;
    reviewerAssignmentStatus = reviewerAssignment?.status ?? null;
    reviewerAssignmentAssignedAt = reviewerAssignment?.assignedAt?.toISOString() ?? null;
  }

  let hasAccess = hasRole(currentUser, "ADMIN");

  if (!hasAccess && submission.authorId === currentUser.id) {
    hasAccess = true;
  }

  if (!hasAccess && isAssignedReviewer) {
    hasAccess = true;
  }

  if (hasRole(currentUser, "PROGRAM_CHAIR") && submission.trackId) {
    isTrackHead = hasTrackRole(currentUser, submission.trackId, "PROGRAM_CHAIR");
    canManageSubmission = canManageSubmission || isTrackHead;
  }

  if (!hasAccess && isTrackHead) {
    hasAccess = isTrackHead;
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
    // Redact reviewer identity but keep a stable anonymous id per reviewer so
    // the author still sees "Reviewer 1", "Reviewer 2" consistently across
    // rounds. A single empty id would collapse every reviewer into one.
    const anonIdByRealId = new Map<string, string>();
    filteredReviews = submission.reviews.map((r) => {
      let anonId = anonIdByRealId.get(r.reviewer.id);
      if (!anonId) {
        anonId = `anon-${anonIdByRealId.size + 1}`;
        anonIdByRealId.set(r.reviewer.id, anonId);
      }
      return {
        ...r,
        reviewer: {
          id: anonId,
          name: "",
          prefixTh: null,
          firstNameTh: null,
          lastNameTh: null,
          prefixEn: null,
          firstNameEn: null,
          lastNameEn: null,
        },
        commentsToChair: null,
      };
    });
  }

  // Fetch all supplementary data in parallel
  const [
    reviewers,
    files,
    assignmentRows,
    decision,
    presRows,
    deadlineRows,
    lastAdvisorEmailRows,
    decisionHistoryRows,
    resubmissionRows,
  ] = await Promise.all([
    // Reviewers list (only needed for admin on SUBMITTED/UNDER_REVIEW status)
    canManageSubmission && ["SUBMITTED", "UNDER_REVIEW"].includes(submissionStatus)
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
    // Uploaded files (with uploader info for review attachments)
    db
      .select({
        id: storedFiles.id,
        originalName: storedFiles.originalName,
        mimeType: storedFiles.mimeType,
        size: storedFiles.size,
        kind: storedFiles.kind,
        uploadedAt: storedFiles.uploadedAt,
        uploadedById: storedFiles.uploadedById,
        uploaderName: user.name,
      })
      .from(storedFiles)
      .leftJoin(user, eq(storedFiles.uploadedById, user.id))
      .where(eq(storedFiles.submissionId, id)),
    // Review assignment counts + assigned reviewer ids
    db
      .select({
        status: reviewAssignments.status,
        reviewerId: reviewAssignments.reviewerId,
      })
      .from(reviewAssignments)
      .where(eq(reviewAssignments.submissionId, id)),
    // Decision
    db.query.decisions.findFirst({
      where: eq(decisions.submissionId, id),
      orderBy: [desc(decisions.decidedAt)],
    }),
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
    // Decision history (append-only audit log of every admin decision)
    db
      .select({
        outcome: decisionHistory.outcome,
        comments: decisionHistory.comments,
        conditions: decisionHistory.conditions,
        round: decisionHistory.round,
        decidedAt: decisionHistory.decidedAt,
      })
      .from(decisionHistory)
      .where(eq(decisionHistory.submissionId, id))
      .orderBy(asc(decisionHistory.decidedAt)),
    // Resubmission history (one row per author resubmit)
    db
      .select({
        round: submissionResubmissions.round,
        resubmittedAt: submissionResubmissions.resubmittedAt,
      })
      .from(submissionResubmissions)
      .where(eq(submissionResubmissions.submissionId, id))
      .orderBy(asc(submissionResubmissions.round)),
  ]);

  const visiblePresentationRows = canManageSubmission
    ? presRows
    : presRows.filter((presentation) =>
        isPublishedPresentationStatus(presentation.status)
      );
  const rawPosterSlots = visiblePresentationRows.some((presentation) => presentation.type === "POSTER")
    ? await db
        .select({
          id: posterSlotJudges.id,
          startsAt: posterSlotJudges.startsAt,
          endsAt: posterSlotJudges.endsAt,
        })
        .from(posterSlotJudges)
        .where(
          and(
            eq(posterSlotJudges.submissionId, id),
            canManageSubmission
              ? undefined
              : inArray(posterSlotJudges.status, PUBLISHED_POSTER_SLOT_STATUSES)
          )
        )
        .orderBy(asc(posterSlotJudges.startsAt), asc(posterSlotJudges.endsAt))
    : [];
  const posterSlots = sortPosterScheduleSlots(rawPosterSlots).map((slot) => ({
    id: slot.id,
    startsAt: slot.startsAt.toISOString(),
    endsAt: slot.endsAt.toISOString(),
  }));

  const presentationTypes = Array.from(
    new Set(visiblePresentationRows.map((presentation) => presentation.type as PresentationType))
  );
  const criteriaByType =
    presentationTypes.length > 0
      ? await getPresentationRubrics(presentationTypes)
      : { ORAL: [], POSTER: [] };

  const reviewCounts = {
    total: assignmentRows.length,
    completed: assignmentRows.filter((r) => r.status === "COMPLETED").length,
  };
  const assignedReviewerIds = assignmentRows
    .filter((r) => r.status !== "DECLINED")
    .map((r) => r.reviewerId);
  const isRevisionResubmission =
    decision?.outcome === "CONDITIONAL_ACCEPT" &&
    ["SUBMITTED", "UNDER_REVIEW"].includes(submissionStatus);
  const completedReviewHistory = submission.reviews.filter((review) => review.completedAt).length;

  // Fetch workload (pending/active/completed counts) + affiliation for the reviewer dropdown
  const reviewerIdsForLoad = reviewers.map((r) => r.id);
  let reviewersWithLoad: Array<typeof reviewers[number] & {
    affiliation?: string | null;
    pendingLoad?: number;
    activeLoad?: number;
    completedLoad?: number;
  }> = reviewers;
  if (reviewerIdsForLoad.length > 0) {
    const [loadRows, affiliationRows] = await Promise.all([
      db
        .select({
          reviewerId: reviewAssignments.reviewerId,
          status: reviewAssignments.status,
          total: count(),
        })
        .from(reviewAssignments)
        .where(inArray(reviewAssignments.reviewerId, reviewerIdsForLoad))
        .groupBy(reviewAssignments.reviewerId, reviewAssignments.status),
      db
        .select({ id: user.id, affiliation: user.affiliation })
        .from(user)
        .where(inArray(user.id, reviewerIdsForLoad)),
    ]);

    const loadMap = new Map<string, { pending: number; active: number; completed: number }>();
    for (const row of loadRows) {
      const entry = loadMap.get(row.reviewerId) || { pending: 0, active: 0, completed: 0 };
      if (row.status === "PENDING") {
        entry.pending += Number(row.total);
      } else if (row.status === "ACCEPTED") {
        entry.active += Number(row.total);
      } else if (row.status === "COMPLETED") {
        entry.completed += Number(row.total);
      }
      loadMap.set(row.reviewerId, entry);
    }
    const affiliationMap = new Map(affiliationRows.map((a) => [a.id, a.affiliation]));
    reviewersWithLoad = reviewers.map((r) => {
      const entry = loadMap.get(r.id);
      return {
        ...r,
        affiliation: affiliationMap.get(r.id) ?? null,
        pendingLoad: entry?.pending ?? 0,
        activeLoad: entry?.active ?? 0,
        completedLoad: entry?.completed ?? 0,
      };
    });
  }

  const deadlineMap: Record<string, string> = {};
  for (const row of deadlineRows) {
    if (row.value && typeof row.value === "string") deadlineMap[row.key] = row.value;
  }
  if (!deadlineMap.submissionDeadline) deadlineMap.submissionDeadline = "2026-06-30";
  if (!deadlineMap.cameraReadyDeadline) deadlineMap.cameraReadyDeadline = "2026-09-30";
  const visibleDecision =
    decision?.outcome === "CONDITIONAL_ACCEPT" &&
    ["SUBMITTED", "UNDER_REVIEW"].includes(submissionStatus)
      ? null
      : decision;
  const canMakeDecision = canMakeSubmissionDecision({
    status: submissionStatus,
    currentCompletedReviews: reviewCounts.completed,
    completedReviewHistory,
    hasDecision: !!visibleDecision,
    isRevisionResubmission,
  });

  return (
    <SubmissionDetail
      submission={{
        ...submission,
        status: submissionStatus,
        discussions: filteredDiscussions,
        reviews: filteredReviews,
      }}
      currentUserRoles={currentUser.roles}
      currentUserId={currentUser.id}
      canManageSubmission={canManageSubmission}
      reviewers={reviewersWithLoad}
      files={files
        .filter((f) => {
          if (f.kind !== "REVIEW_ATTACHMENT") return true;
          // Review attachments are hidden from authors, and reviewers see only their own
          if (canManageSubmission) return true;
          if (isAssignedReviewer && f.uploadedById === currentUser.id) return true;
          return false;
        })
        .map((f) => ({
          ...f,
          uploadedAt: f.uploadedAt.toISOString(),
        }))}
      reviewCounts={reviewCounts}
      canMakeDecision={canMakeDecision}
      decision={visibleDecision ? {
        outcome: visibleDecision.outcome,
        comments: visibleDecision.comments,
        conditions: visibleDecision.conditions,
        decidedAt: visibleDecision.decidedAt.toISOString(),
      } : null}
      decisionHistory={decisionHistoryRows.map((row) => ({
        outcome: row.outcome,
        comments: row.comments,
        conditions: row.conditions,
        round: row.round,
        decidedAt: row.decidedAt.toISOString(),
      }))}
      resubmissions={resubmissionRows.map((row) => ({
        round: row.round,
        resubmittedAt: row.resubmittedAt.toISOString(),
      }))}
      presentations={visiblePresentationRows.map((p) => ({
        type: p.type,
        status: p.status,
        paperCode: submission.paperCode,
        scheduledAt:
          p.type === "POSTER"
            ? getPosterScheduleSortAt(posterSlots, p.scheduledAt)?.toISOString() || null
            : p.scheduledAt?.toISOString() || null,
        room: p.room,
        duration: p.type === "POSTER" && posterSlots.length > 0 ? null : p.duration,
        posterSlots: p.type === "POSTER" ? posterSlots : [],
      }))}
      criteriaByType={criteriaByType}
      deadlines={deadlineMap}
      isAssignedReviewer={isAssignedReviewer}
      reviewerAssignmentId={reviewerAssignmentId}
      reviewerAssignmentStatus={reviewerAssignmentStatus}
      reviewerAssignmentAssignedAt={reviewerAssignmentAssignedAt}
      assignedReviewerIds={assignedReviewerIds}
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
      submissionListHref={submissionListHref}
    />
  );
}

function getSubmissionListHref(value: string | string[] | undefined) {
  const href = Array.isArray(value) ? value[0] : value;
  if (
    href === "/submissions" ||
    href?.startsWith("/submissions?") ||
    href === "/reviews" ||
    href?.startsWith("/reviews?")
  ) {
    return href;
  }
  return "/submissions";
}
