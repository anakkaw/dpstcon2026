import { auth } from "@/server/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/server/db";
import {
  submissions,
  reviews,
  reviewAssignments,
  user,
  tracks,
  decisions,
  presentationAssignments,
  presentationCriteria,
  settings,
  notifications,
} from "@/server/db/schema";
import { eq, count, and, sql } from "drizzle-orm";
import { DashboardClient } from "./dashboard-client";

export default async function DashboardPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  const currentUser = session.user as { id: string; role: string; name: string; prefixTh?: string; firstNameTh?: string; lastNameTh?: string };
  let stats: Record<string, unknown> = {};

  if (currentUser.role === "AUTHOR") {
    // Fetch submissions and deadlines in parallel (independent queries)
    const [mySubmissions, deadlineRows, [unreadCount]] = await Promise.all([
      db.query.submissions.findMany({
        where: eq(submissions.authorId, currentUser.id),
        columns: {
          id: true,
          title: true,
          status: true,
          fileUrl: true,
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
          sql`${settings.key} IN ('submissionDeadline', 'reviewDeadline', 'notificationDate', 'cameraReadyDeadline')`
        ),
      db
        .select({ count: count() })
        .from(notifications)
        .where(and(eq(notifications.userId, currentUser.id), eq(notifications.isRead, false))),
    ]);

    const subIds = mySubmissions.map((s) => s.id);

    // Fetch decisions and presentations in parallel (both depend on subIds)
    const [myDecisions, myPresentations] = subIds.length > 0
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
            .where(sql`${decisions.submissionId} IN ${subIds}`),
          db
            .select({
              submissionId: presentationAssignments.submissionId,
              type: presentationAssignments.type,
              status: presentationAssignments.status,
              scheduledAt: presentationAssignments.scheduledAt,
              room: presentationAssignments.room,
              duration: presentationAssignments.duration,
            })
            .from(presentationAssignments)
            .where(sql`${presentationAssignments.submissionId} IN ${subIds}`),
        ])
      : [[], []] as [typeof decisions.$inferSelect[], typeof presentationAssignments.$inferSelect[]];

    const deadlines: Record<string, string> = {};
    for (const row of deadlineRows) {
      if (row.value && typeof row.value === "string") {
        deadlines[row.key] = row.value;
      }
    }
    if (!deadlines.submissionDeadline) deadlines.submissionDeadline = "2026-06-30";
    if (!deadlines.reviewDeadline) deadlines.reviewDeadline = "2026-08-15";
    if (!deadlines.notificationDate) deadlines.notificationDate = "2026-08-31";
    if (!deadlines.cameraReadyDeadline) deadlines.cameraReadyDeadline = "2026-09-30";

    const byStatus: Record<string, number> = {};
    for (const s of mySubmissions) {
      byStatus[s.status] = (byStatus[s.status] || 0) + 1;
    }

    stats = {
      totalSubmissions: mySubmissions.length,
      byStatus,
      submissions: mySubmissions.map((s) => ({
        id: s.id,
        title: s.title,
        status: s.status,
        hasFile: !!s.fileUrl,
        trackName: s.track?.name || null,
        reviewTotal: s.reviewAssignments.length,
        reviewCompleted: s.reviewAssignments.filter((ra) => ra.status === "COMPLETED").length,
      })),
      decisions: myDecisions.map((d) => ({
        ...d,
        decidedAt: d.decidedAt.toISOString(),
      })),
      presentations: myPresentations.map((p) => ({
        ...p,
        scheduledAt: p.scheduledAt?.toISOString() || null,
      })),
      deadlines,
      unreadNotifications: Number(unreadCount?.count || 0),
    };
  } else if (currentUser.role === "REVIEWER") {
    const myAssignments = await db
      .select({ status: reviewAssignments.status, count: count() })
      .from(reviewAssignments)
      .where(eq(reviewAssignments.reviewerId, currentUser.id))
      .groupBy(reviewAssignments.status);

    stats = {
      totalAssignments: myAssignments.reduce((s, r) => s + Number(r.count), 0),
      completed: Number(myAssignments.find((a) => a.status === "COMPLETED")?.count || 0),
      pending: Number(
        myAssignments.filter((a) => ["PENDING", "ACCEPTED"].includes(a.status)).reduce((s, r) => s + Number(r.count), 0)
      ),
    };
  } else if (currentUser.role === "PROGRAM_CHAIR") {
    // Fetch tracks and reviewer count in parallel
    const [myTracks, [reviewerCount]] = await Promise.all([
      db
        .select({ id: tracks.id, name: tracks.name })
        .from(tracks)
        .where(eq(tracks.headUserId, currentUser.id)),
      db.select({ total: count() }).from(user).where(eq(user.role, "REVIEWER")),
    ]);
    const trackIds = myTracks.map((t) => t.id);

    let chairSubs: { status: string; count: number }[] = [];
    let chairRevCount = 0;
    if (trackIds.length > 0) {
      // Fetch submission stats and review count in parallel
      const [subs, [rc]] = await Promise.all([
        db
          .select({ status: submissions.status, count: count() })
          .from(submissions)
          .where(sql`${submissions.trackId} IN ${trackIds}`)
          .groupBy(submissions.status),
        db
          .select({ total: count() })
          .from(reviews)
          .innerJoin(submissions, eq(reviews.submissionId, submissions.id))
          .where(sql`${submissions.trackId} IN ${trackIds}`),
      ]);
      chairSubs = subs;
      chairRevCount = Number(rc?.total || 0);
    }

    stats = {
      totalSubmissions: chairSubs.reduce((s, r) => s + Number(r.count), 0),
      totalReviewers: Number(reviewerCount?.total || 0),
      totalReviews: chairRevCount,
      submissionsByStatus: Object.fromEntries(chairSubs.map((s) => [s.status, Number(s.count)])),
      submissionsByTrack: myTracks.map((t) => ({ name: t.name, count: 0 })),
      myTrackNames: myTracks.map((t) => t.name),
    };
  } else {
    // ADMIN sees all — run all 4 queries in parallel
    const [
      [subCount],
      statusBreakdown,
      [revCount],
      [reviewerCount],
      trackBreakdown,
    ] = await Promise.all([
      db.select({ total: count() }).from(submissions),
      db
        .select({ status: submissions.status, count: count() })
        .from(submissions)
        .groupBy(submissions.status),
      db.select({ total: count() }).from(reviews),
      db.select({ total: count() }).from(user).where(eq(user.role, "REVIEWER")),
      db
        .select({
          trackId: submissions.trackId,
          trackName: tracks.name,
          count: count(),
        })
        .from(submissions)
        .leftJoin(tracks, eq(submissions.trackId, tracks.id))
        .groupBy(submissions.trackId, tracks.name),
    ]);

    stats = {
      totalSubmissions: Number(subCount?.total || 0),
      totalReviewers: Number(reviewerCount?.total || 0),
      totalReviews: Number(revCount?.total || 0),
      submissionsByStatus: Object.fromEntries(statusBreakdown.map((s) => [s.status, Number(s.count)])),
      submissionsByTrack: trackBreakdown.map((t) => ({
        name: t.trackName || "ไม่ระบุสาขา",
        count: Number(t.count),
      })),
    };
  }

  const f = currentUser.firstNameTh || "";
  const l = currentUser.lastNameTh || "";
  const displayName = (f || l) ? `${currentUser.prefixTh || ""}${f} ${l}`.trim() : currentUser.name;

  return <DashboardClient role={currentUser.role} userName={displayName} stats={stats} />;
}
