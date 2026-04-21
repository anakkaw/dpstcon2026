import { redirect } from "next/navigation";
import { and, count, eq, inArray } from "drizzle-orm";
import { getTrackRoleIds, hasRole } from "@/lib/permissions";
import { getServerAuthContext } from "@/server/auth-helpers";
import { db } from "@/server/db";
import {
  decisions,
  notifications,
  posterSlotJudges,
  presentationAssignments,
  presentationCommitteeAssignments,
  presentationEvaluations,
  reviewAssignments,
  reviews,
  settings,
  storedFiles,
  submissions,
  tracks,
  userRoles,
} from "@/server/db/schema";
import { DashboardClient } from "./dashboard-client";

type DashboardStats = Record<string, unknown>;

async function loadAuthorStats(userId: string): Promise<DashboardStats> {
  const [mySubmissions, deadlineRows, [unreadCount]] = await Promise.all([
    db.query.submissions.findMany({
      where: eq(submissions.authorId, userId),
      columns: {
        id: true,
        paperCode: true,
        title: true,
        status: true,
        createdAt: true,
        submittedAt: true,
      },
      with: {
        track: { columns: { id: true, name: true } },
        reviewAssignments: { columns: { id: true, status: true } },
      },
    }),
    db
      .select()
      .from(settings)
      .where(
        inArray(settings.key, [
          "submissionDeadline",
          "reviewDeadline",
          "notificationDate",
          "cameraReadyDeadline",
        ])
      ),
    db
      .select({ count: count() })
      .from(notifications)
      .where(and(eq(notifications.userId, userId), eq(notifications.isRead, false))),
  ]);

  const subIds = mySubmissions.map((submission) => submission.id);
  const [myDecisions, myPresentations] =
    subIds.length > 0
      ? await Promise.all([
          db
            .select({
              submissionId: decisions.submissionId,
              outcome: decisions.outcome,
              comments: decisions.comments,
              conditions: decisions.conditions,
              decidedAt: decisions.decidedAt,
            })
            .from(decisions)
            .where(inArray(decisions.submissionId, subIds)),
          db
            .select({
              submissionId: presentationAssignments.submissionId,
              type: presentationAssignments.type,
              status: presentationAssignments.status,
              scheduledAt: presentationAssignments.scheduledAt,
              room: presentationAssignments.room,
              duration: presentationAssignments.duration,
              paperCode: submissions.paperCode,
            })
            .from(presentationAssignments)
            .innerJoin(submissions, eq(presentationAssignments.submissionId, submissions.id))
            .where(inArray(presentationAssignments.submissionId, subIds)),
        ])
      : [[], []];

  const deadlines: Record<string, string> = {};
  for (const row of deadlineRows) {
    if (typeof row.value === "string") {
      deadlines[row.key] = row.value;
    }
  }

  if (!deadlines.submissionDeadline) deadlines.submissionDeadline = "2026-06-30";
  if (!deadlines.reviewDeadline) deadlines.reviewDeadline = "2026-08-15";
  if (!deadlines.notificationDate) deadlines.notificationDate = "2026-08-31";
  if (!deadlines.cameraReadyDeadline) deadlines.cameraReadyDeadline = "2026-09-30";

  const byStatus: Record<string, number> = {};
  for (const submission of mySubmissions) {
    byStatus[submission.status] = (byStatus[submission.status] || 0) + 1;
  }

  // Batch check which submissions have a manuscript file
  const allSubIds = mySubmissions.map((s) => s.id);
  const filesWithManuscript = allSubIds.length > 0
    ? await db
        .select({ submissionId: storedFiles.submissionId })
        .from(storedFiles)
        .where(and(inArray(storedFiles.submissionId, allSubIds), eq(storedFiles.kind, "MANUSCRIPT")))
    : [];
  const hasManuscriptSet = new Set(filesWithManuscript.map((f) => f.submissionId));

  return {
    totalSubmissions: mySubmissions.length,
    byStatus,
    submissions: mySubmissions.map((submission) => ({
      id: submission.id,
      paperCode: submission.paperCode,
      title: submission.title,
      status: submission.status,
      hasFile: hasManuscriptSet.has(submission.id),
      trackName: submission.track?.name || null,
      reviewTotal: submission.reviewAssignments.length,
      reviewCompleted: submission.reviewAssignments.filter(
        (assignment) => assignment.status === "COMPLETED"
      ).length,
    })),
    decisions: myDecisions.map((decision) => ({
      ...decision,
      decidedAt: decision.decidedAt.toISOString(),
    })),
    presentations: myPresentations.map((presentation) => ({
      ...presentation,
      scheduledAt: presentation.scheduledAt?.toISOString() || null,
    })),
    deadlines,
    unreadNotifications: Number(unreadCount?.count || 0),
  };
}

