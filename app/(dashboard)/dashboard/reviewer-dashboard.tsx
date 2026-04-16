"use client";

import Link from "next/link";
import { StatCard } from "@/components/ui/stat-card";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";
import {
  ClipboardCheck, Clock, CheckCircle2, ArrowRight, ListTodo,
} from "lucide-react";

export default function ReviewerDashboard({ stats }: { stats: Record<string, unknown> }) {
  const { t } = useI18n();
  const totalAssignments = (stats.totalAssignments as number) || 0;
  const pendingCount = (stats.pending as number) || 0;
  const completedCount = (stats.completed as number) || 0;
  const remainingCount = Math.max(totalAssignments - completedCount, 0);

  return (
    <div className="space-y-6">
      {pendingCount > 0 && (
        <Alert tone="warning">
          <div className="flex items-center justify-between gap-3">
            <span className="font-medium">
              {t("dashboard.actionRequired")}: {t("dashboard.reviewerActionDesc", { n: pendingCount })}
            </span>
            <Link href="/reviews">
              <Button size="sm"><ArrowRight className="h-3.5 w-3.5" />{t("dashboard.goToReviews")}</Button>
            </Link>
          </div>
        </Alert>
      )}

      {/* 4 stat cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label={t("dashboard.assignedTasks")} value={totalAssignments} icon={<ClipboardCheck className="h-5 w-5" />} accent="brand" />
        <StatCard label={t("dashboard.pending")} value={pendingCount} icon={<Clock className="h-5 w-5" />} accent="warning" />
        <StatCard label={t("dashboard.completed")} value={completedCount} icon={<CheckCircle2 className="h-5 w-5" />} accent="success" />
        <StatCard label={t("dashboard.remaining")} value={remainingCount} icon={<ListTodo className="h-5 w-5" />} accent="info" />
      </div>

      {/* 2-col layout: primary queue + progress */}
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(280px,0.85fr)]">
        <section className="rounded-2xl border border-border bg-white p-5 shadow-elev-1">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="space-y-1">
              <h2 className="text-base font-semibold text-ink">{t("dashboard.reviewerFocus")}</h2>
              <p className="text-sm text-ink-muted">
                {pendingCount > 0 ? t("dashboard.reviewerFocusDesc") : t("dashboard.noPendingEvaluations")}
              </p>
            </div>
            <Link href="/reviews">
              <Button>
                <ArrowRight className="h-4 w-4" />
                {t("dashboard.goToReviews")}
              </Button>
            </Link>
          </div>
        </section>

        <section className="rounded-2xl border border-border bg-white p-5 shadow-elev-1">
          <div className="space-y-1">
            <h2 className="text-base font-semibold text-ink">{t("dashboard.reviewProgress")}</h2>
            <p className="text-sm text-ink-muted">{t("dashboard.reviewProgressDesc")}</p>
          </div>
          {totalAssignments > 0 && (
            <div className="mt-4 space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-ink-muted">{t("dashboard.completed")}</span>
                <span className="font-semibold text-ink">{completedCount} / {totalAssignments}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-bar-brand transition-all duration-700"
                  style={{ width: `${Math.round((completedCount / totalAssignments) * 100)}%` }}
                />
              </div>
              <p className="text-xs text-ink-muted">
                {Math.round((completedCount / totalAssignments) * 100)}% {t("dashboard.completionRate")}
              </p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
