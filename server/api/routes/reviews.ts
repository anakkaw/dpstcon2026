import { OpenAPIHono } from "@hono/zod-openapi";
import { db } from "@/server/db";
import {
  reviews,
  reviewAssignments,
  submissions,
  decisions,
} from "@/server/db/schema";
import { eq, and, inArray, ne } from "drizzle-orm";
import { authMiddleware } from "../middleware/auth";
import type { AuthEnv } from "../middleware/auth";
import { z } from "zod";
import { getTrackRoleIds, hasTrackRole, hasRole } from "@/lib/permissions";
import { isDuplicateReviewRound } from "@/server/access-policies";
import { ensureSubmissionPaperCode } from "@/server/paper-code-service";
import { getDecisionSubmissionStatus } from "@/server/submission-workflow";

const app = new OpenAPIHono<AuthEnv>();

app.use("/*", authMiddleware);

async function canManageSubmissionById(currentUser: AuthEnv["Variables"]["user"], submissionId: string) {
  if (hasRole(currentUser, "ADMIN")) {
    return true;
  }

  const submission = await db.query.submissions.findFirst({
    where: eq(submissions.id, submissionId),
    columns: { trackId: true },
  });

  if (!submission?.trackId) {
    return false;
  }

  return hasTrackRole(currentUser, submission.trackId, "PROGRAM_CHAIR");
}

// GET /api/reviews/assignments
app.get("/assignments", async (c) => {
  const currentUser = c.get("user");
  const isAdmin = hasRole(currentUser, "ADMIN");

  let whereClause = undefined;
  if (!isAdmin) {
    const assignmentIds = new Set<string>();

    if (hasRole(currentUser, "REVIEWER")) {
      const ownAssignments = await db
        .select({ id: reviewAssignments.id })
        .from(reviewAssignments)
        .where(eq(reviewAssignments.reviewerId, currentUser.id));

      ownAssignments.forEach((assignment) => assignmentIds.add(assignment.id));
    }

    const chairedTrackIds = getTrackRoleIds(currentUser, "PROGRAM_CHAIR");
    if (chairedTrackIds.length > 0) {
      const managedAssignments = await db
        .select({ id: reviewAssignments.id })
        .from(reviewAssignments)
        .innerJoin(
          submissions,
          eq(reviewAssignments.submissionId, submissions.id)
        )
        .where(inArray(submissions.trackId, chairedTrackIds));

      managedAssignments.forEach((assignment) => assignmentIds.add(assignment.id));
    }

    if (assignmentIds.size === 0) {
      return c.json({ assignments: [] });
    }

    whereClause = inArray(reviewAssignments.id, Array.from(assignmentIds));
  }

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

  if (!(await canManageSubmissionById(currentUser, submissionId))) {
    return c.json({ error: "Forbidden — คุณไม่ใช่ผู้ดูแลบทความนี้" }, 403);
  }

  // Check if already assigned. If the reviewer previously DECLINED, allow re-assignment
  // by reopening the same row (status → PENDING, reset response timestamp & reminder).
  // Otherwise, block to avoid duplicate assignments.
  const existing = await db.query.reviewAssignments.findFirst({
    where: and(
      eq(reviewAssignments.submissionId, submissionId),
      eq(reviewAssignments.reviewerId, reviewerId)
    ),
  });

  if (existing && existing.status !== "DECLINED") {
    return c.json({ error: "Reviewer already assigned to this submission" }, 409);
  }

  // Check conflict of interest
  const { conflicts } = await import("@/server/db/schema");
  const conflict = await db.query.conflicts.findFirst({
    where: and(
      eq(conflicts.submissionId, submissionId),
      eq(conflicts.userId, reviewerId)
    ),
    columns: { id: true, reason: true },
  });

  if (conflict) {
    return c.json({
      error: "Conflict of interest declared",
      conflictReason: conflict.reason,
    }, 409);
  }

  let assignment;
  if (existing && existing.status === "DECLINED") {
    // Reopen declined row
    [assignment] = await db
      .update(reviewAssignments)
      .set({
        status: "PENDING",
        assignedAt: new Date(),
        respondedAt: null,
        lastReminderAt: null,
        dueDate: dueDate ? new Date(dueDate) : null,
      })
      .where(eq(reviewAssignments.id, existing.id))
      .returning();
  } else {
    [assignment] = await db
      .insert(reviewAssignments)
      .values({
        submissionId,
        reviewerId,
        dueDate: dueDate ? new Date(dueDate) : undefined,
      })
      .returning();
  }

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
      text: emailContent.text,
    });
  }

  return c.json({ assignment }, 201);
});

