import { db } from "@/server/db";
import { reviewAssignments, submissions, user } from "@/server/db/schema";
import { and, eq, inArray, isNotNull, lte, or, isNull, lt } from "drizzle-orm";
import { queueEmail, reviewReminderEmail } from "@/server/email";
import { logger } from "@/server/logger";

function verifyCronSecret(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = req.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}

export async function GET(req: Request) {
  return POST(req);
}

// Reminder cadence:
// - Upcoming:  send once when dueDate is within next 3 days and no reminder in last 3 days
// - Overdue:   send every 3 days while still not completed
const DAY_MS = 24 * 60 * 60 * 1000;
const UPCOMING_WINDOW_DAYS = 3;
const REMINDER_COOLDOWN_DAYS = 3;

export async function POST(req: Request) {
  if (!verifyCronSecret(req)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const upcomingCutoff = new Date(now.getTime() + UPCOMING_WINDOW_DAYS * DAY_MS);
  const cooldownCutoff = new Date(now.getTime() - REMINDER_COOLDOWN_DAYS * DAY_MS);

  // Candidates: ACCEPTED assignments with a due date, not completed,
  // whose dueDate is upcoming (<=3 days) or already overdue,
  // AND whose lastReminderAt is null or older than the cooldown window.
  const rows = await db
    .select({
      assignmentId: reviewAssignments.id,
      reviewerId: reviewAssignments.reviewerId,
      dueDate: reviewAssignments.dueDate,
      reviewerName: user.name,
      reviewerEmail: user.email,
      paperTitle: submissions.title,
      submissionId: submissions.id,
    })
    .from(reviewAssignments)
    .innerJoin(user, eq(user.id, reviewAssignments.reviewerId))
    .innerJoin(submissions, eq(submissions.id, reviewAssignments.submissionId))
    .where(
      and(
        inArray(reviewAssignments.status, ["PENDING", "ACCEPTED"]),
        isNotNull(reviewAssignments.dueDate),
        lte(reviewAssignments.dueDate, upcomingCutoff),
        or(
          isNull(reviewAssignments.lastReminderAt),
          lt(reviewAssignments.lastReminderAt, cooldownCutoff)
        )
      )
    );

  const appUrl =
    process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const loginUrl = `${appUrl}/reviews`;

  const results: Array<{ assignmentId: string; ok: boolean; error?: string }> = [];

  for (const row of rows) {
    if (!row.reviewerEmail || !row.dueDate) {
      results.push({ assignmentId: row.assignmentId, ok: false, error: "missing email or due date" });
      continue;
    }

    const daysLeft = Math.floor((row.dueDate.getTime() - now.getTime()) / DAY_MS);
    const dueDateLabel = row.dueDate.toISOString().slice(0, 10);
    const emailContent = reviewReminderEmail({
      reviewerName: row.reviewerName,
      paperTitle: row.paperTitle,
      dueDate: dueDateLabel,
      daysLeft,
      loginUrl,
    });

    try {
      await queueEmail({
        to: row.reviewerEmail,
        subject: emailContent.subject,
        html: emailContent.html,
        text: emailContent.text,
        throwOnFailure: true,
      });
      await db
        .update(reviewAssignments)
        .set({ lastReminderAt: now })
        .where(eq(reviewAssignments.id, row.assignmentId));
      results.push({ assignmentId: row.assignmentId, ok: true });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "unknown";
      logger.error("Review reminder email failed", {
        assignmentId: row.assignmentId,
        error: msg,
      });
      results.push({ assignmentId: row.assignmentId, ok: false, error: msg });
    }
  }

  return Response.json({
    ok: true,
    checked: rows.length,
    sent: results.filter((r) => r.ok).length,
    failed: results.filter((r) => !r.ok).length,
  });
}
