import { and, eq, gt } from "drizzle-orm";
import { db } from "@/server/db";
import { storedFiles, submissions, user } from "@/server/db/schema";
import { ADVISOR_TOKEN_EXPIRY_DAYS } from "@/lib/constants";

function isAdvisorTokenExpired(submittedAt: Date | null): boolean {
  if (!submittedAt) return true; // No submission date means token is invalid
  const expiresAt = new Date(submittedAt.getTime() + ADVISOR_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000);
  return new Date() > expiresAt;
}

export async function getActivatePageData(token: string) {
  const found = await db.query.user.findFirst({
    where: and(eq(user.inviteToken, token), gt(user.inviteExpiresAt, new Date())),
    columns: {
      id: true,
      name: true,
      email: true,
      isActive: true,
      prefixTh: true,
      firstNameTh: true,
      lastNameTh: true,
    },
  });

  if (!found) {
    return {
      status: "error" as const,
      errorMsg: "ลิงก์เชิญไม่ถูกต้องหรือหมดอายุแล้ว",
      userName: "",
      email: "",
    };
  }

  if (found.isActive) {
    return {
      status: "error" as const,
      errorMsg: "บัญชีนี้เปิดใช้งานแล้ว",
      userName: "",
      email: "",
    };
  }

  const firstName = found.firstNameTh || "";
  const lastName = found.lastNameTh || "";
  const displayName = (firstName || lastName) ? `${found.prefixTh || ""}${firstName} ${lastName}`.trim() : found.name;

  return {
    status: "valid" as const,
    errorMsg: "",
    userName: displayName,
    email: found.email,
  };
}

export interface AdvisorApprovalFileData {
  id: string;
  originalName: string;
  mimeType: string;
  size: number;
  kind: string;
}

export interface AdvisorApprovalSubmissionData {
  id: string;
  title: string;
  abstract: string | null;
  abstractEn: string | null;
  keywords: string | null;
  advisorName: string | null;
  author: {
    name: string;
    email: string;
    affiliation: string | null;
    prefixTh?: string | null;
    firstNameTh?: string | null;
    lastNameTh?: string | null;
    prefixEn?: string | null;
    firstNameEn?: string | null;
    lastNameEn?: string | null;
  };
  track: { name: string } | null;
}

export async function getAdvisorApprovalPageData(token: string) {
  const submission = await db.query.submissions.findFirst({
    where: eq(submissions.advisorApprovalToken, token),
    columns: {
      id: true,
      title: true,
      abstract: true,
      abstractEn: true,
      keywords: true,
      advisorName: true,
      advisorEmail: true,
      advisorApprovalStatus: true,
      status: true,
      submittedAt: true,
    },
    with: {
      author: {
        columns: {
          name: true,
          email: true,
          affiliation: true,
          prefixTh: true,
          firstNameTh: true,
          lastNameTh: true,
          prefixEn: true,
          firstNameEn: true,
          lastNameEn: true,
        },
      },
      track: { columns: { name: true } },
    },
  });

  if (!submission) {
    return {
      error: "Invalid or expired token",
      submission: null,
      files: [] as AdvisorApprovalFileData[],
      alreadyResponded: false,
      responseMessage: "",
    };
  }

  if (submission.advisorApprovalStatus === "PENDING" && isAdvisorTokenExpired(submission.submittedAt)) {
    return {
      error: "ลิงก์รับรองหมดอายุแล้ว กรุณาติดต่อนักศึกษาเพื่อขอลิงก์ใหม่",
      submission: null,
      files: [] as AdvisorApprovalFileData[],
      alreadyResponded: false,
      responseMessage: "",
    };
  }

  if (submission.advisorApprovalStatus !== "PENDING") {
    return {
      error: "",
      submission: submission as AdvisorApprovalSubmissionData,
      files: [] as AdvisorApprovalFileData[],
      alreadyResponded: true,
      responseMessage:
        submission.advisorApprovalStatus === "APPROVED"
          ? "ท่านได้รับรองบทความนี้แล้ว"
          : "ท่านได้ปฏิเสธการรับรองบทความนี้แล้ว",
    };
  }

  const files = await db
    .select({
      id: storedFiles.id,
      originalName: storedFiles.originalName,
      mimeType: storedFiles.mimeType,
      size: storedFiles.size,
      kind: storedFiles.kind,
    })
    .from(storedFiles)
    .where(and(eq(storedFiles.submissionId, submission.id), eq(storedFiles.kind, "MANUSCRIPT")));

  return {
    error: "",
    submission: submission as AdvisorApprovalSubmissionData,
    files,
    alreadyResponded: false,
    responseMessage: "",
  };
}
