"use client";

import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";

interface ReviewProgressProps {
  completed: number;
  total: number;
  compact?: boolean;
}

export function ReviewProgress({ completed, total, compact = false }: ReviewProgressProps) {
  const { t } = useI18n();
  if (total === 0) return null;

  const pct = Math.round((completed / total) * 100);

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <div className="h-1.5 w-16 rounded-full bg-gray-200 overflow-hidden">
          <div
            className={cn("h-full rounded-full transition-all", completed === total ? "bg-emerald-500" : "bg-brand-500")}
            style={{ width: `${Math.max(pct, 8)}%` }}
          />
        </div>
        <span className="text-xs text-ink-muted whitespace-nowrap">{completed}/{total}</span>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-ink-muted">
          {completed === total ? t("reviewProgress.complete") : t("reviewProgress.progress", { completed, total })}
        </span>
        <span className="text-xs text-ink-muted">{pct}%</span>
      </div>
      <div className="h-2 w-full rounded-full bg-gray-100 overflow-hidden">
        <div
          className={cn(
            "h-full rounded-full transition-all duration-500",
            completed === total ? "bg-emerald-500" : "bg-brand-500"
          )}
          style={{ width: `${Math.max(pct, 4)}%` }}
        />
      </div>
    </div>
  );
}
