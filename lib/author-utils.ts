// ─── Pipeline Steps ─────────────────────────────────────

export const PIPELINE_STEPS = [
  { key: "draft", label: "แบบร่าง", statuses: ["DRAFT"] },
  { key: "advisor", label: "รอ Advisor", statuses: ["ADVISOR_APPROVAL_PENDING"] },
  { key: "submitted", label: "ส่งแล้ว", statuses: ["SUBMITTED"] },
  { key: "review", label: "รีวิว", statuses: ["UNDER_REVIEW", "REBUTTAL"] },
  { key: "decision", label: "ผลตัดสิน", statuses: ["ACCEPTED", "REJECTED", "DESK_REJECTED", "REVISION_REQUIRED"] },
  { key: "final", label: "ฉบับสมบูรณ์", statuses: ["CAMERA_READY_PENDING", "CAMERA_READY_SUBMITTED"] },
] as const;

export type PipelineStepState = "completed" | "current" | "future";

export function getPipelineSteps(status: string): { key: string; label: string; state: PipelineStepState }[] {
  let foundCurrent = false;
  return PIPELINE_STEPS.map((step) => {
    if (foundCurrent) return { ...step, state: "future" as const };
    if (step.statuses.includes(status as never)) {
      foundCurrent = true;
      return { ...step, state: "current" as const };
    }
    return { ...step, state: "completed" as const };
  });
}

/** Get the current step index (0-based) */
export function getPipelineIndex(status: string): number {
  return PIPELINE_STEPS.findIndex((s) => s.statuses.includes(status as never));
}

// ─── Next Actions ───────────────────────────────────────

export interface NextAction {
  label: string;
  description: string;
  urgency: "normal" | "warning" | "urgent";
}

export function getNextAction(status: string, hasFile: boolean): NextAction | null {
  switch (status) {
    case "DRAFT":
      return hasFile
        ? { label: "ส่งบทความเพื่อขออนุมัติ", description: "บทความพร้อมส่งแล้ว กดปุ่มส่งบทความ", urgency: "normal" }
        : { label: "อัปโหลดและส่งบทความ", description: "แนบไฟล์ต้นฉบับบทความก่อนส่ง", urgency: "normal" };
    case "REVISION_REQUIRED":
      return { label: "แก้ไขและส่งบทความใหม่", description: "ตรวจสอบ feedback จาก reviewer และแก้ไขบทความ", urgency: "warning" };
    case "REBUTTAL":
      return { label: "เขียนคำชี้แจง", description: "ส่งคำชี้แจง (rebuttal) ตอบกลับ reviewer", urgency: "warning" };
    case "CAMERA_READY_PENDING":
      return { label: "อัปโหลดฉบับสมบูรณ์", description: "อัปโหลดไฟล์ Camera-Ready สำหรับตีพิมพ์", urgency: "urgent" };
    default:
      return null;
  }
}

// ─── Deadline Helpers ───────────────────────────────────

export function getDaysUntil(dateStr: string): number {
  const target = new Date(dateStr);
  const now = new Date();
  const diff = target.getTime() - now.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

export function getDeadlineUrgency(daysLeft: number): "normal" | "warning" | "urgent" {
  if (daysLeft <= 3) return "urgent";
  if (daysLeft <= 14) return "warning";
  return "normal";
}

/** Map submission status to relevant deadline key */
export function getRelevantDeadlineKey(status: string): string | null {
  switch (status) {
    case "DRAFT":
    case "ADVISOR_APPROVAL_PENDING":
      return "submissionDeadline";
    case "CAMERA_READY_PENDING":
      return "cameraReadyDeadline";
    default:
      return null;
  }
}

// ─── Status helpers ─────────────────────────────────────

/** Statuses where the paper has been "ended" (terminal or withdrawn) */
export function isTerminalStatus(status: string): boolean {
  return ["REJECTED", "DESK_REJECTED", "WITHDRAWN", "CAMERA_READY_SUBMITTED"].includes(status);
}
