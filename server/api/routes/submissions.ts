import { OpenAPIHono } from "@hono/zod-openapi";
import { db } from "@/server/db";
import { submissions, coAuthors, tracks, reviewAssignments, storedFiles } from "@/server/db/schema";
import { eq, desc, and, sql } from "drizzle-orm";
import { authMiddleware } from "../middleware/auth";
import type { SessionUser } from "../middleware/auth";
import { z } from "zod";
import { getUploadUrl, getDownloadUrl, generateFileKey } from "@/server/r2";
import { hasRole } from "@/lib/permissions";

const app = new OpenAPIHono();

app.use("/*", authMiddleware);

// GET /api/submissions/tracks — list all tracks (for submission form)
app.get("/tracks", async (c) => {
  const allTracks = await db.select().from(tracks);
  return c.json({ tracks: allTracks });
});

// GET /api/submissions — multi-role aware listing
app.get("/", async (c) => {
  const currentUser = c.get("user" as never) as SessionUser;

  // ADMIN sees everything
  if (hasRole(currentUser, "ADMIN")) {
    const results = await db.query.submissions.findMany({
      with: {
        author: { columns: { id: true, name: true, email: true } },
        track: { columns: { id: true, name: true } },
        reviews: { columns: { id: true, recommendation: true, completedAt: true } },
        reviewAssignments: { columns: { id: true, status: true } },
      },
      orderBy: [desc(submissions.createdAt)],
    });
    return c.json({ submissions: results });
  }

  // Multi-role: collect submission IDs from all applicable roles in parallel
  const submissionIds = new Set<string>();

  const roleFetches: Promise<void>[] = [];

  // PROGRAM_CHAIR: submissions in tracks they head
  if (hasRole(currentUser, "PROGRAM_CHAIR")) {
    roleFetches.push(
      db.select({ id: tracks.id }).from(tracks).where(eq(tracks.headUserId, currentUser.id))
        .then(async (myTracks) => {
          const trackIds = myTracks.map((t) => t.id);
          if (trackIds.length > 0) {
            const trackSubs = await db.select({ id: submissions.id }).from(submissions).where(sql`${submissions.trackId} IN ${trackIds}`);
            trackSubs.forEach((s) => submissionIds.add(s.id));
          }
        })
    );
  }

  // REVIEWER: submissions assigned to them
  if (hasRole(currentUser, "REVIEWER")) {
    roleFetches.push(
      db.select({ submissionId: reviewAssignments.submissionId }).from(reviewAssignments).where(eq(reviewAssignments.reviewerId, currentUser.id))
        .then((rows) => rows.forEach((a) => submissionIds.add(a.submissionId)))
    );
  }

  // AUTHOR: own submissions
  if (hasRole(currentUser, "AUTHOR")) {
    roleFetches.push(
      db.select({ id: submissions.id }).from(submissions).where(eq(submissions.authorId, currentUser.id))
        .then((rows) => rows.forEach((s) => submissionIds.add(s.id)))
    );
  }

  await Promise.all(roleFetches);

  // COMMITTEE only: no submissions access
  if (submissionIds.size === 0) {
    return c.json({ submissions: [] });
  }

  const ids = Array.from(submissionIds);
  const results = await db.query.submissions.findMany({
    where: sql`${submissions.id} IN ${ids}`,
    with: {
      author: { columns: { id: true, name: true, email: true } },
      track: { columns: { id: true, name: true } },
      reviews: { columns: { id: true, recommendation: true, completedAt: true } },
      reviewAssignments: { columns: { id: true, status: true } },
    },
    orderBy: [desc(submissions.createdAt)],
  });
  return c.json({ submissions: results });
});

