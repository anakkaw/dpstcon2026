"use client";

import { useI18n } from "@/lib/i18n";
import { getAssignmentStatusLabels } from "@/lib/labels";
import { displayNameTh, nameInitial } from "@/lib/display-name";
import { cn } from "@/lib/utils";

export interface ProgressAssignment {
  id: string;
  status: string;
  reviewer: {
    id: string;
    name: string;
    prefixTh?: string | null;
    firstNameTh?: string | null;
    lastNameTh?: string | null;
  } | null;
}

interface ReviewProgressMiniProps {
  assignments: ProgressAssignment[];
  /** Optional: id of the current viewing user — highlighted in the stack */
  currentUserId?: string;
  /** Show count label next to bar (e.g. 2/3). Defaults true. */
  showCount?: boolean;
  /** Max avatars before showing "+N". Defaults 3. */
  maxAvatars?: number;
}

const STATUS_BG: Record<string, string> = {
  COMPLETED: "bg-emerald-100 text-emerald-700",
  OVERDUE: "bg-red-100 text-red-700",
  ACCEPTED: "bg-blue-100 text-blue-700",
  DECLINED: "bg-gray-100 text-gray-500",
  PENDING: "bg-amber-100 text-amber-700",
};

export function ReviewProgressMini({
  assignments,
  currentUserId,
  showCount = true,
  maxAvatars = 3,
}: ReviewProgressMiniProps) {
  const { t } = useI18n();
  const labels = getAssignmentStatusLabels(t);

  const total = assignments.length;
  const completed = assignments.filter((a) => a.status === "COMPLETED").length;
  const hasOverdue = assignments.some((a) => a.status === "OVERDUE");
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;

  if (total === 0) {
    return (
      <span className="text-xs text-ink-muted">
        {t("reviews.noReviewsYet")}
      </span>
    );
  }

  const visible = assignments.slice(0, maxAvatars);
  const extra = assignments.length - visible.length;

  return (
    <div className="flex items-center gap-3">
      <div className="flex -space-x-1.5">
        {visible.map((a) => {
          const isMe = currentUserId && a.reviewer?.id === currentUserId;
          return (
            <div
              key={a.id}
              className="relative"
              title={`${a.reviewer ? displayNameTh(a.reviewer) : "?"} — ${labels[a.status] || a.status}`}
            >
              <div
                className={cn(
                  "flex h-7 w-7 items-center justify-center rounded-full border-2 text-[10px] font-bold",
                  STATUS_BG[a.status] || "bg-gray-100 text-gray-500",
                  isMe
                    ? "border-brand-500 ring-2 ring-brand-500/30"
                    : "border-white"
                )}
              >
                {a.reviewer ? nameInitial(a.reviewer) : "?"}
              </div>
            </div>
          );
        })}
        {extra > 0 && (
          <div className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-gray-100 text-[10px] font-bold text-gray-500">
            +{extra}
          </div>
        )}
      </div>
      {showCount && (
        <div className="flex flex-1 items-center gap-2">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-gray-100">
            <div
              className={cn(
                "h-full rounded-full transition-all",
                pct === 100
                  ? "bg-emerald-500"
                  : hasOverdue
                    ? "bg-red-400"
                    : "bg-blue-500"
              )}
              style={{ width: `${pct}%` }}
            />
          </div>
          <span
            className={cn(
              "w-12 text-right text-xs font-medium tabular-nums",
              pct === 100
                ? "text-emerald-600"
                : hasOverdue
                  ? "text-red-500"
                  : "text-ink-muted"
            )}
          >
            {completed}/{total}
          </span>
        </div>
      )}
    </div>
  );
}
