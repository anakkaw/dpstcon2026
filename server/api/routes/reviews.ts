import { OpenAPIHono } from "@hono/zod-openapi";
import { db } from "@/server/db";
import {
  reviews,
  reviewAssignments,
  submissions,
  decisions,
} from "@/server/db/schema";
import { eq, and } from "drizzle-orm";
import { authMiddleware, requireRole } from "../middleware/auth";
import type { AuthEnv } from "../middleware/auth";
import { z } from "zod";
import { hasRole } from "@/lib/permissions";

const app = new OpenAPIHono<AuthEnv>();

app.use("/*", authMiddleware);

// GET /api/reviews/assignments
app.get("/assignments", async (c) => {
  const currentUser = c.get("user");
  const isAdmin = hasRole(currentUser, "ADMIN", "PROGRAM_CHAIR");

  const whereClause = isAdmin ? undefined : eq(reviewAssignments.reviewerId, currentUser.id);

  const assignments = await db.query.reviewAssignments.findMany({
    where: whereClause,
    with: {
      submission: {
        columns: { id: true, title: true, abstract: true, status: true },
        with: {
          author: { columns: { id: true, name: true, prefixTh: true, firstNameTh: true, lastNameTh: true, prefixEn: true, firstNameEn: true, lastNameEn: true } },
          track: { columns: { id: true, name: true } },
        },
      },
      reviewer: { columns: { id: true, name: true, prefixTh: true, firstNameTh: true, lastNameTh: true, prefixEn: true, firstNameEn: true, lastNameEn: true } },
    },
  });

  return c.json({ assignments });
});

// POST /api/reviews/assignments/manual
app.post("/assignments/manual", async (c) => {
  const currentUser = c.get("user");
  const body = await c.req.json();
  const schema = z.object({
    submissionId: z.string().uuid(),
    reviewerId: z.string(),
    dueDate: z.string().optional(),
  });

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Validation error", details: parsed.error.flatten() }, 400);
  }

  const { submissionId, reviewerId, dueDate } = parsed.data;

  // Permission check: ADMIN, PROGRAM_CHAIR, or track head
  if (!hasRole(currentUser, "ADMIN", "PROGRAM_CHAIR")) {
    const { tracks } = await import("@/server/db/schema");
    const submission = await db.query.submissions.findFirst({
      where: eq(submissions.id, submissionId),
      columns: { trackId: true },
    });

    if (!submission?.trackId) {
      return c.json({ error: "Forbidden" }, 403);
    }

    const track = await db.query.tracks.findFirst({
      where: eq(tracks.id, submission.trackId),
      columns: { headUserId: true },
    });

    if (!track || track.headUserId !== currentUser.id) {
      return c.json({ error: "Forbidden — คุณไม่ใช่ประธานสาขาของบทความนี้" }, 403);
    }
  }

  // Check if already assigned
  const existing = await db.query.reviewAssignments.findFirst({
    where: and(
      eq(reviewAssignments.submissionId, submissionId),
      eq(reviewAssignments.reviewerId, reviewerId)
    ),
  });

  if (existing) {
    return c.json({ error: "Reviewer already assigned to this submission" }, 409);
  }

  const [assignment] = await db
    .insert(reviewAssignments)
    .values({
      submissionId,
      reviewerId,
      dueDate: dueDate ? new Date(dueDate) : undefined,
    })
    .returning();

  // Update submission status to UNDER_REVIEW if SUBMITTED
  await db
    .update(submissions)
    .set({ status: "UNDER_REVIEW", updatedAt: new Date() })
    .where(
      and(
        eq(submissions.id, submissionId),
        eq(submissions.status, "SUBMITTED")
      )
    );

  // Send email to reviewer
  const { user } = await import("@/server/db/schema");
  const reviewer = await db.query.user.findFirst({
    where: eq(user.id, reviewerId),
    columns: { name: true, email: true },
  });
  const submission = await db.query.submissions.findFirst({
    where: eq(submissions.id, submissionId),
    columns: { title: true },
  });

  if (reviewer && submission) {
    const { queueEmail, reviewAssignmentEmail } = await import("@/server/email");
    const appUrl = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const emailContent = reviewAssignmentEmail({
      reviewerName: reviewer.name,
      paperTitle: submission.title,
      dueDate: dueDate || undefined,
      loginUrl: `${appUrl}/reviews`,
    });
    await queueEmail({
      to: reviewer.email,
      subject: emailContent.subject,
      html: emailContent.html,
    });
  }

  return c.json({ assignment }, 201);
});

// DELETE /api/reviews/assignments/:id — remove assignment (ADMIN/PROGRAM_CHAIR)
app.delete("/assignments/:id", requireRole("ADMIN", "PROGRAM_CHAIR"), async (c) => {
  const id = c.req.param("id");
  const deleted = await db.delete(reviewAssignments).where(eq(reviewAssignments.id, id)).returning();
  if (deleted.length === 0) return c.json({ error: "Assignment not found" }, 404);
  return c.json({ ok: true });
});