// GET /api/submissions/:id
app.get("/:id", async (c) => {
  const { id } = c.req.param();
  const currentUser = c.get("user" as never) as SessionUser;

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

  if (!submission) return c.json({ error: "Not found" }, 404);

  // Access control: ADMIN can access all
  if (!hasRole(currentUser, "ADMIN")) {
    let hasAccess = false;

    // Author can access own
    if (submission.authorId === currentUser.id) {
      hasAccess = true;
    }

    // Reviewer can access if assigned
    if (hasRole(currentUser, "REVIEWER")) {
      const assignment = await db.query.reviewAssignments.findFirst({
        where: and(
          eq(reviewAssignments.submissionId, id),
          eq(reviewAssignments.reviewerId, currentUser.id)
        ),
      });
      if (assignment) hasAccess = true;
    }

    // Program chair can access if track head
    if (hasRole(currentUser, "PROGRAM_CHAIR") && submission.trackId) {
      const track = await db.query.tracks.findFirst({
        where: eq(tracks.id, submission.trackId),
        columns: { headUserId: true },
      });
      if (track?.headUserId === currentUser.id) hasAccess = true;
    }

    if (!hasAccess) return c.json({ error: "Forbidden" }, 403);
  }

  let filteredDiscussions = submission.discussions;
  let filteredReviews = submission.reviews;

  // If user is ONLY an author (not also reviewer/chair/admin for this submission)
  const isOnlyAuthor =
    submission.authorId === currentUser.id &&
    !hasRole(currentUser, "ADMIN", "PROGRAM_CHAIR", "REVIEWER");

  if (isOnlyAuthor) {
    filteredDiscussions = submission.discussions.filter(
      (d) => d.visibility === "AUTHOR_VISIBLE"
    );
    filteredReviews = submission.reviews.map((r) => ({
      ...r,
      reviewer: { id: "", name: "" },
      commentsToChair: null,
    }));
  }

  return c.json({ submission: { ...submission, discussions: filteredDiscussions, reviews: filteredReviews } });
});

// POST /api/submissions
const createSchema = z.object({
  title: z.string().min(1).max(500),
  abstract: z.string().optional(),
  keywords: z.string().optional(),
  trackId: z.string().uuid().optional(),
  advisorEmail: z.string().email(),
  advisorName: z.string().min(1),
  coAuthors: z
    .array(z.object({ name: z.string(), email: z.string().email().optional(), affiliation: z.string().optional() }))
    .optional(),
});

app.post("/", async (c) => {
  const currentUser = c.get("user" as never) as SessionUser;
  const body = await c.req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: "Validation error", details: parsed.error.flatten().fieldErrors }, 400);

  const data = parsed.data;

  const [submission] = await db
    .insert(submissions)
    .values({
      authorId: currentUser.id,
      title: data.title,
      abstract: data.abstract,
      keywords: data.keywords,
      trackId: data.trackId,
      advisorEmail: data.advisorEmail,
      advisorName: data.advisorName,
      status: "DRAFT",
    })
    .returning();

  if (data.coAuthors?.length) {
    await db.insert(coAuthors).values(
      data.coAuthors.map((ca, i) => ({
        submissionId: submission.id,
        name: ca.name,
        email: ca.email,
        affiliation: ca.affiliation,
        orderIndex: i,
      }))
    );
  }

  return c.json({ submission }, 201);
});

// PATCH /api/submissions/:id
app.patch("/:id", async (c) => {
  const { id } = c.req.param();
  const currentUser = c.get("user" as never) as SessionUser;
  const body = await c.req.json();

  // Validate allowed fields to prevent mass assignment
  const patchSchema = z.object({
    title: z.string().min(1).max(500).optional(),
    abstract: z.string().optional(),
    keywords: z.string().optional(),
    trackId: z.string().uuid().optional(),
    advisorEmail: z.string().email().optional(),
    advisorName: z.string().optional(),
    status: z.enum([
      "DRAFT", "ADVISOR_APPROVAL_PENDING", "SUBMITTED", "UNDER_REVIEW",
      "REVISION_REQUIRED", "REBUTTAL", "ACCEPTED", "REJECTED",
      "DESK_REJECTED", "CAMERA_READY_PENDING", "CAMERA_READY_SUBMITTED", "WITHDRAWN",
    ]).optional(),
  });

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: "Validation error" }, 400);

  const existing = await db.query.submissions.findFirst({ where: eq(submissions.id, id) });
  if (!existing) return c.json({ error: "Not found" }, 404);

  // Only admin/chair can update others' submissions; status changes require admin/chair
  if (existing.authorId !== currentUser.id && !hasRole(currentUser, "ADMIN", "PROGRAM_CHAIR")) {
    return c.json({ error: "Forbidden" }, 403);
  }
  if (parsed.data.status && !hasRole(currentUser, "ADMIN", "PROGRAM_CHAIR")) {
    return c.json({ error: "Forbidden — only chairs can change status" }, 403);
  }

  const [updated] = await db
    .update(submissions)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(submissions.id, id))
    .returning();

  return c.json({ submission: updated });
});

