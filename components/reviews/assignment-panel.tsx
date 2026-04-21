"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { useI18n } from "@/lib/i18n";
import { formatDate } from "@/lib/utils";
import { displayNameTh } from "@/lib/display-name";
import { getAssignmentStatusLabels } from "@/lib/labels";
import {
  Trash2,
  UserPlus,
  ExternalLink,
  Send,
  Clock,
  AlertTriangle,
} from "lucide-react";

const STATUS_COLORS: Record<string, "neutral" | "success" | "warning" | "danger" | "info"> = {
  PENDING: "warning",
  ACCEPTED: "info",
  DECLINED: "neutral",
  COMPLETED: "success",
  OVERDUE: "danger",
};

export interface PanelAssignment {
  id: string;
  status: string;
  assignedAt: string;
  dueDate: string | null;
  reviewer: {
    id: string;
    name: string;
    affiliation?: string | null;
    prefixTh?: string | null;
    firstNameTh?: string | null;
    lastNameTh?: string | null;
  } | null;
}

export interface ReviewerOption {
  id: string;
  name: string;
  email: string;
  affiliation?: string | null;
  prefixTh?: string | null;
  firstNameTh?: string | null;
  lastNameTh?: string | null;
  pendingLoad?: number;
  activeLoad?: number;
  completedLoad?: number;
}

interface AssignmentPanelProps {
  submissionId: string;
  assignments: PanelAssignment[];
  reviewers: ReviewerOption[];
  currentUserId?: string;
  /** Called with a user-facing message after any mutation */
  onMessage?: (msg: string) => void;
}

function isOverdue(dueDate: string | null, now: number) {
  if (!dueDate) return false;
  return new Date(dueDate).getTime() < now;
}

function isDueSoon(dueDate: string | null, now: number) {
  if (!dueDate) return false;
  const diff = new Date(dueDate).getTime() - now;
  return diff > 0 && diff < 3 * 24 * 60 * 60 * 1000;
}

