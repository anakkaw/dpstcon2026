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
  /** @deprecated Use hasManuscript instead */
  fileUrl?: string | null | undefined;
  hasManuscript?: boolean;
}

function hasText(value: string | null | undefined): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isValidEmail(value: string | null | undefined) {
  if (!hasText(value)) {
    return false;
  }

  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

// Common typos that almost always mean the user mistyped a popular provider.
// Treated as hard errors so submissions can't go out to invalid mailboxes.
const EMAIL_DOMAIN_TYPOS: Record<string, string> = {
  "gmial.com": "gmail.com",
  "gmai.com": "gmail.com",
  "gmaill.com": "gmail.com",
  "gnail.com": "gmail.com",
  "gmail.co": "gmail.com",
  "gmail.cm": "gmail.com",
  "gmail.con": "gmail.com",
  "yaho.com": "yahoo.com",
  "yahooo.com": "yahoo.com",
  "yahoo.co": "yahoo.com",
  "hotnail.com": "hotmail.com",
  "hotmial.com": "hotmail.com",
  "hotmai.com": "hotmail.com",
  "outlok.com": "outlook.com",
  "nu.ac.h": "nu.ac.th",
  "nu.ac.t": "nu.ac.th",
  "chula.ac.h": "chula.ac.th",
  "mahidol.ac.h": "mahidol.ac.th",
  "ku.ac.h": "ku.ac.th",
};

/**
 * Hard validation for the advisor email — beyond the regex.
 * Catches common typos and zero-width / unicode whitespace pasted from PDFs.
 */
export function getAdvisorEmailError(email: string | null | undefined) {
  if (!hasText(email)) return "กรุณากรอกอีเมล Advisor";
  const trimmed = email.trim();

  // Reject zero-width / unicode whitespace inside the address (commonly pasted from Word/PDF).
  if (/[\u200B-\u200D\uFEFF\u00A0\s]/.test(trimmed)) {
    return "อีเมล Advisor มีช่องว่างหรืออักขระพิเศษแฝงอยู่ — กรุณาพิมพ์ใหม่";
  }

  if (!isValidEmail(trimmed)) {
    return "กรุณากรอกอีเมล Advisor ให้ถูกต้อง";
  }

  const domain = trimmed.split("@")[1]?.toLowerCase() ?? "";
  const fix = EMAIL_DOMAIN_TYPOS[domain];
  if (fix) {
    return `โดเมนอีเมลดูเหมือนพิมพ์ผิด: "${domain}" — น่าจะเป็น "${fix}" หรือไม่?`;
  }

  return null;
}

/**
 * Soft warning (does not block submission) — surfaces non-academic / unusual
 * advisor domains so the author double-checks before sending.
 */
export function getAdvisorEmailWarning(email: string | null | undefined) {
  if (!hasText(email)) return null;
  const domain = email.trim().split("@")[1]?.toLowerCase() ?? "";
  if (!domain) return null;

  const academicDomains = [".ac.th", ".edu", ".edu.au", ".ac.uk", ".ac.jp"];
  const isAcademic = academicDomains.some((suffix) => domain.endsWith(suffix));
  if (isAcademic) return null;

  // Free-mail providers — common but worth flagging since spam filters may eat
  // links to advisors who use personal addresses.
  const freeMail = ["gmail.com", "yahoo.com", "hotmail.com", "outlook.com", "live.com", "icloud.com"];
  if (freeMail.includes(domain)) {
    return "อีเมลอาจารย์เป็นอีเมลส่วนตัว ไม่ใช่อีเมลมหาวิทยาลัย — กรุณายืนยันความถูกต้องก่อนส่ง";
  }

  return "โดเมนอีเมลไม่ใช่อีเมลมหาวิทยาลัย (.ac.th/.edu) — กรุณายืนยันความถูกต้อง";
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

  const advisorEmailError = getAdvisorEmailError(input.advisorEmail);
  if (advisorEmailError) {
    return advisorEmailError;
  }

  // Check manuscript file existence (prefer hasManuscript, fallback to legacy fileUrl)
  if ("hasManuscript" in input && input.hasManuscript === false) {
    return "กรุณาแนบไฟล์บทความก่อนส่ง";
  } else if (!("hasManuscript" in input) && "fileUrl" in input && !hasText(input.fileUrl)) {
    return "กรุณาแนบไฟล์บทความก่อนส่ง";
  }

  return null;
}
