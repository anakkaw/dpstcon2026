// Thai label mapping for the DPSTCon system

export const ROLE_LABELS: Record<string, string> = {
  ADMIN: "Admin",
  PROGRAM_CHAIR: "Program Chair",
  REVIEWER: "Reviewer",
  COMMITTEE: "Committee",
  AUTHOR: "Author",
};

export const SUBMISSION_STATUS_LABELS: Record<string, string> = {
  DRAFT: "แบบร่าง",
  ADVISOR_APPROVAL_PENDING: "รอ Advisor รับรอง",
  SUBMITTED: "ส่งแล้ว",
  UNDER_REVIEW: "อยู่ระหว่างรีวิว",
  REVISION_REQUIRED: "ต้องแก้ไข",
  REBUTTAL: "ชี้แจง",
  ACCEPTED: "ตอบรับ",
  REJECTED: "ปฏิเสธ",
  DESK_REJECTED: "ปฏิเสธเบื้องต้น",
  CAMERA_READY_PENDING: "รอฉบับสมบูรณ์",
  CAMERA_READY_SUBMITTED: "ส่งฉบับสมบูรณ์แล้ว",
  WITHDRAWN: "ถอนบทความ",
};

export const SUBMISSION_STATUS_COLORS: Record<
  string,
  "neutral" | "success" | "warning" | "danger" | "info"
> = {
  DRAFT: "neutral",
  ADVISOR_APPROVAL_PENDING: "warning",
  SUBMITTED: "info",
  UNDER_REVIEW: "info",
  REVISION_REQUIRED: "warning",
  REBUTTAL: "warning",
  ACCEPTED: "success",
  REJECTED: "danger",
  DESK_REJECTED: "danger",
  CAMERA_READY_PENDING: "warning",
  CAMERA_READY_SUBMITTED: "success",
  WITHDRAWN: "neutral",
};

export const ASSIGNMENT_STATUS_LABELS: Record<string, string> = {
  PENDING: "รอตอบรับ",
  ACCEPTED: "ตอบรับแล้ว",
  DECLINED: "ปฏิเสธ",
  COMPLETED: "เสร็จสิ้น",
  OVERDUE: "เกินกำหนด",
};

export const RECOMMENDATION_LABELS: Record<string, string> = {
  ACCEPT: "ตอบรับ",
  REVISE: "ให้แก้ไข",
  REJECT: "ปฏิเสธ",
};

export const DECISION_LABELS: Record<string, string> = {
  ACCEPT: "ตอบรับ",
  REJECT: "ปฏิเสธ",
  CONDITIONAL_ACCEPT: "ตอบรับแบบมีเงื่อนไข",
  DESK_REJECT: "ปฏิเสธเบื้องต้น",
};

export const NOTIFICATION_TYPE_LABELS: Record<string, string> = {
  ASSIGNMENT: "มอบหมายงาน",
  REVIEW_REMINDER: "แจ้งเตือนรีวิว",
  DECISION: "ผลการตัดสิน",
  REBUTTAL: "คำชี้แจง",
  SYSTEM: "ระบบ",
};

export const PHASE_TYPE_LABELS: Record<string, string> = {
  ABSTRACT_SUBMISSION: "ส่งบทคัดย่อ",
  FULL_PAPER_SUBMISSION: "ส่งบทความฉบับเต็ม",
  REVIEW: "รีวิว",
  REBUTTAL: "ชี้แจง",
  NOTIFICATION: "แจ้งผล",
  CAMERA_READY: "ฉบับสมบูรณ์",
};

export const BID_PREFERENCE_LABELS: Record<string, string> = {
  EAGER: "สนใจมาก",
  WILLING: "ยินดี",
  NEUTRAL: "เฉยๆ",
  NOT_PREFERRED: "ไม่ค่อยสนใจ",
  CONFLICT: "มีผลประโยชน์ทับซ้อน",
};

export const PRESENTATION_TYPE_LABELS: Record<string, string> = {
  POSTER: "โปสเตอร์",
  ORAL: "นำเสนอปากเปล่า",
};
