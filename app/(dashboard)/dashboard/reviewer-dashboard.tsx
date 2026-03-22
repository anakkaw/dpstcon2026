"use client";

import { StatCard } from "@/components/ui/stat-card";
import { Card, CardBody } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";
import { ClipboardCheck, Clock, CheckCircle2, ArrowRight } from "lucide-react";
import Link from "next/link";

export default function ReviewerDashboard({ stats }: { stats: Record<string, unknown> }) {
  const { t } = useI18n();

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <StatCard label={t("dashboard.assignedTasks")} value={(stats.totalAssignments as number) || 0} icon={<ClipboardCheck className="h-5 w-5" />} accent="brand" />
        <StatCard label={t("dashboard.pending")} value={(stats.pending as number) || 0} icon={<Clock className="h-5 w-5" />} accent="warning" />
        <StatCard label={t("dashboard.completed")} value={(stats.completed as number) || 0} icon={<CheckCircle2 className="h-5 w-5" />} accent="success" />
      </div>

      {((stats.pending as number) || 0) > 0 && (
        <Card accent="warning">
          <CardBody className="flex items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-semibold text-ink">{t("dashboard.hasPendingTasks")}</h3>
              <p className="text-sm text-ink-muted mt-0.5">{t("dashboard.checkAssignedPapers")}</p>
            </div>
            <Link href="/reviews">
              <Button><ArrowRight className="h-4 w-4" />{t("dashboard.goToReviews")}</Button>
            </Link>
          </CardBody>
        </Card>
      )}
    </>
  );
}
