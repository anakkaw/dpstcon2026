import { db } from "@/server/db";
import { submissions, user } from "@/server/db/schema";
import { and, eq, lt, sql } from "drizzle-orm";
import { advisorApprovalEmail, queueEmail } from "@/server/email";
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

const RESEND_AFTER_HOURS = 48;
const MAX_AUTO_RESENDS = 2;

export async function POST(req: Request) {
  if (!verifyCronSecret(req)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const cutoff = new Date(Date.now() - RESEND_AFTER_HOURS * 60 * 60 * 1000);

  const stuck = await db
    .select({
      id: submissions.id,
      title: submissions.title,
      advisorEmail: submissions.advisorEmail,
      advisorName: submissions.advisorName,
      authorName: user.name,
      autoResendCount: submissions.advisorAutoResendCount,
    })
    .from(submissions)
    .innerJoin(user, eq(user.id, submissions.authorId))
    .where(
      and(
        eq(submissions.status, "ADVISOR_APPROVAL_PENDING"),
        eq(submissions.advisorApprovalStatus, "PENDING"),
        lt(submissions.submittedAt, cutoff),
        sql`COALESCE(${submissions.advisorAutoResendCount}, 0) < ${MAX_AUTO_RESENDS}`
      )
    );

  const appUrl =
    process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  const results: Array<{ id: string; ok: boolean; error?: string }> = [];

  for (const sub of stuck) {
    if (!sub.advisorEmail) {
      results.push({ id: sub.id, ok: false, error: "no advisor email" });
      continue;
    }

    const advisorToken = crypto.randomUUID();
    await db
      .update(submissions)
      .set({
        advisorApprovalToken: advisorToken,
        submittedAt: new Date(),
        advisorAutoResendCount: (sub.autoResendCount ?? 0) + 1,
        updatedAt: new Date(),
      })
      .where(eq(submissions.id, sub.id));

    const emailContent = advisorApprovalEmail({
      advisorName: sub.advisorName || "Advisor",
      studentName: sub.authorName,
      paperTitle: sub.title,
      approvalUrl: `${appUrl}/advisor-approval/${advisorToken}`,
    });

    try {
      await queueEmail({
        to: sub.advisorEmail,
        subject: `[เตือนซ้ำ] ${emailContent.subject}`,
        html: emailContent.html,
        text: emailContent.text,
        throwOnFailure: true,
      });
      results.push({ id: sub.id, ok: true });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "unknown";
      logger.error("Auto-resend advisor email failed", { submissionId: sub.id, error: msg });
      results.push({ id: sub.id, ok: false, error: msg });
    }
  }

  return Response.json({
    ok: true,
    checked: stuck.length,
    sent: results.filter((r) => r.ok).length,
    failed: results.filter((r) => !r.ok).length,
    results,
  });
}
