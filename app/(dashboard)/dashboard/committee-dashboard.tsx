"use client";

import Link from "next/link";
import { StatCard } from "@/components/ui/stat-card";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";
import {
  Mic,
  Image as ImageIcon,
  ArrowRight,
  Calendar,
  Clock,
  CheckCircle2,
  Star,
} from "lucide-react";

interface CommitteeStats {
  oralCount?: number;
  posterCount?: number;
  scheduledCount?: number;
  pendingCount?: number;
  completedCount?: number;
}

export default function CommitteeDashboard({ stats }: { stats?: Record<string, unknown> }) {
  const { t } = useI18n();
  const data = (stats || {}) as CommitteeStats;
  const oralCount = data.oralCount ?? 0;
  const posterCount = data.posterCount ?? 0;
  const totalCount = oralCount + posterCount;
  const pendingCount = data.pendingCount ?? 0;
  const completedCount = data.completedCount ?? 0;
  const scheduledCount = data.scheduledCount ?? 0;

  return (
    <div className="space-y-6">
      {/* Primary stats — what the judge actually cares about */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard
          label={t("scoring.tabPending")}
          value={pendingCount}
          icon={<Clock className="h-5 w-5" />}
          accent="warning"
        />
        <StatCard
          label={t("scoring.tabDone")}
          value={completedCount}
          icon={<CheckCircle2 className="h-5 w-5" />}
          accent="success"
        />
        <StatCard
          label={t("dashboard.committeeOralCount")}
          value={oralCount}
          icon={<Mic className="h-5 w-5" />}
          accent="info"
        />
        <StatCard
          label={t("dashboard.committeePosterCount")}
          value={posterCount}
          icon={<ImageIcon className="h-5 w-5" />}
          accent="brand"
        />
      </div>

      <section className="rounded-2xl border border-border bg-gradient-to-br from-white to-brand-50/30 p-5 shadow-elev-1">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-1">
            <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-ink-muted">
              {t("dashboard.committeeOverview")}
            </p>
            <h2 className="text-xl font-semibold text-ink">
              {pendingCount > 0
                ? t("dashboard.committeePendingHeadline", { n: pendingCount })
                : totalCount > 0
                  ? t("dashboard.committeeAllDone")
                  : t("dashboard.committeeNoAssignments")}
            </h2>
            <p className="max-w-2xl text-sm text-ink-muted">
              {t("dashboard.committeeOverviewDesc")}
            </p>
            {scheduledCount > 0 && (
              <p className="flex items-center gap-1.5 pt-1 text-sm text-ink-light">
                <Calendar className="h-3.5 w-3.5" />
                {t("dashboard.committeeUpcomingCount", { n: scheduledCount })}
              </p>
            )}
          </div>
          <div className="flex gap-2">
            <Link href="/presentations/scoring">
              <Button variant="primary">
                <Star className="h-4 w-4" />
                {pendingCount > 0 ? t("dashboard.committeeStartScoring") : t("nav.scoring")}
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