export function AssignmentPanel({
  submissionId,
  assignments,
  reviewers,
  currentUserId,
  onMessage,
}: AssignmentPanelProps) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const assignmentLabels = getAssignmentStatusLabels(t);
  const now = Date.now();

  const [isAssigning, setIsAssigning] = useState(false);
  const [selectedReviewerId, setSelectedReviewerId] = useState("");
  const [assignDueDate, setAssignDueDate] = useState("");
  const [assignSaving, setAssignSaving] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [assignmentToRemove, setAssignmentToRemove] = useState<PanelAssignment | null>(null);

  const assignedReviewerIds = useMemo(
    () => new Set(assignments.map((a) => a.reviewer?.id).filter(Boolean) as string[]),
    [assignments]
  );

  async function handleAssign() {
    if (!selectedReviewerId) return;
    setAssignSaving(true);
    try {
      const res = await fetch("/api/reviews/assignments/manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          submissionId,
          reviewerId: selectedReviewerId,
          dueDate: assignDueDate || undefined,
        }),
      });
      if (res.ok) {
        onMessage?.(t("reviews.assignmentAssigned"));
        setSelectedReviewerId("");
        setAssignDueDate("");
        setIsAssigning(false);
        router.refresh();
      } else {
        const data = await res.json().catch(() => ({}));
        onMessage?.(data.error || t("reviews.assignFailed"));
      }
    } catch {
      onMessage?.(t("reviews.assignFailed"));
    }
    setAssignSaving(false);
  }

  async function handleRemove(assignment: PanelAssignment) {
    setRemovingId(assignment.id);
    try {
      const res = await fetch(`/api/reviews/assignments/${assignment.id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        onMessage?.(t("reviews.assignmentRemoved"));
        router.refresh();
      } else {
        onMessage?.(t("reviews.removeFailed"));
      }
    } catch {
      onMessage?.(t("reviews.removeFailed"));
    }
    setRemovingId(null);
    setAssignmentToRemove(null);
  }

  return (
    <div className="space-y-3">
      <ConfirmDialog
        open={Boolean(assignmentToRemove)}
        title={t("reviews.removeAssignmentTitle")}
        description={t("reviews.removeAssignmentDescription", {
          reviewer: assignmentToRemove?.reviewer
            ? displayNameTh(assignmentToRemove.reviewer)
            : "—",
        })}
        confirmLabel={t("common.delete")}
        cancelLabel={t("common.cancel")}
        tone="danger"
        loading={Boolean(assignmentToRemove && removingId === assignmentToRemove.id)}
        onCancel={() => {
          if (!removingId) setAssignmentToRemove(null);
        }}
        onConfirm={() => {
          if (assignmentToRemove) void handleRemove(assignmentToRemove);
        }}
      />

      {assignments.length === 0 && (
        <div className="rounded-lg border border-dashed border-border bg-surface-alt p-4 text-center text-sm text-ink-muted">
          {t("reviews.noReviewsYet")}
        </div>
      )}

      {assignments.map((assignment) => {
        const overdue =
          assignment.status !== "COMPLETED" &&
          assignment.status !== "DECLINED" &&
          isOverdue(assignment.dueDate, now);
        const dueSoon =
          !overdue &&
          assignment.status !== "COMPLETED" &&
          assignment.status !== "DECLINED" &&
          isDueSoon(assignment.dueDate, now);
        const isMe = currentUserId && assignment.reviewer?.id === currentUserId;

        return (
          <div
            key={assignment.id}
            className={`rounded-xl border p-3 ${
              isMe
                ? "border-brand-300 bg-brand-50/40 ring-1 ring-brand-300/30"
                : "border-border-light bg-surface-alt"
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-ink">
                  {assignment.reviewer ? displayNameTh(assignment.reviewer) : "—"}
                  {isMe && (
                    <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-brand-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-brand-700">
                      {t("reviews.youLabel")}
                    </span>
                  )}
                </p>
                {assignment.reviewer?.affiliation && (
                  <p className="text-xs text-ink-muted">
                    {assignment.reviewer.affiliation}
                  </p>
                )}
                <p className="mt-1 text-xs text-ink-muted">
                  {t("reviews.assigned")}{" "}
                  {formatDate(assignment.assignedAt, locale)}
                </p>
              </div>
              <Badge tone={STATUS_COLORS[assignment.status] || "neutral"} dot>
                {assignmentLabels[assignment.status] || assignment.status}
              </Badge>
            </div>

            <div className="mt-3 flex items-center justify-between gap-3">
              <span className="text-xs text-ink-muted">{t("reviews.dueDate")}</span>
              <span
                className={`inline-flex items-center gap-1 text-xs ${
                  overdue
                    ? "font-medium text-red-600"
                    : dueSoon
                      ? "font-medium text-amber-600"
                      : "text-ink-muted"
                }`}
              >
                {overdue && <AlertTriangle className="h-3 w-3" />}
                {dueSoon && <Clock className="h-3 w-3" />}
                {assignment.dueDate
                  ? formatDate(assignment.dueDate, locale)
                  : t("reviews.noDeadline")}
              </span>
            </div>

            <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
              {isMe && assignment.status === "ACCEPTED" && (
                <Link href={`/submissions/${submissionId}#section-review-form`}>
                  <Button size="sm">
                    <Send className="h-3.5 w-3.5" />
                    {t("reviews.writeReview")}
                  </Button>
                </Link>
              )}
              {assignment.status !== "COMPLETED" && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setAssignmentToRemove(assignment)}
                  disabled={removingId === assignment.id}
                >
                  <Trash2 className="h-3.5 w-3.5 text-red-500" />
                  {t("common.delete")}
                </Button>
              )}
            </div>
          </div>
        );
      })}

      {!isAssigning && (
        <Button
          size="sm"
          variant="outline"
          onClick={() => setIsAssigning(true)}
        >
          <UserPlus className="h-4 w-4" />
          {t("reviews.assignReviewer")}
        </Button>
      )}

      {isAssigning && (
        <div className="rounded-xl border border-brand-200/50 bg-brand-50/40 p-4">
          <div className="space-y-3">
            <Field label={t("reviews.reviewers")} className="flex-1">
              <Select
                value={selectedReviewerId}
                onChange={(e) => setSelectedReviewerId(e.target.value)}
              >
                <option value="">{t("reviews.selectReviewer")}</option>
                {reviewers
                  .filter((r) => !assignedReviewerIds.has(r.id))
                  .slice()
                  .sort(
                    (a, b) =>
                      ((a.activeLoad ?? 0) + (a.pendingLoad ?? 0)) -
                      ((b.activeLoad ?? 0) + (b.pendingLoad ?? 0))
                  )
                  .map((r) => {
                    const active = r.activeLoad ?? 0;
                    const pending = r.pendingLoad ?? 0;
                    const suffix =
                      active === 0 && pending === 0
                        ? ` · ${t("reviews.workloadFree")}`
                        : ` · ${t("reviews.workloadCompact", { active, pending })}`;
                    return (
                      <option key={r.id} value={r.id}>
                        {displayNameTh(r)}
                        {r.affiliation ? ` · ${r.affiliation}` : ""}
                        {suffix}
                      </option>
                    );
                  })}
              </Select>
            </Field>
            <Field label={t("reviews.dueDate")}>
              <Input
                type="date"
                value={assignDueDate}
                onChange={(e) => setAssignDueDate(e.target.value)}
              />
            </Field>
            <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
              <Button
                size="sm"
                onClick={handleAssign}
                loading={assignSaving}
                disabled={!selectedReviewerId}
              >
                {t("reviews.assign")}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setIsAssigning(false);
                  setSelectedReviewerId("");
                  setAssignDueDate("");
                }}
              >
                {t("common.cancel")}
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="flex justify-end">
        <Link href={`/submissions/${submissionId}`}>
          <Button size="sm" variant="ghost">
            <ExternalLink className="h-3.5 w-3.5" />
            {t("common.viewAll")}
          </Button>
        </Link>
      </div>
    </div>
  );
}
