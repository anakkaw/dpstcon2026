"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";

export default function CommitteeDashboard() {
  const { t } = useI18n();

  return (
    <section className="rounded-2xl border border-border bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <h2 className="text-base font-semibold text-ink">{t("dashboard.committeeOverview")}</h2>
          <p className="text-sm text-ink-muted">{t("dashboard.committeeOverviewDesc")}</p>
        </div>
        <div className="flex gap-2">
          <Link href="/presentations/oral"><Button variant="secondary" size="sm">{t("dashboard.oralPresentation")}</Button></Link>
          <Link href="/presentations/poster"><Button variant="secondary" size="sm">{t("dashboard.poster")}</Button></Link>
        </div>
      </div>
    </section>
  );
}
