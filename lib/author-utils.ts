import type { TranslationKey } from "@/lib/i18n";
import thDict from "@/lib/i18n/translations/th";

type TFn = (key: TranslationKey) => string;

// Backward-compatible Thai fallback (will be removed after full migration)
const _defaultT: TFn = (key) => thDict[key] || key;

// ─── Pipeline Steps ─────────────────────────────────────

export const PIPELINE_STEPS = [
  { key: "draft", labelKey: "pipeline.draft" as TranslationKey, statuses: ["DRAFT"] },
  { key: "advisor", labelKey: "pipeline.advisor" as TranslationKey, statuses: ["ADVISOR_APPROVAL_PENDING"] },
  { key: "submitted", labelKey: "pipeline.submitted" as TranslationKey, statuses: ["SUBMITTED"] },
  { key: "review", labelKey: "pipeline.review" as TranslationKey, statuses: ["UNDER_REVIEW"] },
  { key: "decision", labelKey: "pipeline.decision" as TranslationKey, statuses: ["ACCEPTED", "REJECTED", "DESK_REJECTED", "REVISION_REQUIRED", "CAMERA_READY_PENDING", "CAMERA_READY_SUBMITTED"] },
] as const;

export type PipelineStepState = "completed" | "current" | "future";

export function getPipelineSteps(status: string, t: TFn = _defaultT): { key: string; label: string; state: PipelineStepState }[] {
  let foundCurrent = false;
  return PIPELINE_STEPS.map((step) => {
    const label = t(step.labelKey);
    if (foundCurrent) return { key: step.key, label, state: "future" as const };
    if (step.statuses.includes(status as never)) {
      foundCurrent = true;
      return { key: step.key, label, state: "current" as const };
    }
    return { key: step.key, label, state: "completed" as const };
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

export function getNextAction(status: string, hasFile: boolean, t: TFn = _defaultT): NextAction | null {
  switch (status) {
    case "DRAFT":
      return hasFile
        ? { label: t("action.submitForApproval"), description: t("action.submitForApprovalDesc"), urgency: "normal" }
        : { label: t("action.uploadAndSubmit"), description: t("action.uploadAndSubmitDesc"), urgency: "normal" };
    case "REVISION_REQUIRED":
      return { label: t("action.reviseAndResubmit"), description: t("action.reviseAndResubmitDesc"), urgency: "warning" };
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
    default:
      return null;
  }
}

// ─── Status helpers ─────────────────────────────────────

/** Statuses where the paper has been "ended" (terminal or withdrawn) */
export function isTerminalStatus(status: string): boolean {
  return ["ACCEPTED", "REJECTED", "DESK_REJECTED", "WITHDRAWN", "CAMERA_READY_SUBMITTED"].includes(status);
}