// POST /api/reviews/reviews — submit review (must have assignment)
app.post("/reviews", async (c) => {
  const currentUser = c.get("user");
  const body = await c.req.json();

  const schema = z.object({
    submissionId: z.string().uuid(),
    assignmentId: z.string().uuid().optional(),
    commentsToAuthor: z.string().min(1),
    commentsToChair: z.string().optional(),
    recommendation: z.enum(["ACCEPT", "REVISE", "REJECT"]),
  });

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Validation error", details: parsed.error.flatten() }, 400);
  }

  const data = parsed.data;

  // Verify reviewer has an assignment for this submission
  const assignment = await db.query.reviewAssignments.findFirst({
    where: and(
      eq(reviewAssignments.submissionId, data.submissionId),
      eq(reviewAssignments.reviewerId, currentUser.id)
    ),
  });

  if (!assignment && !hasRole(currentUser, "ADMIN")) {
    return c.json({ error: "คุณไม่ได้รับมอบหมายให้รีวิวบทความนี้" }, 403);
  }

  const [review] = await db
    .insert(reviews)
    .values({
      submissionId: data.submissionId,
      reviewerId: currentUser.id,
      assignmentId: data.assignmentId || assignment?.id,
      commentsToAuthor: data.commentsToAuthor,
      commentsToChair: data.commentsToChair,
      recommendation: data.recommendation,
      completedAt: new Date(),
    })
    .returning();

  // Mark assignment as completed
  const assignmentIdToComplete = data.assignmentId || assignment?.id;
  if (assignmentIdToComplete) {
    await db
      .update(reviewAssignments)
      .set({ status: "COMPLETED", respondedAt: new Date() })
      .where(eq(reviewAssignments.id, assignmentIdToComplete));
  }

  return c.json({ review }, 201);
});

// POST /api/reviews/decisions — make decision (ADMIN/PROGRAM_CHAIR only)
app.post("/decisions", requireRole("ADMIN", "PROGRAM_CHAIR"), async (c) => {
  const currentUser = c.get("user");
  const body = await c.req.json();

  const schema = z.object({
    submissionId: z.string().uuid(),
    outcome: z.enum(["ACCEPT", "REJECT", "CONDITIONAL_ACCEPT", "DESK_REJECT"]),
    comments: z.string().optional(),
    conditions: z.string().optional(),
  });

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Validation error" }, 400);
  }

  const data = parsed.data;

  // Check if decision already exists for this submission
  const existingDecision = await db.query.decisions.findFirst({
    where: eq(decisions.submissionId, data.submissionId),
  });
  if (existingDecision) {
    return c.json({ error: "บทความนี้มีการตัดสินแล้ว" }, 409);
  }

  const [decision] = await db
    .insert(decisions)
    .values({
      submissionId: data.submissionId,
      decidedBy: currentUser.id,
      outcome: data.outcome,
      comments: data.comments,
      conditions: data.conditions,
    })
    .returning();

  const statusMap: Record<string, string> = {
    ACCEPT: "CAMERA_READY_PENDING",
    REJECT: "REJECTED",
    CONDITIONAL_ACCEPT: "REVISION_REQUIRED",
    DESK_REJECT: "DESK_REJECTED",
  };

  const newStatus = statusMap[data.outcome];

  await db
    .update(submissions)
    .set({ status: newStatus as typeof submissions.$inferInsert.status, updatedAt: new Date() })
    .where(eq(submissions.id, data.submissionId));

  // Auto-create presentations when accepted
  if (data.outcome === "ACCEPT" || data.outcome === "CONDITIONAL_ACCEPT") {
    const { presentationAssignments } = await import("@/server/db/schema");
    await db.insert(presentationAssignments).values([
      { submissionId: data.submissionId, type: "POSTER", status: "PENDING" },
      { submissionId: data.submissionId, type: "ORAL", status: "PENDING" },
    ]);
  }

  // Send decision email
  const submission = await db.query.submissions.findFirst({
    where: eq(submissions.id, data.submissionId),
    with: { author: { columns: { name: true, email: true } } },
  });

  if (submission) {
    const { queueEmail, decisionEmail } = await import("@/server/email");
    const appUrl = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const emailContent = decisionEmail({
      authorName: submission.author.name,
      paperTitle: submission.title,
      decision: data.outcome,
      comments: data.comments,
      submissionUrl: `${appUrl}/submissions/${data.submissionId}`,
    });
    await queueEmail({
      to: submission.author.email,
      subject: emailContent.subject,
      html: emailContent.html,
    });
  }

  return c.json({ decision }, 201);
});

export { app as reviewRoutes };