async function loadReviewerStats(userId: string): Promise<DashboardStats> {
  const myAssignments = await db
    .select({ status: reviewAssignments.status, count: count() })
    .from(reviewAssignments)
    .where(eq(reviewAssignments.reviewerId, userId))
    .groupBy(reviewAssignments.status);

  return {
    totalAssignments: myAssignments.reduce((sum, row) => sum + Number(row.count), 0),
    completed: Number(myAssignments.find((row) => row.status === "COMPLETED")?.count || 0),
    pending: Number(
      myAssignments
        .filter((row) => ["PENDING", "ACCEPTED"].includes(row.status))
        .reduce((sum, row) => sum + Number(row.count), 0)
    ),
  };
}

async function loadManagerStats(
  currentUser: NonNullable<Awaited<ReturnType<typeof getServerAuthContext>>>["user"]
): Promise<DashboardStats> {
  let scopeTrackIds: string[] | null = null;

  if (!hasRole(currentUser, "ADMIN")) {
    const chairedTrackIds = getTrackRoleIds(currentUser, "PROGRAM_CHAIR");
    scopeTrackIds = Array.from(new Set(chairedTrackIds));

    if (scopeTrackIds.length === 0) {
      return {
        totalSubmissions: 0,
        totalReviewers: 0,
        totalReviews: 0,
        submissionsByStatus: {},
        submissionsByTrack: [],
      };
    }
  }

  const [[subCount], statusBreakdown, [revCount], [reviewerCount], trackBreakdown] =
    await Promise.all([
      db
        .select({ total: count() })
        .from(submissions)
        .where(scopeTrackIds ? inArray(submissions.trackId, scopeTrackIds) : undefined),
      db
        .select({ status: submissions.status, count: count() })
        .from(submissions)
        .where(scopeTrackIds ? inArray(submissions.trackId, scopeTrackIds) : undefined)
        .groupBy(submissions.status),
      db
        .select({ total: count() })
        .from(reviews)
        .innerJoin(submissions, eq(reviews.submissionId, submissions.id))
        .where(scopeTrackIds ? inArray(submissions.trackId, scopeTrackIds) : undefined),
      db
        .select({ total: count() })
        .from(userRoles)
        .where(
          scopeTrackIds
            ? and(eq(userRoles.role, "REVIEWER"), inArray(userRoles.trackId, scopeTrackIds))
            : eq(userRoles.role, "REVIEWER")
        ),
      db
        .select({
          trackId: submissions.trackId,
          trackName: tracks.name,
          count: count(),
        })
        .from(submissions)
        .leftJoin(tracks, eq(submissions.trackId, tracks.id))
        .where(scopeTrackIds ? inArray(submissions.trackId, scopeTrackIds) : undefined)
        .groupBy(submissions.trackId, tracks.name),
    ]);

  return {
    totalSubmissions: Number(subCount?.total || 0),
    totalReviewers: Number(reviewerCount?.total || 0),
    totalReviews: Number(revCount?.total || 0),
    submissionsByStatus: Object.fromEntries(
      statusBreakdown.map((row) => [row.status, Number(row.count)])
    ),
    submissionsByTrack: trackBreakdown.map((row) => ({
      name: row.trackName || "ไม่ระบุสาขา",
      count: Number(row.count),
    })),
  };
}

