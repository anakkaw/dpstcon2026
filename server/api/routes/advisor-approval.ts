import { OpenAPIHono } from "@hono/zod-openapi";
import { db } from "@/server/db";
import { submissions } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";

const app = new OpenAPIHono();

// No auth required — public token-based access
// M3: Advisor tokens expire after 7 days from submission
const ADVISOR_TOKEN_EXPIRY_DAYS = 7;

function isTokenExpired(submittedAt: Date | null): boolean {
  if (!submittedAt) return false;
  const expiresAt = new Date(submittedAt.getTime() + ADVISOR_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000);
  return new Date() > expiresAt;
}

// GET /api/advisor-approval/:token — get submission info for advisor
app.get("/:token", async (c) => {
  const { token } = c.req.param();

  const submission = await db.query.submissions.findFirst({
    where: eq(submissions.advisorApprovalToken, token),
    columns: {
      id: true,
      title: true,
      abstract: true,
      keywords: true,
      advisorName: true,
      advisorEmail: true,
      advisorApprovalStatus: true,
      status: true,
      submittedAt: true,
    },
    with: {
      author: { columns: { name: true, email: true, affiliation: true } },
      track: { columns: { name: true } },
    },
  });

  if (!submission) {
    return c.json({ error: "Invalid or expired token" }, 404);
  }

  // M3: Check token expiry
  if (submission.advisorApprovalStatus === "PENDING" && isTokenExpired(submission.submittedAt)) {
    return c.json({ error: "ลิงก์รับรองหมดอายุแล้ว กรุณาติดต่อนักศึกษาเพื่อขอลิงก์ใหม่" }, 410);
  }

  if (submission.advisorApprovalStatus !== "PENDING") {
    return c.json({
      submission,
      alreadyResponded: true,
      message:
        submission.advisorApprovalStatus === "APPROVED"
          ? "ท่านได้รับรองบทความนี้แล้ว"
          : "ท่านได้ปฏิเสธการรับรองบทความนี้แล้ว",
    });
  }

  return c.json({ submission, alreadyResponded: false });
});

// POST /api/advisor-approval/:token/respond — approve or reject
app.post("/:token/respond", async (c) => {
  const { token } = c.req.param();
  const body = await c.req.json();

  const schema = z.object({
    decision: z.enum(["APPROVED", "REJECTED"]),
    comments: z.string().optional(),
  });

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Invalid request" }, 400);
  }

  const submission = await db.query.submissions.findFirst({
    where: eq(submissions.advisorApprovalToken, token),
  });

  if (!submission) {
    return c.json({ error: "Invalid or expired token" }, 404);
  }

  // M3: Check token expiry
  if (isTokenExpired(submission.submittedAt)) {
    return c.json({ error: "ลิงก์รับรองหมดอายุแล้ว" }, 410);
  }

  if (submission.advisorApprovalStatus !== "PENDING") {
    return c.json({ error: "Already responded" }, 409);
  }

  const newStatus =
    parsed.data.decision === "APPROVED" ? "SUBMITTED" : "DRAFT";

  const [updated] = await db
    .update(submissions)
    .set({
      advisorApprovalStatus: parsed.data.decision,
      advisorApprovalAt: new Date(),
      status: newStatus,
      updatedAt: new Date(),
    })
    .where(eq(submissions.id, submission.id))
    .returning();

  return c.json({
    success: true,
    decision: parsed.data.decision,
    submission: { id: updated.id, title: updated.title, status: updated.status },
  });
});

export { app as advisorApprovalRoutes };