// POST /api/submissions/:id/submit
app.post("/:id/submit", async (c) => {
  const { id } = c.req.param();
  const currentUser = c.get("user" as never) as SessionUser;

  const submission = await db.query.submissions.findFirst({ where: eq(submissions.id, id) });
  if (!submission) return c.json({ error: "Not found" }, 404);
  if (submission.authorId !== currentUser.id) return c.json({ error: "Forbidden" }, 403);
  if (submission.status !== "DRAFT") return c.json({ error: "Can only submit from DRAFT" }, 400);

  if (!submission.fileUrl) {
    return c.json({ error: "กรุณาแนบไฟล์บทความก่อนส่ง" }, 400);
  }

  const advisorToken = crypto.randomUUID();

  const [updated] = await db
    .update(submissions)
    .set({
      status: "ADVISOR_APPROVAL_PENDING",
      submittedAt: new Date(),
      advisorApprovalStatus: "PENDING",
      advisorApprovalToken: advisorToken,
      updatedAt: new Date(),
    })
    .where(eq(submissions.id, id))
    .returning();

  const { queueEmail, advisorApprovalEmail } = await import("@/server/email");
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const emailContent = advisorApprovalEmail({
    advisorName: submission.advisorName || "Advisor",
    studentName: currentUser.name,
    paperTitle: submission.title,
    approvalUrl: `${appUrl}/advisor-approval/${advisorToken}`,
  });
  await queueEmail({
    to: submission.advisorEmail!,
    subject: emailContent.subject,
    html: emailContent.html,
  });

  return c.json({ submission: updated });
});

// POST /api/submissions/:id/resubmit
app.post("/:id/resubmit", async (c) => {
  const { id } = c.req.param();
  const currentUser = c.get("user" as never) as SessionUser;

  const submission = await db.query.submissions.findFirst({ where: eq(submissions.id, id) });
  if (!submission) return c.json({ error: "Not found" }, 404);
  if (submission.authorId !== currentUser.id) return c.json({ error: "Forbidden" }, 403);
  if (submission.status !== "REVISION_REQUIRED") return c.json({ error: "Can only resubmit from REVISION_REQUIRED" }, 400);

  await db
    .update(reviewAssignments)
    .set({ status: "ACCEPTED", respondedAt: null })
    .where(
      and(
        eq(reviewAssignments.submissionId, id),
        eq(reviewAssignments.status, "COMPLETED")
      )
    );

  const [updated] = await db
    .update(submissions)
    .set({ status: "UNDER_REVIEW", updatedAt: new Date() })
    .where(eq(submissions.id, id))
    .returning();

  return c.json({ submission: updated });
});

// POST /api/submissions/:id/withdraw
app.post("/:id/withdraw", async (c) => {
  const { id } = c.req.param();
  const currentUser = c.get("user" as never) as SessionUser;

  const submission = await db.query.submissions.findFirst({ where: eq(submissions.id, id) });
  if (!submission) return c.json({ error: "Not found" }, 404);
  if (submission.authorId !== currentUser.id) return c.json({ error: "Forbidden" }, 403);
  if (submission.status === "WITHDRAWN") return c.json({ error: "Already withdrawn" }, 400);

  const [updated] = await db
    .update(submissions)
    .set({ status: "WITHDRAWN", updatedAt: new Date() })
    .where(eq(submissions.id, id))
    .returning();

  return c.json({ submission: updated });
});

// POST /api/submissions/:id/rebuttal — M5: validate rebuttal text
app.post("/:id/rebuttal", async (c) => {
  const { id } = c.req.param();
  const currentUser = c.get("user" as never) as SessionUser;
  const body = await c.req.json();

  const rebuttalSchema = z.object({
    text: z.string().min(1, "กรุณากรอกข้อความชี้แจง").max(10000, "ข้อความยาวเกินไป (สูงสุด 10,000 ตัวอักษร)"),
  });
  const parsed = rebuttalSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: parsed.error.flatten().fieldErrors.text?.[0] || "Validation error" }, 400);
  const { text } = parsed.data;

  const submission = await db.query.submissions.findFirst({ where: eq(submissions.id, id) });
  if (!submission) return c.json({ error: "Not found" }, 404);
  if (submission.authorId !== currentUser.id) return c.json({ error: "Forbidden" }, 403);
  if (submission.status !== "REBUTTAL") return c.json({ error: "Rebuttal not allowed" }, 400);

  const [updated] = await db
    .update(submissions)
    .set({ rebuttalText: text, updatedAt: new Date() })
    .where(eq(submissions.id, id))
    .returning();

  return c.json({ submission: updated });
});