// DELETE /api/reviews/assignments/:id — remove assignment (ADMIN/track head only)
app.delete("/assignments/:id", async (c) => {
  const currentUser = c.get("user");
  const id = c.req.param("id");
  const assignment = await db.query.reviewAssignments.findFirst({
    where: eq(reviewAssignments.id, id),
    columns: { id: true, submissionId: true },
  });

  if (!assignment) return c.json({ error: "Assignment not found" }, 404);
  if (!(await canManageSubmissionById(currentUser, assignment.submissionId))) {
    return c.json({ error: "Forbidden" }, 403);
  }

  const deleted = await db
    .delete(reviewAssignments)
    .where(eq(reviewAssignments.id, id))
    .returning();
  if (deleted.length === 0) return c.json({ error: "Assignment not found" }, 404);
  return c.json({ ok: true });
});

// PATCH /api/reviews/assignments/:id/respond — reviewer accepts or declines
app.patch("/assignments/:id/respond", async (c) => {
  const currentUser = c.get("user");
  const id = c.req.param("id");
  const body = await c.req.json();
  const schema = z.object({
    response: z.enum(["ACCEPTED", "DECLINED"]),
  });
  const parsed = schema.safeParse(body);
  if (!parsed.success) return c.json({ error: "Invalid response" }, 400);

  const assignment = await db.query.reviewAssignments.findFirst({
    where: eq(reviewAssignments.id, id),
    columns: { id: true, reviewerId: true, status: true, submissionId: true },
  });

  if (!assignment) return c.json({ error: "Assignment not found" }, 404);
  if (assignment.reviewerId !== currentUser.id && !hasRole(currentUser, "ADMIN")) {
    return c.json({ error: "Forbidden" }, 403);
  }
  if (assignment.status !== "PENDING") {
    return c.json({ error: "Assignment already responded" }, 409);
  }

  const [updated] = await db
    .update(reviewAssignments)
    .set({
      status: parsed.data.response,
      respondedAt: new Date(),
    })
    .where(eq(reviewAssignments.id, id))
    .returning();

  if (parsed.data.response === "ACCEPTED") {
    await db
      .update(submissions)
      .set({ status: "UNDER_REVIEW", updatedAt: new Date() })
      .where(
        and(
          eq(submissions.id, assignment.submissionId),
          eq(submissions.status, "SUBMITTED")
        )
      );
  }

  return c.json({ assignment: updated });
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

  const assignmentIdToComplete = data.assignmentId || assignment?.id;
  const existingReview = assignmentIdToComplete
    ? await db.query.reviews.findFirst({
        where: and(
          eq(reviews.submissionId, data.submissionId),
          eq(reviews.reviewerId, currentUser.id),
          eq(reviews.assignmentId, assignmentIdToComplete)
        ),
        columns: { id: true },
      })
    : await db.query.reviews.findFirst({
        where: and(
          eq(reviews.submissionId, data.submissionId),
          eq(reviews.reviewerId, currentUser.id)
        ),
        columns: { id: true },
      });

  if (
    isDuplicateReviewRound({
      hasExistingReview: !!existingReview,
      assignmentStatus: assignment?.status,
      isAdminOverride: hasRole(currentUser, "ADMIN") && !assignmentIdToComplete,
    })
  ) {
    return c.json({ error: "มีรีวิวสำหรับรอบการพิจารณานี้แล้ว" }, 409);
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
  if (assignmentIdToComplete) {
    const [completedAssignment] = await db
      .update(reviewAssignments)
      .set({ status: "COMPLETED", respondedAt: new Date() })
      .where(
        and(
          eq(reviewAssignments.id, assignmentIdToComplete),
          ne(reviewAssignments.status, "COMPLETED")
        )
      )
      .returning({ id: reviewAssignments.id });

    if (!completedAssignment) {
      await db.delete(reviews).where(eq(reviews.id, review.id));
      return c.json({ error: "มีรีวิวสำหรับรอบการพิจารณานี้แล้ว" }, 409);
    }
  }

  return c.json({ review }, 201);
});

// PATCH /api/reviews/reviews/:id — edit own submitted review within 24h window
const EDIT_WINDOW_MS = 24 * 60 * 60 * 1000;
app.patch("/reviews/:id", async (c) => {
  const currentUser = c.get("user");
  const id = c.req.param("id");
  const body = await c.req.json();
  const schema = z.object({
    commentsToAuthor: z.string().min(1),
    commentsToChair: z.string().optional(),
    recommendation: z.enum(["ACCEPT", "REVISE", "REJECT"]),
  });
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Validation error", details: parsed.error.flatten() }, 400);
  }

  const review = await db.query.reviews.findFirst({
    where: eq(reviews.id, id),
    columns: { id: true, reviewerId: true, completedAt: true },
  });
  if (!review) return c.json({ error: "Review not found" }, 404);

  if (review.reviewerId !== currentUser.id && !hasRole(currentUser, "ADMIN")) {
    return c.json({ error: "Forbidden" }, 403);
  }

  // Admin can always edit; reviewer only within 24h of submission
  const isAdminOverride = hasRole(currentUser, "ADMIN");
  if (!isAdminOverride) {
    if (!review.completedAt) {
      return c.json({ error: "Cannot edit an incomplete review" }, 400);
    }
    const elapsed = Date.now() - review.completedAt.getTime();
    if (elapsed > EDIT_WINDOW_MS) {
      return c.json({ error: "Edit window has closed (24 hours)" }, 409);
    }
  }

  const [updated] = await db
    .update(reviews)
    .set({
      commentsToAuthor: parsed.data.commentsToAuthor,
      commentsToChair: parsed.data.commentsToChair,
      recommendation: parsed.data.recommendation,
      updatedAt: new Date(),
    })
    .where(eq(reviews.id, id))
    .returning();

  return c.json({ review: updated });
});

