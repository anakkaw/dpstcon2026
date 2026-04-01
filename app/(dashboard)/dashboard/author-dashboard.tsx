"use client";

import Link from "next/link";
import { StatCard } from "@/components/ui/stat-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  getSubmissionStatusLabels,
  SUBMISSION_STATUS_COLORS,
} from "@/lib/labels";
import { useI18n } from "@/lib/i18n";
import {
  FileText, Send, Clock, CheckCircle2,
  Plus, ArrowRight, Calendar, Mic,
} from "lucide-react";
import { SubmissionPipeline } from "@/components/author/submission-pipeline";
import { NextActionCard } from "@/components/author/next-action-card";
import { getNextAction, getDaysUntil, getRelevantDeadlineKey } from "@/lib/author-utils";
import { formatDate } from "@/lib/utils";

interface AuthorSubmission {
  id: string;
  title: string;
  paperCode?: string | null;
  status: string;
  hasFile: boolean;
  trackName: string | null;
  reviewTotal: number;
  reviewCompleted: number;
}

interface AuthorPresentation {
  submissionId: string;
  paperCode?: string | null;
  type: string;
  status: string;
  scheduledAt: string | null;
  room: string | null;
  duration: number | null;
}

export default function AuthorDashboard({ stats }: { stats: Record<string, unknown> }) {
  const { t, locale } = useI18n();
  const statusLabels = getSubmissionStatusLabels(t);
  const byStatus = (stats.byStatus || {}) as Record<string, number>;
  const subs = (stats.submissions || []) as AuthorSubmission[];
  const deadlines = (stats.deadlines || {}) as Record<string, string>;
  const presentations = (stats.presentations || []) as AuthorPresentation[];

  const actionItems = subs
    .map((s) => {
      const action = getNextAction(s.status, s.hasFile, t);
      if (!action) return null;
      const deadlineKey = getRelevantDeadlineKey(s.status);
      const deadline = deadlineKey ? deadlines[deadlineKey] : undefined;
      const daysLeft = deadline ? getDaysUntil(deadline) : undefined;
      return { ...action, sub: s, deadline, daysLeft };
    })
    .filter(Boolean) as {
      label: string;
      description: string;
      urgency: "normal" | "warning" | "urgent";
      sub: AuthorSubmission;
      deadline?: string;
      daysLeft?: number;
    }[];

  const deadlineList = [
    { key: "submissionDeadline", label: t("dashboard.submissionDeadline") },
    { key: "reviewDeadline", label: t("dashboard.reviewDeadline") },
    { key: "notificationDate", label: t("dashboard.notificationDate") },
    { key: "cameraReadyDeadline", label: t("dashboard.cameraReadyDeadline") },
  ]
    .map((d) => ({ ...d, date: deadlines[d.key], daysLeft: deadlines[d.key] ? getDaysUntil(deadlines[d.key]) : 999 }))
    .filter((d) => d.date && d.daysLeft > -30)
    .sort((a, b) => a.daysLeft - b.daysLeft);

  const presWithTitle = presentations.map((p) => ({
    ...p,
    title: subs.find((s) => s.id === p.submissionId)?.title || "",
    paperCode: p.paperCode || subs.find((s) => s.id === p.submissionId)?.paperCode || null,
  }));

  return (
    <>
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard label={t("dashboard.totalPapers")} value={(stats.totalSubmissions as number) || 0} icon={<FileText className="h-5 w-5" />} accent="brand" />
            <StatCard label={t("dashboard.drafts")} value={byStatus.DRAFT || 0} icon={<Clock className="h-5 w-5" />} accent="warning" />
            <StatCard label={t("dashboard.underReview")} value={(byStatus.SUBMITTED || 0) + (byStatus.UNDER_REVIEW || 0)} icon={<Send className="h-5 w-5" />} accent="info" />
            <StatCard label={t("dashboard.accepted")} value={byStatus.ACCEPTED || 0} icon={<CheckCircle2 className="h-5 w-5" />} accent="success" />
          </div>
        </div>

        <section className="rounded-2xl border border-border bg-white p-5 shadow-sm">
          <div className="space-y-1">
            <h2 className="flex items-center gap-2 text-base font-semibold text-ink">
              <Calendar className="h-4 w-4" />
              {t("dashboard.deadlineSnapshot")}
            </h2>
            <p className="text-sm text-ink-muted">{t("dashboard.deadlineSnapshotDesc")}</p>
          </div>
          <div className="mt-4 space-y-2.5">
            {deadlineList.map((d) => {
              const isPast = d.daysLeft < 0;
              return (
                <div key={d.key} className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-xs font-medium text-ink">{d.label}</p>
                    <p className="text-[11px] text-ink-muted">{formatDate(d.date, locale)}</p>
                  </div>
                  <Badge tone={isPast ? "neutral" : d.daysLeft <= 7 ? "danger" : d.daysLeft <= 30 ? "warning" : "info"}>
                    {isPast ? t("common.passed") : t("common.daysLeft", { n: d.daysLeft })}
                  </Badge>
                </div>
              );
            })}
          </div>
        </section>
      </div>

      {actionItems.length > 0 && (
        <section className="space-y-3">
          <div className="space-y-1">
            <h2 className="text-base font-semibold text-ink">{t("dashboard.pendingWork")}</h2>
            <p className="text-sm text-ink-muted">{t("dashboard.pendingWorkDesc")}</p>
          </div>
          <div className="space-y-2">
            {actionItems.map((item) => (
              <NextActionCard
                key={item.sub.id}
                action={item}
                paperTitle={item.sub.title}
                href={`/submissions/${item.sub.id}`}
                deadline={item.deadline}
                daysLeft={item.daysLeft}
              />
            ))}
          </div>
        </section>
      )}

      {presWithTitle.length > 0 && (
        <section className="space-y-3">
          <div className="space-y-1">
            <h2 className="flex items-center gap-2 text-base font-semibold text-ink">
              <Mic className="h-4 w-4" />
              {t("dashboard.presentationSchedule")}
            </h2>
            <p className="text-sm text-ink-muted">{t("dashboard.presentationScheduleDesc")}</p>
          </div>
          <div className="overflow-hidden rounded-2xl border border-border bg-white shadow-sm">
            {presWithTitle.map((p, i) => (
              <div
                key={`${p.submissionId}-${i}`}
                className={`flex items-center justify-between gap-4 px-5 py-4 ${i !== 0 ? "border-t border-border-light" : ""}`}
              >
                <div>
                  <p className="text-sm font-semibold text-ink">{p.title}</p>
                  {p.paperCode && <p className="mt-1 font-mono text-xs text-brand-600">{p.paperCode}</p>}
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <Badge tone={p.type === "ORAL" ? "info" : "neutral"}>
                      {p.type === "ORAL" ? t("dashboard.oralPresentation") : t("dashboard.poster")}
                    </Badge>
                    {p.room && <span className="text-xs text-ink-muted">{p.room}</span>}
                    {p.scheduledAt && <span className="text-xs text-ink-muted">{formatDate(p.scheduledAt, locale)}</span>}
                  </div>
                </div>
                <Badge tone={p.status === "SCHEDULED" ? "success" : "warning"}>
                  {p.status === "SCHEDULED" ? t("dashboard.scheduled") : t("dashboard.pendingSchedule")}
                </Badge>
              </div>
            ))}
          </div>
        </section>
      )}

      {subs.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-end justify-between gap-4">
            <div className="space-y-1">
              <h2 className="text-base font-semibold text-ink">{t("dashboard.submissionList")}</h2>
              <p className="text-sm text-ink-muted">{t("dashboard.submissionListDesc")}</p>
            </div>
            <Link href="/submissions">
              <Button variant="ghost" size="sm">{t("common.viewAll")} <ArrowRight className="h-3.5 w-3.5" /></Button>
            </Link>
          </div>
          <div className="overflow-hidden rounded-2xl border border-border bg-white shadow-sm">
            {subs.map((s, index) => (
              <Link key={s.id} href={`/submissions/${s.id}`}>
                <div className={`cursor-pointer px-5 py-4 transition-colors hover:bg-surface-hover ${index !== 0 ? "border-t border-border-light" : ""}`}>
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-ink">{s.title}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        {s.trackName && <span className="text-[11px] text-ink-muted">{s.trackName}</span>}
                        {s.reviewTotal > 0 && (
                          <span className="text-[11px] font-medium text-brand-600">
                            {t("dashboard.reviews")} {s.reviewCompleted}/{s.reviewTotal}
                          </span>
                        )}
                      </div>
                    </div>
                    <Badge tone={SUBMISSION_STATUS_COLORS[s.status] || "neutral"}>
                      {statusLabels[s.status] || s.status}
                    </Badge>
                  </div>
                  <SubmissionPipeline status={s.status} compact />
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {subs.length === 0 && (
        <section className="rounded-2xl border border-border bg-white px-5 py-5 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-semibold text-ink">{t("dashboard.newPaper")}</h3>
              <p className="mt-0.5 text-sm text-ink-muted">{t("dashboard.noPendingWorkDesc")}</p>
            </div>
            <Link href="/submissions/new">
              <Button><Plus className="h-4 w-4" />{t("dashboard.submitPaper")}</Button>
            </Link>
          </div>
        </section>
      )}
    </>
  );
}
