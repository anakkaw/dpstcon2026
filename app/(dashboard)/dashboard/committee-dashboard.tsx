"use client";

import Link from "next/link";
import { StatCard } from "@/components/ui/stat-card";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";
import { Mic, Image as ImageIcon, ArrowRight, Calendar, LayoutGrid } from "lucide-react";

interface CommitteeStats {
  oralCount?: number;
  posterCount?: number;
  scheduledCount?: number;
}

export default function CommitteeDashboard({ stats }: { stats?: Record<string, unknown> }) {
  const { t } = useI18n();
  const data = (stats || {}) as CommitteeStats;
  const oralCount = data.oralCount ?? 0;
  const posterCount = data.posterCount ?? 0;
  const totalCount = oralCount + posterCount;
  const scheduledCount = data.scheduledCount ?? 0;

  return (
    <div className="space-y-6">
      {/* 4 stat cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label={t("dashboard.committeeOralCount")} value={oralCount} icon={<Mic className="h-5 w-5" />} accent="info" />
        <StatCard label={t("dashboard.committeePosterCount")} value={posterCount} icon={<ImageIcon className="h-5 w-5" />} accent="brand" />
        <StatCard label={t("common.total")} value={totalCount} icon={<LayoutGrid className="h-5 w-5" />} accent="success" />
        <StatCard label={t("dashboard.scheduled")} value={scheduledCount} icon={<Calendar className="h-5 w-5" />} accent="warning" />
      </div>

      {/* 2-col layout: primary queue + upcoming */}
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(280px,0.85fr)]">
        <section className="rounded-2xl border border-border bg-white p-5 shadow-elev-1">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="space-y-1">
              <h2 className="text-base font-semibold text-ink">{t("dashboard.committeeOverview")}</h2>
              <p className="text-sm text-ink-muted">{t("dashboard.committeeOverviewDesc")}</p>
            </div>
            <div className="flex gap-2">
              <Link href="/presentations/oral">
                <Button variant="secondary" size="sm">
                  <Mic className="h-3.5 w-3.5" />
                  {t("dashboard.oralPresentation")}
                </Button>
              </Link>
              <Link href="/presentations/poster">
                <Button variant="secondary" size="sm">
                  <ImageIcon className="h-3.5 w-3.5" />
                  {t("dashboard.poster")}
                </Button>
              </Link>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-border bg-white p-5 shadow-elev-1">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="space-y-1">
              <h2 className="text-base font-semibold text-ink">{t("dashboard.committeeUpcoming")}</h2>
              <p className="text-sm text-ink-muted">{t("dashboard.committeeUpcomingDesc")}</p>
            </div>
            <Link href="/presentations/oral">
              <Button variant="ghost" size="sm">
                {t("common.viewAll")} <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