// POST /api/submissions/:id/camera-ready
app.post("/:id/camera-ready", async (c) => {
  const { id } = c.req.param();
  const currentUser = c.get("user" as never) as SessionUser;
  const { cameraReadyUrl } = await c.req.json();

  const submission = await db.query.submissions.findFirst({ where: eq(submissions.id, id) });
  if (!submission) return c.json({ error: "Not found" }, 404);
  if (submission.authorId !== currentUser.id) return c.json({ error: "Forbidden" }, 403);
  if (submission.status !== "CAMERA_READY_PENDING") return c.json({ error: "Not expected" }, 400);

  const [updated] = await db
    .update(submissions)
    .set({ cameraReadyUrl, status: "CAMERA_READY_SUBMITTED", updatedAt: new Date() })
    .where(eq(submissions.id, id))
    .returning();

  return c.json({ submission: updated });
});

// POST /api/submissions/:id/upload-url
const uploadSchema = z.object({
  fileName: z.string().min(1),
  mimeType: z.string().min(1),
  fileSize: z.number().positive().max(50 * 1024 * 1024),
  kind: z.enum(["MANUSCRIPT", "SUPPLEMENTARY", "CAMERA_READY"]),
});

app.post("/:id/upload-url", async (c) => {
  const { id } = c.req.param();
  const currentUser = c.get("user" as never) as SessionUser;
  const body = await c.req.json();
  const parsed = uploadSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: "Validation error", details: parsed.error.flatten().fieldErrors }, 400);

  const submission = await db.query.submissions.findFirst({ where: eq(submissions.id, id) });
  if (!submission) return c.json({ error: "Not found" }, 404);
  if (submission.authorId !== currentUser.id && !hasRole(currentUser, "ADMIN", "PROGRAM_CHAIR")) {
    return c.json({ error: "Forbidden" }, 403);
  }

  const { fileName, mimeType, fileSize, kind } = parsed.data;
  const kindMap = { MANUSCRIPT: "manuscript", SUPPLEMENTARY: "supplementary", CAMERA_READY: "camera-ready" } as const;
  const fileKey = generateFileKey(id, fileName, kindMap[kind]);

  try {
    const uploadUrl = await getUploadUrl(fileKey, mimeType);
    return c.json({ uploadUrl, fileKey });
  } catch {
    return c.json({ error: "File storage not configured" }, 503);
  }
});

// POST /api/submissions/:id/confirm-upload
const confirmUploadSchema = z.object({
  fileKey: z.string().min(1),
  fileName: z.string().min(1),
  mimeType: z.string().min(1),
  fileSize: z.number().positive(),
  kind: z.enum(["MANUSCRIPT", "SUPPLEMENTARY", "CAMERA_READY"]),
});

app.post("/:id/confirm-upload", async (c) => {
  const { id } = c.req.param();
  const currentUser = c.get("user" as never) as SessionUser;
  const body = await c.req.json();
  const parsed = confirmUploadSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: "Validation error" }, 400);

  const submission = await db.query.submissions.findFirst({ where: eq(submissions.id, id) });
  if (!submission) return c.json({ error: "Not found" }, 404);
  if (submission.authorId !== currentUser.id && !hasRole(currentUser, "ADMIN", "PROGRAM_CHAIR")) {
    return c.json({ error: "Forbidden" }, 403);
  }

  const { fileKey, fileName, mimeType, fileSize, kind } = parsed.data;

  const [file] = await db
    .insert(storedFiles)
    .values({
      originalName: fileName,
      storedKey: fileKey,
      mimeType,
      size: fileSize,
      kind,
      submissionId: id,
      uploadedById: currentUser.id,
    })
    .returning();

  if (kind === "MANUSCRIPT") {
    await db.update(submissions).set({ fileUrl: fileKey, updatedAt: new Date() }).where(eq(submissions.id, id));
  } else if (kind === "CAMERA_READY") {
    await db
      .update(submissions)
      .set({ cameraReadyUrl: fileKey, status: "CAMERA_READY_SUBMITTED", updatedAt: new Date() })
      .where(eq(submissions.id, id));
  }

  return c.json({ file }, 201);
});

// GET /api/submissions/:id/files
app.get("/:id/files", async (c) => {
  const { id } = c.req.param();
  const currentUser = c.get("user" as never) as SessionUser;

  const submission = await db.query.submissions.findFirst({ where: eq(submissions.id, id) });
  if (!submission) return c.json({ error: "Not found" }, 404);
  if (submission.authorId !== currentUser.id && !hasRole(currentUser, "ADMIN", "PROGRAM_CHAIR", "REVIEWER")) {
    return c.json({ error: "Forbidden" }, 403);
  }

  const files = await db.select().from(storedFiles).where(eq(storedFiles.submissionId, id));
  return c.json({ files });
});

