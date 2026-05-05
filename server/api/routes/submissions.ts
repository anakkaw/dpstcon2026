import { OpenAPIHono } from "@hono/zod-openapi";
import { createHmac, timingSafeEqual } from "node:crypto";
import { db } from "@/server/db";
import {
  submissions,
  coAuthors,
  tracks,
  reviewAssignments,
  storedFiles,
  reviews,
  decisions,
  conflicts,
  bids,
  discussions,
  presentationAssignments,
  presentationCommitteeAssignments,
  presentationEvaluations,
  posterSlotJudges,
} from "@/server/db/schema";
import { eq, desc, and, ne, sql, inArray } from "drizzle-orm";
import { authMiddleware } from "../middleware/auth";
import type { AuthEnv } from "../middleware/auth";
import { z } from "zod";
import { getUploadUrl, getDownloadUrl, generateFileKey, deleteFile } from "@/server/r2";
import { getTrackRoleIds, hasTrackRole, hasRole } from "@/lib/permissions";
import {
  canRevealReviewerIdentity,
  getAllowedDiscussionVisibilities,
  type SubmissionAccessFlags,
} from "@/server/access-policies";
import {
  ensureSubmissionPaperCode,
  generateMissingPaperCodes,
  isPaperCodeAvailable,
} from "@/server/paper-code-service";
import {
  canAuthorEditSubmission,
  canAuthorUploadSubmissionFile,
  getSubmissionValidationError,
} from "@/server/submission-workflow";
import { advisorApprovalEmail, queueEmail } from "@/server/email";

const app = new OpenAPIHono<AuthEnv>();

const FILE_KIND_PATHS = {
  MANUSCRIPT: "manuscript",
  SUPPLEMENTARY: "supplementary",
  CAMERA_READY: "camera-ready",
  REVIEW_ATTACHMENT: "review-attachments",
} as const;

const MAX_UPLOAD_SIZE = 50 * 1024 * 1024;
const UPLOAD_TOKEN_TTL_MS = 15 * 60 * 1000;

function hasAuthorSubmissionRole(currentUser: AuthEnv["Variables"]["user"]) {
  return hasRole(currentUser, "AUTHOR");
}

type UploadTokenPayload = {
  submissionId: string;
  userId: string;
  fileKey: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  kind: keyof typeof FILE_KIND_PATHS;
  expiresAt: number;
};

function getUploadTokenSecret() {
  return process.env.BETTER_AUTH_SECRET || process.env.AUTH_SECRET;
}

function sanitizeFileName(fileName: string) {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
}

function signUploadToken(payload: UploadTokenPayload) {
  const secret = getUploadTokenSecret();
  if (!secret) return null;

  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = createHmac("sha256", secret).update(encodedPayload).digest("base64url");
  return `${encodedPayload}.${signature}`;
}

