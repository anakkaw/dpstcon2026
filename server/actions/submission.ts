"use server";

import { db } from "@/server/db";
import { submissions, reviewAssignments } from "@/server/db/schema";
import { eq, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireActiveServerAuthContext } from "@/server/auth-helpers";
import { advisorApprovalEmail, queueEmail } from "@/server/email";
import { canAuthorEditSubmission, getSubmissionValidationError } from "@/server/submission-workflow";

export async function createSubmission(formData: FormData) {
  const { session } = await requireActiveServerAuthContext();

  const title = (formData.get("title") as string || "").trim();
  const titleEn = (formData.get("titleEn") as string || "").trim();
  const abstract = (formData.get("abstract") as string || "").trim();
  const abstractEn = (formData.get("abstractEn") as string || "").trim();
  const keywords = (formData.get("keywords") as string || "").trim();
  const keywordsEn = (formData.get("keywordsEn") as string || "").trim();
  const trackId = formData.get("trackId") as string | null;
  const advisorEmail = (formData.get("advisorEmail") as string || "").trim();
  const advisorName = (formData.get("advisorName") as string || "").trim();

  const validationError = getSubmissionValidationError({
    title,
    titleEn,
    abstract,
    abstractEn,
    trackId,
    advisorEmail,
    advisorName,
  });
  if (validationError) {
    throw new Error(validationError);
  }
  if (title.length > 500) {
    throw new Error("กรุณากรอกชื่อบทความ (ไม่เกิน 500 ตัวอักษร)");
  }

  const [submission] = await db
    .insert(submissions)
    .values({
      title,
      titleEn: titleEn || undefined,
      abstract: abstract || undefined,
      abstractEn: abstractEn || undefined,
      keywords: keywords || undefined,
      keywordsEn: keywordsEn || undefined,
      trackId: trackId || undefined,
      authorId: session.user.id,
      advisorEmail,
      advisorName,
      status: "DRAFT",
    })
    .returning();

  revalidatePath("/submissions");
  return submission;
}

export async function updateSubmission(id: string, formData: FormData) {
  const { session } = await requireActiveServerAuthContext();
  const existing = await db.query.submissions.findFirst({ where: eq(submissions.id, id) });
  if (!existing) throw new Error("Not found");
  if (existing.authorId !== session.user.id) throw new Error("Forbidden");
  if (!canAuthorEditSubmission(existing.status)) {
    throw new Error("แก้ไขข้อมูลบทความได้เฉพาะตอนเป็นแบบร่าง");
  }

  const [updated] = await db
    .update(submissions)
    .set({
      title: formData.get("title") as string,
      titleEn: (formData.get("titleEn") as string) || undefined,
      abstract: formData.get("abstract") as string,
      abstractEn: (formData.get("abstractEn") as string) || undefined,
      keywords: formData.get("keywords") as string,
      keywordsEn: (formData.get("keywordsEn") as string) || undefined,
      updatedAt: new Date(),
    })
    .where(eq(submissions.id, id))
    .returning();

  revalidatePath(`/submissions/${id}`);
  return updated;
}

export async function submitPaper(id: string) {
  const { session } = await requireActiveServerAuthContext();
  const submission = await db.query.submissions.findFirst({ where: eq(submissions.id, id) });
  if (!submission) throw new Error("Not found");
  if (submission.authorId !== session.user.id) throw new Error("Forbidden");
  if (submission.status !== "DRAFT") throw new Error("Can only submit from DRAFT");

  const validationError = getSubmissionValidationError({
    title: submission.title,
    titleEn: submission.titleEn,
    abstract: submission.abstract,
    abstractEn: submission.abstractEn,
    trackId: submission.trackId,
    advisorEmail: submission.advisorEmail,
    advisorName: submission.advisorName,
    fileUrl: submission.fileUrl,
  });
  if (validationError) throw new Error(validationError);
  const advisorEmail = submission.advisorEmail;
  if (!advisorEmail) {
    throw new Error("ไม่พบอีเมลอาจารย์ที่ปรึกษา");
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

  // Send advisor approval email
  let emailSent = false;
  try {
    const appUrl = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const emailContent = advisorApprovalEmail({
      advisorName: submission.advisorName || "Advisor",
      studentName: session.user.name,
      paperTitle: submission.title,
      approvalUrl: `${appUrl}/advisor-approval/${advisorToken}`,
    });
    await queueEmail({
      to: advisorEmail,
      subject: emailContent.subject,
      html: emailContent.html,
      text: emailContent.text,
      throwOnFailure: true,
    });
    emailSent = true;
  } catch (err) {
    console.error("[submitPaper] Failed to send advisor email:", err);
  }

  revalidatePath("/submissions");
  revalidatePath(`/submissions/${id}`);

  if (!emailSent) {
    throw new Error("ส่งบทความสำเร็จ แต่ไม่สามารถส่งอีเมลถึงอาจารย์ที่ปรึกษาได้ กรุณาใช้ปุ่ม 'ส่งอีเมลขอรับรองอีกครั้ง' ในหน้ารายละเอียดบทความ");
  }

  return updated;
}

export async function resubmitPaper(id: string) {
  const { session } = await requireActiveServerAuthContext();
  const submission = await db.query.submissions.findFirst({ where: eq(submissions.id, id) });
  if (!submission) throw new Error("Not found");
  if (submission.authorId !== session.user.id) throw new Error("Forbidden");
  if (submission.status !== "REVISION_REQUIRED") throw new Error("Can only resubmit from REVISION_REQUIRED");

  // Reset review assignments (COMPLETED → ACCEPTED) so the same reviewer reviews again
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
    .set({
      status: "UNDER_REVIEW",
      updatedAt: new Date(),
    })
    .where(eq(submissions.id, id))
    .returning();

  revalidatePath("/submissions");
  revalidatePath(`/submissions/${id}`);
  revalidatePath("/reviews");
  return updated;
}

export async function withdrawPaper(id: string) {
  const { session } = await requireActiveServerAuthContext();
  const submission = await db.query.submissions.findFirst({ where: eq(submissions.id, id) });
  if (!submission) throw new Error("Not found");
  if (submission.authorId !== session.user.id) throw new Error("Forbidden");

  const [updated] = await db
    .update(submissions)
    .set({ status: "WITHDRAWN", updatedAt: new Date() })
    .where(eq(submissions.id, id))
    .returning();

  revalidatePath("/submissions");
  revalidatePath(`/submissions/${id}`);
  return updated;
}