// GET /api/submissions/:id/file-url
app.get("/:id/file-url", async (c) => {
  const { id } = c.req.param();
  const currentUser = c.get("user" as never) as SessionUser;

  const submission = await db.query.submissions.findFirst({
    where: eq(submissions.id, id),
    columns: { fileUrl: true, authorId: true },
  });
  if (!submission?.fileUrl) return c.json({ error: "No file" }, 404);

  // Authorization check
  if (submission.authorId !== currentUser.id && !hasRole(currentUser, "ADMIN", "PROGRAM_CHAIR", "REVIEWER")) {
    return c.json({ error: "Forbidden" }, 403);
  }

  try {
    const url = await getDownloadUrl(submission.fileUrl);
    return c.json({ url });
  } catch {
    return c.json({ error: "File storage not configured" }, 503);
  }
});

// GET /api/submissions/:id/download/:fileId
app.get("/:id/download/:fileId", async (c) => {
  const { id, fileId } = c.req.param();
  const currentUser = c.get("user" as never) as SessionUser;

  const submission = await db.query.submissions.findFirst({ where: eq(submissions.id, id) });
  if (!submission) return c.json({ error: "Not found" }, 404);
  if (submission.authorId !== currentUser.id && !hasRole(currentUser, "ADMIN", "PROGRAM_CHAIR", "REVIEWER")) {
    return c.json({ error: "Forbidden" }, 403);
  }

  const file = await db.query.storedFiles.findFirst({
    where: and(eq(storedFiles.id, fileId), eq(storedFiles.submissionId, id)),
  });
  if (!file) return c.json({ error: "File not found" }, 404);

  try {
    const url = await getDownloadUrl(file.storedKey);
    return c.json({ url, fileName: file.originalName });
  } catch {
    return c.json({ error: "File storage not configured" }, 503);
  }
});

// POST /api/submissions/:id/conflicts — M7: require REVIEWER+ role and validate
app.post("/:id/conflicts", async (c) => {
  const { id } = c.req.param();
  const currentUser = c.get("user" as never) as SessionUser;

  if (!hasRole(currentUser, "REVIEWER", "ADMIN", "PROGRAM_CHAIR")) {
    return c.json({ error: "Forbidden — only reviewers can declare conflicts" }, 403);
  }

  const body = await c.req.json();
  const conflictSchema = z.object({
    reason: z.string().max(2000).optional(),
  });
  const parsed = conflictSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: "Validation error" }, 400);

  const { conflicts } = await import("@/server/db/schema");

  const [conflict] = await db.insert(conflicts).values({ submissionId: id, userId: currentUser.id, reason: parsed.data.reason }).returning();
  return c.json({ conflict }, 201);
});

// POST /api/submissions/:id/bids
app.post("/:id/bids", async (c) => {
  const { id } = c.req.param();
  const currentUser = c.get("user" as never) as SessionUser;

  // Only reviewers can bid
  if (!hasRole(currentUser, "REVIEWER", "ADMIN", "PROGRAM_CHAIR")) {
    return c.json({ error: "Forbidden — only reviewers can bid" }, 403);
  }

  const { preference } = await c.req.json();
  const validPrefs = ["EAGER", "WILLING", "NEUTRAL", "NOT_PREFERRED", "CONFLICT"];
  if (!validPrefs.includes(preference)) return c.json({ error: "Invalid preference" }, 400);

  const { bids } = await import("@/server/db/schema");

  const existing = await db.query.bids.findFirst({
    where: and(eq(bids.submissionId, id), eq(bids.reviewerId, currentUser.id)),
  });

  if (existing) {
    await db.update(bids).set({ preference }).where(eq(bids.id, existing.id));
    return c.json({ ok: true, updated: true });
  }

  const [bid] = await db.insert(bids).values({ submissionId: id, reviewerId: currentUser.id, preference }).returning();
  return c.json({ bid }, 201);
});

// POST /api/submissions/:id/discussion — M4: validate visibility enum
app.post("/:id/discussion", async (c) => {
  const { id } = c.req.param();
  const currentUser = c.get("user" as never) as SessionUser;
  const body = await c.req.json();

  const discussionSchema = z.object({
    message: z.string().min(1, "Message required").max(5000),
    visibility: z.enum(["REVIEWERS_ONLY", "AUTHOR_VISIBLE", "CHAIRS_ONLY"]).default("REVIEWERS_ONLY"),
  });
  const parsed = discussionSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: "Validation error" }, 400);

  const { discussions } = await import("@/server/db/schema");

  const [disc] = await db
    .insert(discussions)
    .values({ submissionId: id, authorId: currentUser.id, message: parsed.data.message, visibility: parsed.data.visibility })
    .returning();

  return c.json({ discussion: disc }, 201);
});

export { app as submissionRoutes };