async function loadCommitteeStats(userId: string): Promise<DashboardStats> {
  const [committeeRows, posterSlotRows] = await Promise.all([
    db
      .select({
        presentationId: presentationCommitteeAssignments.presentationId,
        type: presentationAssignments.type,
        scheduledAt: presentationAssignments.scheduledAt,
      })
      .from(presentationCommitteeAssignments)
      .innerJoin(
        presentationAssignments,
        eq(presentationCommitteeAssignments.presentationId, presentationAssignments.id)
      )
      .where(eq(presentationCommitteeAssignments.judgeId, userId)),
    db
      .select({
        presentationId: presentationAssignments.id,
        type: presentationAssignments.type,
        scheduledAt: presentationAssignments.scheduledAt,
      })
      .from(posterSlotJudges)
      .innerJoin(
        presentationAssignments,
        and(
          eq(posterSlotJudges.submissionId, presentationAssignments.submissionId),
          eq(presentationAssignments.type, "POSTER")
        )
      )
      .where(eq(posterSlotJudges.judgeId, userId)),
  ]);

  const assignmentMap = new Map<
    string,
    { type: string; scheduledAt: Date | null }
  >();
  for (const row of committeeRows) {
    assignmentMap.set(row.presentationId, {
      type: row.type,
      scheduledAt: row.scheduledAt,
    });
  }
  for (const row of posterSlotRows) {
    if (!assignmentMap.has(row.presentationId)) {
      assignmentMap.set(row.presentationId, {
        type: row.type,
        scheduledAt: row.scheduledAt,
      });
    }
  }

  const presentationIds = Array.from(assignmentMap.keys());
  const evaluatedIds = new Set<string>();
  if (presentationIds.length > 0) {
    const evaluations = await db
      .select({ presentationId: presentationEvaluations.presentationId })
      .from(presentationEvaluations)
      .where(
        and(
          eq(presentationEvaluations.judgeId, userId),
          inArray(presentationEvaluations.presentationId, presentationIds)
        )
      );
    for (const ev of evaluations) evaluatedIds.add(ev.presentationId);
  }

  let oralCount = 0;
  let posterCount = 0;
  let scheduledCount = 0;
  let pendingCount = 0;
  let completedCount = 0;
  const now = Date.now();

  for (const [pid, info] of assignmentMap.entries()) {
    if (info.type === "ORAL") oralCount++;
    else if (info.type === "POSTER") posterCount++;
    if (info.scheduledAt && info.scheduledAt.getTime() > now) scheduledCount++;
    if (evaluatedIds.has(pid)) completedCount++;
    else pendingCount++;
  }

  return {
    oralCount,
    posterCount,
    scheduledCount,
    pendingCount,
    completedCount,
  };
}

export default async function DashboardPage() {
  const authContext = await getServerAuthContext();
  if (!authContext?.user.isActive) redirect("/login");

  const currentUser = authContext.user as typeof authContext.user & {
    prefixTh?: string | null;
    firstNameTh?: string | null;
    lastNameTh?: string | null;
  };

  const statsByRole: Record<string, DashboardStats> = {};
  const loaders: Promise<void>[] = [];

  loaders.push(
    loadAuthorStats(currentUser.id).then((stats) => {
      statsByRole.AUTHOR = stats;
    })
  );

  if (hasRole(currentUser, "REVIEWER")) {
    loaders.push(
      loadReviewerStats(currentUser.id).then((stats) => {
        statsByRole.REVIEWER = stats;
      })
    );
  }

  if (hasRole(currentUser, "ADMIN", "PROGRAM_CHAIR")) {
    loaders.push(
      loadManagerStats(currentUser).then((stats) => {
        statsByRole.MANAGER = stats;
      })
    );
  }

  if (hasRole(currentUser, "COMMITTEE")) {
    loaders.push(
      loadCommitteeStats(currentUser.id).then((stats) => {
        statsByRole.COMMITTEE = stats;
      })
    );
  }

  await Promise.all(loaders);

  const firstName = currentUser.firstNameTh || "";
  const lastName = currentUser.lastNameTh || "";
  const displayName =
    firstName || lastName
      ? `${currentUser.prefixTh || ""}${firstName} ${lastName}`.trim()
      : currentUser.name;

  return (
    <DashboardClient
      primaryRole={currentUser.role}
      roles={currentUser.roles}
      userName={displayName}
      statsByRole={statsByRole}
    />
  );
}
