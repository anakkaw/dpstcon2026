export type SubmissionWorkflowStatus =
  | "DRAFT"
  | "ADVISOR_APPROVAL_PENDING"
  | "SUBMITTED"
  | "UNDER_REVIEW"
  | "REVISION_REQUIRED"
  | "REBUTTAL"
  | "ACCEPTED"
  | "REJECTED"
  | "DESK_REJECTED"
  | "CAMERA_READY_PENDING"
  | "CAMERA_READY_SUBMITTED"
  | "WITHDRAWN";

export type SubmissionWorkflowFileKind =
  | "MANUSCRIPT"
  | "SUPPLEMENTARY"
  | "CAMERA_READY";

export interface SubmissionReadinessInput {
  title: string | null | undefined;
  titleEn: string | null | undefined;
  abstract: string | null | undefined;
  abstractEn: string | null | undefined;
  trackId: string | null | undefined;
  advisorEmail: string | null | undefined;
  advisorName: string | null | undefined;
  fileUrl?: string | null | undefined;
}

function hasText(value: string | null | undefined) {
  return typeof value === "string" && value.trim().length > 0;
}

function isValidEmail(value: string | null | undefined) {
  return hasText(value) && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export function canAuthorEditSubmission(status: SubmissionWorkflowStatus) {
  return status === "DRAFT";
}

export function canAuthorUploadSubmissionFile(
  status: SubmissionWorkflowStatus,
  kind: SubmissionWorkflowFileKind
) {
  if (kind === "CAMERA_READY") {
    return status === "CAMERA_READY_PENDING";
  }

  return status === "DRAFT" || status === "REVISION_REQUIRED";
}

export function getSubmissionValidationError(input: SubmissionReadinessInput) {
  if (!hasText(input.title)) {
    return "กรุณากรอกชื่อบทความ";
  }

  if (!hasText(input.titleEn)) {
    return "กรุณากรอกชื่อบทความภาษาอังกฤษ";
  }

  if (!hasText(input.abstract)) {
    return "กรุณากรอกบทคัดย่อภาษาไทย";
  }

  if (!hasText(input.abstractEn)) {
    return "กรุณากรอกบทคัดย่อภาษาอังกฤษ";
  }

  if (!hasText(input.trackId)) {
    return "กรุณาเลือกสาขาวิชา";
  }

  if (!hasText(input.advisorName)) {
    return "กรุณากรอกชื่อ Advisor";
  }

  if (!isValidEmail(input.advisorEmail)) {
    return "กรุณากรอกอีเมล Advisor ให้ถูกต้อง";
  }

  if ("fileUrl" in input && !hasText(input.fileUrl)) {
    return "กรุณาแนบไฟล์บทความก่อนส่ง";
  }

  return null;
}
