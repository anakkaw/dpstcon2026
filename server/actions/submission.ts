"use server";

import { db } from "@/server/db";
import { submissions, coAuthors, reviewAssignments } from "@/server/db/schema";
import { auth } from "@/server/auth";
import { headers } from "next/headers";
import { eq, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";

async function getSession() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new Error("Unauthorized");
  return session;
}

export async function createSubmission(formData: FormData) {
  const session = await getSession();

  const title = (formData.get("title") as string || "").trim();
  const abstract = (formData.get("abstract") as string || "").trim();
  const keywords = (formData.get("keywords") as string || "").trim();
  const trackId = formData.get("trackId") as string | null;
  const advisorEmail = (formData.get("advisorEmail") as string || "").trim();
  const advisorName = (formData.get("advisorName") as string || "").trim();

  // M11: Validate required fields
  if (!title || title.length > 500) {
    throw new Error("กรุณากรอกชื่อบทความ (ไม่เกิน 500 ตัวอักษร)");
  }
  if (!advisorEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(advisorEmail)) {
    throw new Error("กรุณากรอกอีเมล Advisor ให้ถูกต้อง");
  }
  if (!advisorName) {
    throw new Error("กรุณากรอกชื่อ Advisor");
  }

  const [submission] = await db
    .insert(submissions)
    .values({
      title,
      abstract: abstract || undefined,
      keywords: keywords || undefined,
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
  const session = await getSession();
  const existing = await db.query.submissions.findFirst({ where: eq(submissions.id, id) });
  if (!existing) throw new Error("Not found");
  if (existing.authorId !== session.user.id) throw new Error("Forbidden");

  const [updated] = await db
    .update(submissions)
    .set({
      title: formData.get("title") as string,
      abstract: formData.get("abstract") as string,
      keywords: formData.get("keywords") as string,
      updatedAt: new Date(),
    })
    .where(eq(submissions.id, id))
    .returning();

  revalidatePath(`/submissions/${id}`);
  return updated;
}

export async function submitPaper(id: string) {
  const session = await getSession();
  const submission = await db.query.submissions.findFirst({ where: eq(submissions.id, id) });
  if (!submission) throw new Error("Not found");
  if (submission.authorId !== session.user.id) throw new Error("Forbidden");
  if (submission.status !== "DRAFT") throw new Error("Can only submit from DRAFT");
  if (!submission.fileUrl) throw new Error("กรุณาแนบไฟล์บทความก่อนส่ง");

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
  const { queueEmail, advisorApprovalEmail } = await import("@/server/email");
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const emailContent = advisorApprovalEmail({
    advisorName: submission.advisorName || "Advisor",
    studentName: session.user.name,
    paperTitle: submission.title,
    approvalUrl: `${appUrl}/advisor-approval/${advisorToken}`,
  });
  await queueEmail({
    to: submission.advisorEmail!,
    subject: emailContent.subject,
    html: emailContent.html,
  });

  revalidatePath("/submissions");
  revalidatePath(`/submissions/${id}`);
  return updated;
}

export async function resubmitPaper(id: string) {
  const session = await getSession();
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
  const session = await getSession();
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
