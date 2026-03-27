import { OpenAPIHono } from "@hono/zod-openapi";
import { db } from "@/server/db";
import { submissions, storedFiles, user as userTable } from "@/server/db/schema";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import { getDownloadUrl } from "@/server/r2";
import { rateLimit } from "../middleware/rate-limit";

const app = new OpenAPIHono();

// Rate limit: 15 requests per 15 minutes per IP
app.use("/*", rateLimit(15, 15 * 60 * 1000));

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
      author: { columns: { name: true, email: true, affiliation: true, prefixTh: true, firstNameTh: true, lastNameTh: true, prefixEn: true, firstNameEn: true, lastNameEn: true } },
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

  // Fetch manuscript files for advisor to review
  const files = await db
    .select({
      id: storedFiles.id,
      originalName: storedFiles.originalName,
      mimeType: storedFiles.mimeType,
      size: storedFiles.size,
      kind: storedFiles.kind,
    })
    .from(storedFiles)
    .where(
      and(
        eq(storedFiles.submissionId, submission.id),
        eq(storedFiles.kind, "MANUSCRIPT")
      )
    );

  return c.json({ submission, alreadyResponded: false, files });
});

// GET /api/advisor-approval/:token/download/:fileId — download file (no auth, token-based)
app.get("/:token/download/:fileId", async (c) => {
  const { token, fileId } = c.req.param();

  const submission = await db.query.submissions.findFirst({
    where: eq(submissions.advisorApprovalToken, token),
    columns: { id: true, advisorApprovalStatus: true, submittedAt: true },
  });

  if (!submission) return c.json({ error: "Invalid token" }, 404);
  if (isTokenExpired(submission.submittedAt)) return c.json({ error: "Token expired" }, 410);

  const [file] = await db
    .select()
    .from(storedFiles)
    .where(
      and(
        eq(storedFiles.id, fileId),
        eq(storedFiles.submissionId, submission.id)
      )
    )
    .limit(1);

  if (!file) return c.json({ error: "File not found" }, 404);

  const url = await getDownloadUrl(file.storedKey);
  return c.json({ url, fileName: file.originalName });
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

  // Update status + clear token (one-time use)
  const [updated] = await db
    .update(submissions)
    .set({
      advisorApprovalStatus: parsed.data.decision,
      advisorApprovalAt: new Date(),
      advisorApprovalToken: null,
      status: newStatus,
      updatedAt: new Date(),
    })
    .where(eq(submissions.id, submission.id))
    .returning();

  // Send notification email to author
  try {
    const { queueEmail, advisorResponseEmail } = await import("@/server/email");
    const appUrl = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

    // Fetch author info
    const author = await db.query.user.findFirst({
      where: eq(userTable.id, submission.authorId),
      columns: { name: true, email: true },
    });

    if (author) {
      const emailContent = advisorResponseEmail({
        authorName: author.name,
        advisorName: submission.advisorName || "Advisor",
        paperTitle: submission.title,
        decision: parsed.data.decision,
        comments: parsed.data.comments,
        submissionUrl: `${appUrl}/submissions/${submission.id}`,
      });
      await queueEmail({
        to: author.email,
        subject: emailContent.subject,
        html: emailContent.html,
        text: emailContent.text,
      });
    }
  } catch (err) {
    console.error("[AdvisorApproval] Failed to notify author:", err);
  }

  return c.json({
    success: true,
    decision: parsed.data.decision,
    submission: { id: updated.id, title: updated.title, status: updated.status },
  });
});

export { app as advisorApprovalRoutes };