// POST /api/reviews/decisions — make decision (ADMIN/track head only)
app.post("/decisions", async (c) => {
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

  if (!(await canManageSubmissionById(currentUser, data.submissionId))) {
    return c.json({ error: "Forbidden" }, 403);
  }

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

  const newStatus = getDecisionSubmissionStatus(data.outcome);

  await db
    .update(submissions)
    .set({ status: newStatus, updatedAt: new Date() })
    .where(eq(submissions.id, data.submissionId));

  if (newStatus === "ACCEPTED") {
    await ensureSubmissionPaperCode(data.submissionId);
  }

  // Auto-create presentations when accepted
  if (data.outcome === "ACCEPT" || data.outcome === "CONDITIONAL_ACCEPT") {
    const { presentationAssignments } = await import("@/server/db/schema");
    const existingPresentations = await db.query.presentationAssignments.findMany({
      where: eq(presentationAssignments.submissionId, data.submissionId),
      columns: { type: true },
    });
    const existingTypes = new Set(existingPresentations.map((row) => row.type));
    const missingTypes = ["POSTER", "ORAL"].filter(
      (type) => !existingTypes.has(type as "POSTER" | "ORAL")
    );

    if (missingTypes.length > 0) {
      await db.insert(presentationAssignments).values(
        missingTypes.map((type) => ({
          submissionId: data.submissionId,
          type: type as "POSTER" | "ORAL",
          status: "PENDING" as const,
        }))
      );
    }
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
      conditions: data.conditions,
      submissionUrl: `${appUrl}/submissions/${data.submissionId}`,
    });
    await queueEmail({
      to: submission.author.email,
      subject: emailContent.subject,
      html: emailContent.html,
      text: emailContent.text,
    });
  }

  return c.json({ decision }, 201);
});

export { app as reviewRoutes };
