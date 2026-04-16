"use client";

import Link from "next/link";
import { StatCard } from "@/components/ui/stat-card";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";
import { ClipboardCheck, Clock, CheckCircle2, ArrowRight } from "lucide-react";

export default function ReviewerDashboard({ stats }: { stats: Record<string, unknown> }) {
  const { t } = useI18n();
  const pendingCount = (stats.pending as number) || 0;

  return (
    <div className="space-y-6">
      {pendingCount > 0 && (
        <Alert tone="warning">
          <div className="flex items-center justify-between gap-3">
            <span className="font-medium">{t("dashboard.actionRequired")}: {t("dashboard.reviewerActionDesc", { n: pendingCount })}</span>
            <Link href="/reviews">
              <Button size="sm"><ArrowRight className="h-3.5 w-3.5" />{t("dashboard.goToReviews")}</Button>
            </Link>
          </div>
        </Alert>
      )}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
        <StatCard label={t("dashboard.assignedTasks")} value={(stats.totalAssignments as number) || 0} icon={<ClipboardCheck className="h-5 w-5" />} accent="brand" />
        <StatCard label={t("dashboard.pending")} value={pendingCount} icon={<Clock className="h-5 w-5" />} accent="warning" />
        <StatCard label={t("dashboard.completed")} value={(stats.completed as number) || 0} icon={<CheckCircle2 className="h-5 w-5" />} accent="success" />
      </div>

      <section className="rounded-2xl border border-border bg-white p-5 shadow-sm">
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
    </div>
  );
}
