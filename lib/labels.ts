// Label dictionaries with i18n support for the DPSTCon system

import type { TranslationKey } from "@/lib/i18n";

type TFn = (key: TranslationKey) => string;

// ─── Function-based label getters (i18n-aware) ────────────────

export function getRoleLabels(t: TFn): Record<string, string> {
  return {
    ADMIN: t("labels.role.ADMIN"),
    PROGRAM_CHAIR: t("labels.role.PROGRAM_CHAIR"),
    REVIEWER: t("labels.role.REVIEWER"),
    COMMITTEE: t("labels.role.COMMITTEE"),
    AUTHOR: t("labels.role.AUTHOR"),
  };
}

export function getSubmissionStatusLabels(t: TFn): Record<string, string> {
  return {
    DRAFT: t("labels.status.DRAFT"),
    ADVISOR_APPROVAL_PENDING: t("labels.status.ADVISOR_APPROVAL_PENDING"),
    SUBMITTED: t("labels.status.SUBMITTED"),
    UNDER_REVIEW: t("labels.status.UNDER_REVIEW"),
    REVISION_REQUIRED: t("labels.status.REVISION_REQUIRED"),
    REBUTTAL: t("labels.status.REBUTTAL"),
    ACCEPTED: t("labels.status.ACCEPTED"),
    REJECTED: t("labels.status.REJECTED"),
    DESK_REJECTED: t("labels.status.DESK_REJECTED"),
    CAMERA_READY_PENDING: t("labels.status.CAMERA_READY_PENDING"),
    CAMERA_READY_SUBMITTED: t("labels.status.CAMERA_READY_SUBMITTED"),
    WITHDRAWN: t("labels.status.WITHDRAWN"),
  };
}

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

export function getAssignmentStatusLabels(t: TFn): Record<string, string> {
  return {
    PENDING: t("labels.assignment.PENDING"),
    ACCEPTED: t("labels.assignment.ACCEPTED"),
    DECLINED: t("labels.assignment.DECLINED"),
    COMPLETED: t("labels.assignment.COMPLETED"),
    OVERDUE: t("labels.assignment.OVERDUE"),
  };
}

export function getRecommendationLabels(t: TFn): Record<string, string> {
  return {
    ACCEPT: t("labels.recommendation.ACCEPT"),
    REVISE: t("labels.recommendation.REVISE"),
    REJECT: t("labels.recommendation.REJECT"),
  };
}

export function getDecisionLabels(t: TFn): Record<string, string> {
  return {
    ACCEPT: t("labels.decision.ACCEPT"),
    REJECT: t("labels.decision.REJECT"),
    CONDITIONAL_ACCEPT: t("labels.decision.CONDITIONAL_ACCEPT"),
    DESK_REJECT: t("labels.decision.DESK_REJECT"),
  };
}

export function getNotificationTypeLabels(t: TFn): Record<string, string> {
  return {
    ASSIGNMENT: t("labels.notification.ASSIGNMENT"),
    REVIEW_REMINDER: t("labels.notification.REVIEW_REMINDER"),
    DECISION: t("labels.notification.DECISION"),
    REBUTTAL: t("labels.notification.REBUTTAL"),
    SYSTEM: t("labels.notification.SYSTEM"),
  };
}

export function getPhaseTypeLabels(t: TFn): Record<string, string> {
  return {
    ABSTRACT_SUBMISSION: t("labels.phase.ABSTRACT_SUBMISSION"),
    FULL_PAPER_SUBMISSION: t("labels.phase.FULL_PAPER_SUBMISSION"),
    REVIEW: t("labels.phase.REVIEW"),
    REBUTTAL: t("labels.phase.REBUTTAL"),
    NOTIFICATION: t("labels.phase.NOTIFICATION"),
    CAMERA_READY: t("labels.phase.CAMERA_READY"),
  };
}

export function getBidPreferenceLabels(t: TFn): Record<string, string> {
  return {
    EAGER: t("labels.bid.EAGER"),
    WILLING: t("labels.bid.WILLING"),
    NEUTRAL: t("labels.bid.NEUTRAL"),
    NOT_PREFERRED: t("labels.bid.NOT_PREFERRED"),
    CONFLICT: t("labels.bid.CONFLICT"),
  };
}

export function getPresentationTypeLabels(t: TFn): Record<string, string> {
  return {
    POSTER: t("labels.presentationType.POSTER"),
    ORAL: t("labels.presentationType.ORAL"),
  };
}

// ─── Backward-compatible static exports (Thai default — will be removed after full migration) ───

import thDict from "@/lib/i18n/translations/th";
const _t = (key: TranslationKey) => thDict[key] || key;

export const ROLE_LABELS = getRoleLabels(_t);
export const SUBMISSION_STATUS_LABELS = getSubmissionStatusLabels(_t);
export const ASSIGNMENT_STATUS_LABELS = getAssignmentStatusLabels(_t);
export const RECOMMENDATION_LABELS = getRecommendationLabels(_t);
export const DECISION_LABELS = getDecisionLabels(_t);
export const NOTIFICATION_TYPE_LABELS = getNotificationTypeLabels(_t);
export const PHASE_TYPE_LABELS = getPhaseTypeLabels(_t);
export const BID_PREFERENCE_LABELS = getBidPreferenceLabels(_t);
export const PRESENTATION_TYPE_LABELS = getPresentationTypeLabels(_t);