function verifyUploadToken(token: string) {
  const secret = getUploadTokenSecret();
  if (!secret) return null;

  const [encodedPayload, signature] = token.split(".");
  if (!encodedPayload || !signature) return null;

  const expectedSignature = createHmac("sha256", secret).update(encodedPayload).digest("base64url");
  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSignature);

  if (
    signatureBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(signatureBuffer, expectedBuffer)
  ) {
    return null;
  }

  try {
    const payload = JSON.parse(
      Buffer.from(encodedPayload, "base64url").toString("utf8")
    ) as UploadTokenPayload;

    if (payload.expiresAt < Date.now()) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

function matchesExpectedFileKey(
  submissionId: string,
  kind: keyof typeof FILE_KIND_PATHS,
  fileName: string,
  fileKey: string
) {
  const expectedPrefix = `submissions/${submissionId}/${FILE_KIND_PATHS[kind]}/`;
  const expectedSuffix = `-${sanitizeFileName(fileName)}`;
  return fileKey.startsWith(expectedPrefix) && fileKey.endsWith(expectedSuffix);
}

async function getLatestStoredKeyForKind(
  submissionId: string,
  kind: "MANUSCRIPT" | "CAMERA_READY",
  excludingFileId: string
) {
  const [replacement] = await db
    .select({ storedKey: storedFiles.storedKey })
    .from(storedFiles)
    .where(
      and(
        eq(storedFiles.submissionId, submissionId),
        eq(storedFiles.kind, kind),
        ne(storedFiles.id, excludingFileId)
      )
    )
    .orderBy(desc(storedFiles.uploadedAt), desc(storedFiles.id))
    .limit(1);

  return replacement?.storedKey ?? null;
}

async function deleteSubmissionCascade(submissionId: string) {
  // Collect file keys before deleting DB records so we can clean up R2 afterwards
  const files = await db
    .select({ id: storedFiles.id, storedKey: storedFiles.storedKey })
    .from(storedFiles)
    .where(eq(storedFiles.submissionId, submissionId));

  // 1. Delete presentation-related children (must happen before presentation_assignments)
  const presentationRows = await db
    .select({ id: presentationAssignments.id })
    .from(presentationAssignments)
    .where(eq(presentationAssignments.submissionId, submissionId));

  if (presentationRows.length > 0) {
    const presentationIds = presentationRows.map((row) => row.id);
    await Promise.all([
      db.delete(presentationEvaluations).where(inArray(presentationEvaluations.presentationId, presentationIds)),
      db.delete(presentationCommitteeAssignments).where(inArray(presentationCommitteeAssignments.presentationId, presentationIds)),
    ]);
    await db.delete(presentationAssignments).where(inArray(presentationAssignments.id, presentationIds));
  }

  // 2. Delete all FK-constrained children in parallel (all reference submissionId directly)
  await Promise.all([
    db.delete(storedFiles).where(eq(storedFiles.submissionId, submissionId)),
    db.delete(posterSlotJudges).where(eq(posterSlotJudges.submissionId, submissionId)),
    db.delete(reviews).where(eq(reviews.submissionId, submissionId)),
    db.delete(reviewAssignments).where(eq(reviewAssignments.submissionId, submissionId)),
    db.delete(decisions).where(eq(decisions.submissionId, submissionId)),
    db.delete(conflicts).where(eq(conflicts.submissionId, submissionId)),
    db.delete(bids).where(eq(bids.submissionId, submissionId)),
    db.delete(discussions).where(eq(discussions.submissionId, submissionId)),
    db.delete(coAuthors).where(eq(coAuthors.submissionId, submissionId)),
  ]);

  // 3. Delete the parent submission last
  await db.delete(submissions).where(eq(submissions.id, submissionId));

  // 4. Best-effort R2 cleanup (log failures but don't throw — DB is already consistent)
  await Promise.allSettled(
    files.map(async (file) => {
      try {
        await deleteFile(file.storedKey);
      } catch (error) {
        console.error("[submissions.deleteSubmission] Failed to remove object from storage", {
          submissionId,
          fileId: file.id,
          storedKey: file.storedKey,
          error,
        });
      }
    })
  );
}

async function canAccessSubmission(
  currentUser: AuthEnv["Variables"]["user"],
  submission: { id: string; authorId: string; trackId: string | null }
) {
  if (hasRole(currentUser, "ADMIN")) return true;
  if (submission.authorId === currentUser.id) return true;

  if (hasRole(currentUser, "REVIEWER")) {
    const assignment = await db.query.reviewAssignments.findFirst({
      where: and(
        eq(reviewAssignments.submissionId, submission.id),
        eq(reviewAssignments.reviewerId, currentUser.id)
      ),
      columns: { id: true },
    });

    if (assignment) return true;
  }

  if (hasRole(currentUser, "PROGRAM_CHAIR") && submission.trackId) {
    if (hasTrackRole(currentUser, submission.trackId, "PROGRAM_CHAIR")) return true;
  }

  return false;
}

function canManageSubmissionAsStaff(
  currentUser: AuthEnv["Variables"]["user"],
  submission: { trackId: string | null }
) {
  if (hasRole(currentUser, "ADMIN")) {
    return true;
  }

  return (
    !!submission.trackId &&
    hasTrackRole(currentUser, submission.trackId, "PROGRAM_CHAIR")
  );
}

async function getSubmissionAccessFlags(
  currentUser: AuthEnv["Variables"]["user"],
  submission: { id: string; authorId: string; trackId: string | null }
): Promise<SubmissionAccessFlags> {
  const isAdmin = hasRole(currentUser, "ADMIN");
  const isAuthor = submission.authorId === currentUser.id;

  let isAssignedReviewer = false;
  if (hasRole(currentUser, "REVIEWER")) {
    const assignment = await db.query.reviewAssignments.findFirst({
      where: and(
        eq(reviewAssignments.submissionId, submission.id),
        eq(reviewAssignments.reviewerId, currentUser.id)
      ),
      columns: { id: true },
    });

    isAssignedReviewer = !!assignment;
  }

  let isTrackHead = false;
  if (submission.trackId) {
    isTrackHead = hasTrackRole(currentUser, submission.trackId, "PROGRAM_CHAIR");
  }

  return {
    isAdmin,
    isTrackHead,
    isAssignedReviewer,
    isAuthor,
  };
}

app.use("/*", authMiddleware);

// GET /api/submissions/tracks — list all tracks (for submission form)
app.get("/tracks", async (c) => {
  const allTracks = await db.select().from(tracks);
  return c.json({ tracks: allTracks });
});

// GET /api/submissions — multi-role aware listing
app.get("/", async (c) => {
  const currentUser = c.get("user");

  // ADMIN sees everything
  if (hasRole(currentUser, "ADMIN")) {
    const results = await db.query.submissions.findMany({
      with: {
        author: { columns: { id: true, name: true, email: true, prefixTh: true, firstNameTh: true, lastNameTh: true, prefixEn: true, firstNameEn: true, lastNameEn: true } },
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
    const trackIds = getTrackRoleIds(currentUser, "PROGRAM_CHAIR");
    roleFetches.push(
      Promise.resolve().then(async () => {
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

  // Owners should always see their own submissions, even if an AUTHOR role assignment is missing.
  roleFetches.push(
    db.select({ id: submissions.id }).from(submissions).where(eq(submissions.authorId, currentUser.id))
      .then((rows) => rows.forEach((s) => submissionIds.add(s.id)))
  );

  await Promise.all(roleFetches);

  // COMMITTEE only: no submissions access
  if (submissionIds.size === 0) {
    return c.json({ submissions: [] });
  }

  const ids = Array.from(submissionIds);
  const results = await db.query.submissions.findMany({
    where: sql`${submissions.id} IN ${ids}`,
    with: {
      author: { columns: { id: true, name: true, email: true, prefixTh: true, firstNameTh: true, lastNameTh: true, prefixEn: true, firstNameEn: true, lastNameEn: true } },
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
  const currentUser = c.get("user");

  const submission = await db.query.submissions.findFirst({
    where: eq(submissions.id, id),
    with: {
      author: { columns: { id: true, name: true, email: true, affiliation: true, prefixTh: true, firstNameTh: true, lastNameTh: true, prefixEn: true, firstNameEn: true, lastNameEn: true } },
      track: { columns: { id: true, name: true } },
      coAuthors: true,
      reviews: {
        with: { reviewer: { columns: { id: true, name: true, prefixTh: true, firstNameTh: true, lastNameTh: true, prefixEn: true, firstNameEn: true, lastNameEn: true } } },
      },
      discussions: {
        with: { author: { columns: { id: true, name: true, prefixTh: true, firstNameTh: true, lastNameTh: true, prefixEn: true, firstNameEn: true, lastNameEn: true } } },
      },
    },
  });

  if (!submission) return c.json({ error: "Not found" }, 404);

  const access = await getSubmissionAccessFlags(currentUser, submission);

  // Use access flags directly instead of calling canAccessSubmission (which would re-query reviewAssignments)
  if (!access.isAdmin && !access.isAuthor && !access.isAssignedReviewer && !access.isTrackHead) {
    return c.json({ error: "Forbidden" }, 403);
  }

  let filteredDiscussions = submission.discussions;
  let filteredReviews = submission.reviews;

  // If user is ONLY an author (not also reviewer/chair/admin for this submission)
  const shouldHideReviewerIdentity =
    access.isAuthor && !canRevealReviewerIdentity(access);

  if (shouldHideReviewerIdentity) {
    filteredDiscussions = submission.discussions.filter(
      (d) => d.visibility === "AUTHOR_VISIBLE"
    );
    filteredReviews = submission.reviews.map((r) => ({
      ...r,
      reviewer: { id: "", name: "", prefixTh: null, firstNameTh: null, lastNameTh: null, prefixEn: null, firstNameEn: null, lastNameEn: null },
      commentsToChair: null,
    }));
  }

  return c.json({ submission: { ...submission, discussions: filteredDiscussions, reviews: filteredReviews } });
});

// POST /api/submissions
const createSchema = z.object({
  title: z.string().min(1).max(500),
  titleEn: z.string().min(1).max(500),
  abstract: z.string().min(1),
  abstractEn: z.string().min(1),
  keywords: z.string().optional(),
  keywordsEn: z.string().optional(),
  trackId: z.string().uuid(),
  advisorEmail: z.string().email(),
  advisorName: z.string().min(1),
  coAuthors: z
    .array(z.object({ name: z.string(), email: z.string().email().optional(), affiliation: z.string().optional() }))
    .optional(),
});

app.post("/", async (c) => {
  const currentUser = c.get("user");
  if (!hasAuthorSubmissionRole(currentUser)) {
    return c.json({ error: "Forbidden — only authors can create submissions" }, 403);
  }
  const body = await c.req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: "Validation error", details: parsed.error.flatten().fieldErrors }, 400);

  const data = parsed.data;

  const [submission] = await db
    .insert(submissions)
    .values({
      authorId: currentUser.id,
      title: data.title,
      titleEn: data.titleEn,
      abstract: data.abstract,
      abstractEn: data.abstractEn,
      keywords: data.keywords,
      keywordsEn: data.keywordsEn,
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
  const currentUser = c.get("user");
  const body = await c.req.json();

  // Validate allowed fields to prevent mass assignment
  const patchSchema = z.object({
    title: z.string().min(1).max(500).optional(),
    titleEn: z.string().max(500).optional(),
    abstract: z.string().optional(),
    abstractEn: z.string().optional(),
    keywords: z.string().optional(),
    keywordsEn: z.string().optional(),
    trackId: z.string().uuid().optional(),
    advisorEmail: z.string().email().optional(),
    advisorName: z.string().optional(),
    advisorApprovalStatus: z.enum(["NOT_REQUESTED", "PENDING", "APPROVED", "REJECTED"]).optional(),
    sendAdvisorEmail: z.boolean().optional(),
    paperCode: z.string().trim().min(1).max(32).optional(),
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
  const canManageAsStaff = canManageSubmissionAsStaff(currentUser, existing);
  if (existing.authorId !== currentUser.id && !canManageAsStaff) {
    return c.json({ error: "Forbidden" }, 403);
  }
  if (
    existing.authorId === currentUser.id &&
    !canManageAsStaff &&
    (!hasAuthorSubmissionRole(currentUser) || !canAuthorEditSubmission(existing.status))
  ) {
    return c.json({ error: "Authors can only edit submission metadata while the paper is in draft" }, 403);
  }
  if (parsed.data.status && !canManageAsStaff) {
    return c.json({ error: "Forbidden — only chairs can change status" }, 403);
  }
  if (parsed.data.paperCode && !canManageAsStaff) {
    return c.json({ error: "Forbidden — only chairs can change Paper ID" }, 403);
  }
  if (parsed.data.advisorApprovalStatus && !canManageAsStaff) {
    return c.json({ error: "Forbidden — only chairs can override advisor status" }, 403);
  }
  if (parsed.data.sendAdvisorEmail && !canManageAsStaff) {
    return c.json({ error: "Forbidden — only chairs can trigger advisor emails" }, 403);
  }

  const normalizedPaperCode = parsed.data.paperCode?.toUpperCase();
  if (normalizedPaperCode) {
    const isAvailable = await isPaperCodeAvailable(normalizedPaperCode, id);
    if (!isAvailable) {
      return c.json({ error: "Paper ID นี้ถูกใช้งานแล้ว" }, 409);
    }
  }

  // Build the update payload — exclude non-column fields
  const { sendAdvisorEmail: shouldSendEmail, ...patchFields } = parsed.data;
  const updatePayload: Record<string, unknown> = {
    ...patchFields,
    paperCode: normalizedPaperCode,
    updatedAt: new Date(),
  };

  // Side-effect: advisor approval status override by admin
  if (parsed.data.advisorApprovalStatus && canManageAsStaff) {
    updatePayload.advisorApprovalAt = new Date();
    updatePayload.advisorApprovalToken = null;

    if (parsed.data.advisorApprovalStatus === "APPROVED" && existing.status === "ADVISOR_APPROVAL_PENDING") {
      updatePayload.status = "SUBMITTED";
    } else if (parsed.data.advisorApprovalStatus === "REJECTED" && existing.status === "ADVISOR_APPROVAL_PENDING") {
      updatePayload.status = "DRAFT";
    }
  }

  // Side-effect: send advisor email when requested (e.g. after changing advisor email)
  if (shouldSendEmail && canManageAsStaff && (parsed.data.advisorEmail || existing.advisorEmail)) {
    const advisorToken = crypto.randomUUID();
    updatePayload.advisorApprovalToken = advisorToken;
    updatePayload.advisorApprovalStatus = "PENDING";
    updatePayload.advisorApprovalAt = null;
    updatePayload.submittedAt = new Date();
    if (existing.status === "DRAFT" || existing.status === "ADVISOR_APPROVAL_PENDING") {
      updatePayload.status = "ADVISOR_APPROVAL_PENDING";
    }

    const targetEmail = parsed.data.advisorEmail || existing.advisorEmail!;
    const targetName = parsed.data.advisorName || existing.advisorName || "Advisor";
    const appUrl = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

    const authorData = await db.query.submissions.findFirst({
      where: eq(submissions.id, id),
      with: { author: { columns: { name: true } } },
    });

    const emailContent = advisorApprovalEmail({
      advisorName: targetName,
      studentName: authorData?.author.name || "Student",
      paperTitle: existing.title,
      approvalUrl: `${appUrl}/advisor-approval/${advisorToken}`,
    });

    try {
      await queueEmail({
        to: targetEmail,
        subject: emailContent.subject,
        html: emailContent.html,
        text: emailContent.text,
        throwOnFailure: true,
      });
    } catch {
      return c.json({ error: "ไม่สามารถส่งอีเมลถึงอาจารย์ที่ปรึกษาได้" }, 500);
    }
  }

  const [updated] = await db
    .update(submissions)
    .set(updatePayload)
    .where(eq(submissions.id, id))
    .returning();

  if (
    updated &&
    ["ACCEPTED", "CAMERA_READY_PENDING", "CAMERA_READY_SUBMITTED"].includes(updated.status) &&
    !updated.paperCode
  ) {
    updated.paperCode = await ensureSubmissionPaperCode(updated.id);
  }

  return c.json({ submission: updated });
});

app.post("/paper-codes/generate", async (c) => {
  const currentUser = c.get("user");

  if (!hasRole(currentUser, "ADMIN", "PROGRAM_CHAIR")) {
    return c.json({ error: "Forbidden" }, 403);
  }

  const updated = await generateMissingPaperCodes();
  return c.json({ updated, count: updated.length });
});

// POST /api/submissions/:id/submit
app.post("/:id/submit", async (c) => {
  const { id } = c.req.param();
  const currentUser = c.get("user");

  const submission = await db.query.submissions.findFirst({ where: eq(submissions.id, id) });
  if (!submission) return c.json({ error: "Not found" }, 404);
  if (submission.authorId !== currentUser.id) return c.json({ error: "Forbidden" }, 403);
  if (!hasAuthorSubmissionRole(currentUser)) {
    return c.json({ error: "Forbidden — only authors can submit papers" }, 403);
  }
  if (submission.status !== "DRAFT") return c.json({ error: "Can only submit from DRAFT" }, 400);
  const { hasFileOfKind } = await import("@/server/stored-files-helpers");
  const hasManuscript = await hasFileOfKind(id, "MANUSCRIPT");
  const validationError = getSubmissionValidationError({
    title: submission.title,
    titleEn: submission.titleEn,
    abstract: submission.abstract,
    abstractEn: submission.abstractEn,
    trackId: submission.trackId,
    advisorEmail: submission.advisorEmail,
    advisorName: submission.advisorName,
    hasManuscript,
  });
  if (validationError) return c.json({ error: validationError }, 400);

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

  const appUrl = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
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
    text: emailContent.text,
    throwOnFailure: true,
  });

  return c.json({ submission: updated });
});

// POST /api/submissions/:id/resend-advisor-approval
app.post("/:id/resend-advisor-approval", async (c) => {
  const { id } = c.req.param();
  const currentUser = c.get("user");

  const submission = await db.query.submissions.findFirst({
    where: eq(submissions.id, id),
    with: {
      author: { columns: { name: true } },
    },
  });
  if (!submission) return c.json({ error: "Not found" }, 404);

  const isStaff = canManageSubmissionAsStaff(currentUser, submission);
  const isOwner = submission.authorId === currentUser.id;
  if (!isStaff && (!isOwner || !hasAuthorSubmissionRole(currentUser))) {
    return c.json({ error: "Forbidden" }, 403);
  }

  if (
    submission.status !== "ADVISOR_APPROVAL_PENDING" ||
    submission.advisorApprovalStatus !== "PENDING"
  ) {
    return c.json({ error: "Advisor approval resend is only available while approval is pending" }, 400);
  }

  if (!submission.advisorEmail) {
    return c.json({ error: "ไม่พบอีเมลอาจารย์ที่ปรึกษา" }, 400);
  }

  const advisorToken = crypto.randomUUID();

  // Reset submittedAt to restart the token expiry window on resend.
  // This is intentional: the advisor gets a fresh 14-day window.
  // Only update the token and updatedAt — preserve advisorApprovalStatus (already PENDING).
  await db
    .update(submissions)
    .set({
      advisorApprovalToken: advisorToken,
      submittedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(submissions.id, id));

  const appUrl = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const emailContent = advisorApprovalEmail({
    advisorName: submission.advisorName || "Advisor",
    studentName: submission.author.name,
    paperTitle: submission.title,
    approvalUrl: `${appUrl}/advisor-approval/${advisorToken}`,
  });

  try {
    await queueEmail({
      to: submission.advisorEmail,
      subject: emailContent.subject,
      html: emailContent.html,
      text: emailContent.text,
      throwOnFailure: true,
    });
  } catch {
    return c.json({ error: "ไม่สามารถส่งอีเมลถึงอาจารย์ที่ปรึกษาได้" }, 500);
  }

  return c.json({ ok: true });
});

// POST /api/submissions/:id/resubmit
app.post("/:id/resubmit", async (c) => {
  const { id } = c.req.param();
  const currentUser = c.get("user");

  const submission = await db.query.submissions.findFirst({ where: eq(submissions.id, id) });
  if (!submission) return c.json({ error: "Not found" }, 404);
  if (submission.authorId !== currentUser.id) return c.json({ error: "Forbidden" }, 403);
  if (!hasAuthorSubmissionRole(currentUser)) {
    return c.json({ error: "Forbidden — only authors can resubmit papers" }, 403);
  }
  if (submission.status !== "REVISION_REQUIRED") return c.json({ error: "Can only resubmit from REVISION_REQUIRED" }, 400);

  const now = new Date();

  await db
    .update(reviewAssignments)
    .set({
      status: "ACCEPTED",
      respondedAt: null,
      assignedAt: now,
      lastReminderAt: null,
    })
    .where(
      and(
        eq(reviewAssignments.submissionId, id),
        eq(reviewAssignments.status, "COMPLETED")
      )
    );

  const [updated] = await db
    .update(submissions)
    .set({ status: "UNDER_REVIEW", updatedAt: now })
    .where(eq(submissions.id, id))
    .returning();

  return c.json({ submission: updated });
});

// POST /api/submissions/:id/withdraw
app.post("/:id/withdraw", async (c) => {
  const { id } = c.req.param();
  const currentUser = c.get("user");

  const submission = await db.query.submissions.findFirst({ where: eq(submissions.id, id) });
  if (!submission) return c.json({ error: "Not found" }, 404);
  if (submission.authorId !== currentUser.id) return c.json({ error: "Forbidden" }, 403);
  if (!hasAuthorSubmissionRole(currentUser)) {
    return c.json({ error: "Forbidden — only authors can withdraw papers" }, 403);
  }
  if (submission.status === "WITHDRAWN") return c.json({ error: "Already withdrawn" }, 400);

  const [updated] = await db
    .update(submissions)
    .set({ status: "WITHDRAWN", updatedAt: new Date() })
    .where(eq(submissions.id, id))
    .returning();

  return c.json({ submission: updated });
});

// POST /api/submissions/bulk-delete — admin-only bulk delete
app.post("/bulk-delete", async (c) => {
  const currentUser = c.get("user");
  if (!hasRole(currentUser, "ADMIN")) {
    return c.json({ error: "Forbidden" }, 403);
  }

  const body = await c.req.json();
  const ids: string[] = body.ids;
  if (!Array.isArray(ids) || ids.length === 0) {
    return c.json({ error: "ids must be a non-empty array" }, 400);
  }
  if (ids.length > 100) {
    return c.json({ error: "Maximum 100 submissions per request" }, 400);
  }

  const existing = await db.query.submissions.findMany({
    where: inArray(submissions.id, ids),
    columns: { id: true },
  });
  const existingIds = existing.map((s) => s.id);

  for (const id of existingIds) {
    await deleteSubmissionCascade(id);
  }

  return c.json({ ok: true, deletedCount: existingIds.length });
});

// DELETE /api/submissions/:id
app.delete("/:id", async (c) => {
  const { id } = c.req.param();
  const currentUser = c.get("user");

  if (!hasRole(currentUser, "ADMIN")) {
    return c.json({ error: "Forbidden" }, 403);
  }

  const submission = await db.query.submissions.findFirst({
    where: eq(submissions.id, id),
    columns: { id: true },
  });
  if (!submission) return c.json({ error: "Not found" }, 404);

  await deleteSubmissionCascade(id);

  return c.json({ ok: true, deletedSubmissionId: id });
});

// POST /api/submissions/:id/rebuttal — M5: validate rebuttal text
app.post("/:id/rebuttal", async (c) => {
  const { id } = c.req.param();
  const currentUser = c.get("user");
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
  if (!hasAuthorSubmissionRole(currentUser)) {
    return c.json({ error: "Forbidden — only authors can manage rebuttals" }, 403);
  }
  if (submission.status !== "REBUTTAL") return c.json({ error: "Rebuttal not allowed" }, 400);

  const [updated] = await db
    .update(submissions)
    .set({ rebuttalText: text, updatedAt: new Date() })
    .where(eq(submissions.id, id))
    .returning();

  return c.json({ submission: updated });
});

// Legacy POST /api/submissions/:id/camera-ready removed.
// Camera-ready uploads now go through the standard upload-url → confirm-upload flow.

// POST /api/submissions/:id/upload-url
const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/zip",
  "application/x-zip-compressed",
  "image/png",
  "image/jpeg",
] as const;

const uploadSchema = z.object({
  fileName: z.string().min(1),
  mimeType: z.string().min(1).refine(
    (v) => (ALLOWED_MIME_TYPES as readonly string[]).includes(v),
    { message: "ไฟล์ประเภทนี้ไม่ได้รับอนุญาต (อนุญาต: PDF, DOCX, XLSX, ZIP, PNG, JPEG)" }
  ),
  fileSize: z.number().positive().max(MAX_UPLOAD_SIZE),
  kind: z.enum(["MANUSCRIPT", "SUPPLEMENTARY", "CAMERA_READY", "REVIEW_ATTACHMENT"]),
});

async function isAssignedReviewerFor(
  userId: string,
  submissionId: string
) {
  const assignment = await db.query.reviewAssignments.findFirst({
    where: and(
      eq(reviewAssignments.submissionId, submissionId),
      eq(reviewAssignments.reviewerId, userId)
    ),
    columns: { id: true },
  });
  return Boolean(assignment);
}

app.post("/:id/upload-url", async (c) => {
  const { id } = c.req.param();
  const currentUser = c.get("user");
  const body = await c.req.json();
  const parsed = uploadSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: "Validation error", details: parsed.error.flatten().fieldErrors }, 400);

  const submission = await db.query.submissions.findFirst({ where: eq(submissions.id, id) });
  if (!submission) return c.json({ error: "Not found" }, 404);
  const isStaff = canManageSubmissionAsStaff(currentUser, submission);
  const isOwner = submission.authorId === currentUser.id;
  const { fileName, mimeType, kind } = parsed.data;

  if (kind === "REVIEW_ATTACHMENT") {
    const canReviewerUpload =
      hasRole(currentUser, "REVIEWER") &&
      (await isAssignedReviewerFor(currentUser.id, id));
    if (!isStaff && !canReviewerUpload) {
      return c.json({ error: "Forbidden" }, 403);
    }
  } else {
    if (!isStaff && (!isOwner || !hasAuthorSubmissionRole(currentUser))) {
      return c.json({ error: "Forbidden" }, 403);
    }

    if (!isStaff && !canAuthorUploadSubmissionFile(submission.status, kind)) {
      return c.json({ error: "File upload is not allowed in the current submission status" }, 400);
    }
    if (
      kind === "CAMERA_READY" &&
      !["ACCEPTED", "CAMERA_READY_PENDING"].includes(submission.status)
    ) {
      return c.json({ error: "Camera-ready upload is not available for this submission" }, 400);
    }
  }

  const fileKey = generateFileKey(id, fileName, FILE_KIND_PATHS[kind]);
  const uploadToken = signUploadToken({
    submissionId: id,
    userId: currentUser.id,
    fileKey,
    fileName,
    mimeType,
    fileSize: parsed.data.fileSize,
    kind,
    expiresAt: Date.now() + UPLOAD_TOKEN_TTL_MS,
  });

  if (!uploadToken) {
    return c.json({ error: "Upload signing not configured" }, 503);
  }

  try {
    const uploadUrl = await getUploadUrl(fileKey, mimeType);
    return c.json({ uploadUrl, fileKey, uploadToken });
  } catch {
    return c.json({ error: "File storage not configured" }, 503);
  }
});

// POST /api/submissions/:id/confirm-upload
const confirmUploadSchema = z.object({
  fileKey: z.string().min(1),
  fileName: z.string().min(1),
  mimeType: z.string().min(1).refine(
    (v) => (ALLOWED_MIME_TYPES as readonly string[]).includes(v),
    { message: "ไฟล์ประเภทนี้ไม่ได้รับอนุญาต" }
  ),
  fileSize: z.number().positive().max(MAX_UPLOAD_SIZE),
  kind: z.enum(["MANUSCRIPT", "SUPPLEMENTARY", "CAMERA_READY", "REVIEW_ATTACHMENT"]),
  uploadToken: z.string().min(1),
});

app.post("/:id/confirm-upload", async (c) => {
  const { id } = c.req.param();
  const currentUser = c.get("user");
  const body = await c.req.json();
  const parsed = confirmUploadSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: "Validation error" }, 400);

  const submission = await db.query.submissions.findFirst({ where: eq(submissions.id, id) });
  if (!submission) return c.json({ error: "Not found" }, 404);
  const isStaff = canManageSubmissionAsStaff(currentUser, submission);
  const isOwner = submission.authorId === currentUser.id;

  const { fileKey, fileName, mimeType, fileSize, kind, uploadToken } = parsed.data;

  if (kind === "REVIEW_ATTACHMENT") {
    const canReviewerUpload =
      hasRole(currentUser, "REVIEWER") &&
      (await isAssignedReviewerFor(currentUser.id, id));
    if (!isStaff && !canReviewerUpload) {
      return c.json({ error: "Forbidden" }, 403);
    }
  } else if (!isStaff && (!isOwner || !hasAuthorSubmissionRole(currentUser))) {
    return c.json({ error: "Forbidden" }, 403);
  }

  const tokenPayload = verifyUploadToken(uploadToken);

  if (!tokenPayload) {
    return c.json({ error: "Invalid or expired upload token" }, 400);
  }

  if (
    tokenPayload.submissionId !== id ||
    tokenPayload.userId !== currentUser.id ||
    tokenPayload.fileKey !== fileKey ||
    tokenPayload.fileName !== fileName ||
    tokenPayload.mimeType !== mimeType ||
    tokenPayload.fileSize !== fileSize ||
    tokenPayload.kind !== kind
  ) {
    return c.json({ error: "Upload confirmation does not match the requested upload" }, 400);
  }

  if (!matchesExpectedFileKey(id, kind, fileName, fileKey)) {
    return c.json({ error: "Invalid file key" }, 400);
  }

  if (kind !== "REVIEW_ATTACHMENT") {
    if (!isStaff && !canAuthorUploadSubmissionFile(submission.status, kind)) {
      return c.json({ error: "File upload is not allowed in the current submission status" }, 400);
    }

    if (
      kind === "CAMERA_READY" &&
      !["ACCEPTED", "CAMERA_READY_PENDING"].includes(submission.status)
    ) {
      return c.json({ error: "Camera-ready upload is not allowed in the current status" }, 400);
    }
  }

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

  // Update submission timestamp; advance status for camera-ready uploads
  if (kind === "CAMERA_READY") {
    await db.update(submissions).set({ status: "CAMERA_READY_SUBMITTED", updatedAt: new Date() }).where(eq(submissions.id, id));
  } else {
    await db.update(submissions).set({ updatedAt: new Date() }).where(eq(submissions.id, id));
  }

  return c.json({ file }, 201);
});

// GET /api/submissions/:id/files
app.get("/:id/files", async (c) => {
  const { id } = c.req.param();
  const currentUser = c.get("user");

  const submission = await db.query.submissions.findFirst({ where: eq(submissions.id, id) });
  if (!submission) return c.json({ error: "Not found" }, 404);
  if (!(await canAccessSubmission(currentUser, submission))) {
    return c.json({ error: "Forbidden" }, 403);
  }

  const rows = await db.select().from(storedFiles).where(eq(storedFiles.submissionId, id));
  const isStaff = canManageSubmissionAsStaff(currentUser, submission);
  const files = rows.filter((f) => {
    if (f.kind !== "REVIEW_ATTACHMENT") return true;
    if (isStaff) return true;
    return f.uploadedById === currentUser.id;
  });
  return c.json({ files });
});

// GET /api/submissions/:id/file-url
app.get("/:id/file-url", async (c) => {
  const { id } = c.req.param();
  const currentUser = c.get("user");

  const submission = await db.query.submissions.findFirst({
    where: eq(submissions.id, id),
    columns: { id: true, authorId: true, trackId: true },
  });
  if (!submission) return c.json({ error: "Not found" }, 404);

  if (!(await canAccessSubmission(currentUser, submission))) {
    return c.json({ error: "Forbidden" }, 403);
  }

  const { getLatestFileKey } = await import("@/server/stored-files-helpers");
  const fileKey = await getLatestFileKey(id, "MANUSCRIPT");
  if (!fileKey) return c.json({ error: "No file" }, 404);

  try {
    const url = await getDownloadUrl(fileKey);
    return c.json({ url });
  } catch {
    return c.json({ error: "File storage not configured" }, 503);
  }
});

// GET /api/submissions/:id/download/:fileId
app.get("/:id/download/:fileId", async (c) => {
  const { id, fileId } = c.req.param();
  const currentUser = c.get("user");

  const submission = await db.query.submissions.findFirst({ where: eq(submissions.id, id) });
  if (!submission) return c.json({ error: "Not found" }, 404);
  if (!(await canAccessSubmission(currentUser, submission))) {
    return c.json({ error: "Forbidden" }, 403);
  }

  const file = await db.query.storedFiles.findFirst({
    where: and(eq(storedFiles.id, fileId), eq(storedFiles.submissionId, id)),
  });
  if (!file) return c.json({ error: "File not found" }, 404);

  // Gate REVIEW_ATTACHMENT to uploader and staff (not author, not other reviewers)
  if (file.kind === "REVIEW_ATTACHMENT") {
    const isStaff = canManageSubmissionAsStaff(currentUser, submission);
    const isUploader = file.uploadedById === currentUser.id;
    if (!isStaff && !isUploader) {
      return c.json({ error: "Forbidden" }, 403);
    }
  }

  try {
    const url = await getDownloadUrl(file.storedKey);
    return c.json({ url, fileName: file.originalName });
  } catch {
    return c.json({ error: "File storage not configured" }, 503);
  }
});

// DELETE /api/submissions/:id/files/:fileId
app.delete("/:id/files/:fileId", async (c) => {
  const { id, fileId } = c.req.param();
  const currentUser = c.get("user");

  const submission = await db.query.submissions.findFirst({ where: eq(submissions.id, id) });
  if (!submission) return c.json({ error: "Not found" }, 404);

  const canManageAsStaff = canManageSubmissionAsStaff(currentUser, submission);
  const canManageOwnDraft =
    submission.authorId === currentUser.id &&
    submission.status === "DRAFT" &&
    hasAuthorSubmissionRole(currentUser);

  const file = await db.query.storedFiles.findFirst({
    where: and(eq(storedFiles.id, fileId), eq(storedFiles.submissionId, id)),
  });
  if (!file) return c.json({ error: "File not found" }, 404);

  // Reviewers can delete their own REVIEW_ATTACHMENT files
  const canReviewerDeleteOwn =
    file.kind === "REVIEW_ATTACHMENT" &&
    file.uploadedById === currentUser.id;

  if (!canManageAsStaff && !canManageOwnDraft && !canReviewerDeleteOwn) {
    return c.json({ error: "Forbidden" }, 403);
  }

  // When deleting a camera-ready file, revert status if no other camera-ready remains
  if (file.kind === "CAMERA_READY") {
    const nextCameraReadyKey = await getLatestStoredKeyForKind(id, "CAMERA_READY", file.id);
    await db
      .update(submissions)
      .set({
        status: nextCameraReadyKey ? submission.status : "CAMERA_READY_PENDING",
        updatedAt: new Date(),
      })
      .where(eq(submissions.id, id));
  } else {
    await db.update(submissions).set({ updatedAt: new Date() }).where(eq(submissions.id, id));
  }

  await db.delete(storedFiles).where(eq(storedFiles.id, file.id));

  try {
    await deleteFile(file.storedKey);
  } catch (error) {
    console.error("[submissions.deleteFile] Failed to remove object from storage", {
      fileId: file.id,
      storedKey: file.storedKey,
      error,
    });
  }

  return c.json({ ok: true, deletedFileId: file.id });
});

// POST /api/submissions/:id/conflicts — M7: require REVIEWER+ role and validate
app.post("/:id/conflicts", async (c) => {
  const { id } = c.req.param();
  const currentUser = c.get("user");

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
  const currentUser = c.get("user");

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
  const currentUser = c.get("user");
  const body = await c.req.json();

  const discussionSchema = z.object({
    message: z.string().min(1, "Message required").max(5000),
    visibility: z.enum(["REVIEWERS_ONLY", "AUTHOR_VISIBLE", "CHAIRS_ONLY"]).default("REVIEWERS_ONLY"),
  });
  const parsed = discussionSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: "Validation error" }, 400);

  const submission = await db.query.submissions.findFirst({
    where: eq(submissions.id, id),
    columns: { id: true, authorId: true, trackId: true },
  });

  if (!submission) return c.json({ error: "Not found" }, 404);

  const access = await getSubmissionAccessFlags(currentUser, submission);
  if (!Object.values(access).some(Boolean)) {
    return c.json({ error: "Forbidden" }, 403);
  }

  const allowedVisibilities = getAllowedDiscussionVisibilities(access);
  if (!allowedVisibilities.has(parsed.data.visibility)) {
    return c.json({ error: "Forbidden" }, 403);
  }

  const { discussions } = await import("@/server/db/schema");

  const [disc] = await db
    .insert(discussions)
    .values({ submissionId: id, authorId: currentUser.id, message: parsed.data.message, visibility: parsed.data.visibility })
    .returning();

  return c.json({ discussion: disc }, 201);
});

export { app as submissionRoutes };
