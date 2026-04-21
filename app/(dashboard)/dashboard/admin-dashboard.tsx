"use client";

import { StatCard } from "@/components/ui/stat-card";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  getSubmissionStatusLabels,
  SUBMISSION_STATUS_COLORS,
} from "@/lib/labels";
import { useI18n } from "@/lib/i18n";
import {
  FileText, ClipboardCheck, Users, BarChart3,
  UserPlus, Settings, Download, ArrowRight,
} from "lucide-react";
import Link from "next/link";

const barClasses = [
  "bg-bar-brand",
  "bg-bar-blue",
  "bg-bar-green",
  "bg-bar-violet",
  "bg-bar-pink",
  "bg-bar-amber",
];

export default function AdminDashboard({ stats, roles = [] }: { stats: Record<string, unknown>; roles?: string[] }) {
  const { t } = useI18n();
  const statusLabels = getSubmissionStatusLabels(t);
  const isAdmin = roles.includes("ADMIN");

  /* Full static class strings — Tailwind v4 scanner finds these */
  const quickActions = isAdmin
    ? [
        { href: "/admin/users", icon: <UserPlus className="h-4.5 w-4.5" />, label: t("dashboard.manageUsers"), sub: t("dashboard.manageUsersDesc"), iconWrap: "bg-blue-50 text-blue-600" },
        { href: "/submissions", icon: <FileText className="h-4.5 w-4.5" />, label: t("dashboard.managePapers"), sub: t("dashboard.managePapersDesc"), iconWrap: "bg-brand-50 text-brand-600" },
        { href: "/deadlines", icon: <Settings className="h-4.5 w-4.5" />, label: t("dashboard.scheduleSetting"), sub: t("dashboard.scheduleSettingDesc"), iconWrap: "bg-emerald-50 text-emerald-600" },
        { href: "/api/exports/proceedings?format=csv", icon: <Download className="h-4.5 w-4.5" />, label: t("dashboard.exportData"), sub: t("dashboard.exportDataDesc"), iconWrap: "bg-violet-50 text-violet-600", isExternal: true },
      ]
    : [
        { href: "/submissions", icon: <FileText className="h-4.5 w-4.5" />, label: t("nav.workbench"), sub: t("dashboard.assignReviewersDesc"), iconWrap: "bg-brand-50 text-brand-600" },
        { href: "/track-team", icon: <Users className="h-4.5 w-4.5" />, label: t("nav.trackTeam"), sub: t("dashboard.trackTeamDesc"), iconWrap: "bg-violet-50 text-violet-600" },
        { href: "/deadlines", icon: <Settings className="h-4.5 w-4.5" />, label: t("dashboard.scheduleSetting"), sub: t("dashboard.scheduleSettingDesc"), iconWrap: "bg-emerald-50 text-emerald-600" },
      ];

  const byStatus = (stats.submissionsByStatus || {}) as Record<string, number>;
  const byTrack = (stats.submissionsByTrack || []) as { name: string; count: number }[];
  const totalSubs = (stats.totalSubmissions as number) || 0;
  const orderedStatusRows = Object.entries(byStatus).sort((a, b) => b[1] - a[1]);

  const submittedCount = (byStatus.SUBMITTED || 0);

  return (
    <>
      {submittedCount > 0 && (
        <Alert tone="warning">
          <div className="flex items-center justify-between gap-3">
            <span className="font-medium">{t("dashboard.adminPendingAssign", { n: submittedCount })}</span>
            <Link href="/submissions"><Button size="sm"><ArrowRight className="h-3.5 w-3.5" />{t("dashboard.managePapers")}</Button></Link>
          </div>
        </Alert>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <StatCard label={t("dashboard.totalPapers")} value={(stats.totalSubmissions as number) || 0} icon={<FileText className="h-5 w-5" />} accent="brand" />
        <StatCard label={t("dashboard.reviewers")} value={(stats.totalReviewers as number) || 0} icon={<Users className="h-5 w-5" />} accent="info" />
        <StatCard label={t("dashboard.totalReviews")} value={(stats.totalReviews as number) || 0} icon={<ClipboardCheck className="h-5 w-5" />} accent="warning" />
        <StatCard label={t("dashboard.accepted")} value={byStatus.ACCEPTED || 0} icon={<BarChart3 className="h-5 w-5" />} accent="success" />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.95fr)]">
        <section className="space-y-4">
          <div className="space-y-1">
            <h2 className="text-base font-semibold text-ink">{t("dashboard.priorityActions")}</h2>
            <p className="text-sm text-ink-muted">
              {isAdmin ? t("dashboard.priorityActionsDesc") : t("dashboard.priorityActionsDescChair")}
            </p>
          </div>
          <div className="overflow-hidden rounded-2xl border border-border bg-white shadow-sm">
            {quickActions.map((item, index) => {
              const Wrapper = item.isExternal ? "a" : Link;
              const extraProps = item.isExternal ? { download: true } : {};
              return (
                <Wrapper key={item.label} href={item.href} {...(extraProps as Record<string, unknown>)}>
                  <div
                    className={`flex items-center gap-4 px-5 py-4 transition-colors hover:bg-surface-hover ${
                      index !== 0 ? "border-t border-border-light" : ""
                    }`}
                  >
                    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${item.iconWrap}`}>
                      {item.icon}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-ink">{item.label}</p>
                      <p className="text-xs text-ink-muted">{item.sub}</p>
                    </div>
                    <ArrowRight className="h-4 w-4 shrink-0 text-ink-muted" />
                  </div>
                </Wrapper>
              );
            })}
          </div>
        </section>

        {orderedStatusRows.length > 0 && (
          <section className="rounded-2xl border border-border bg-white p-5 shadow-sm">
            <div className="space-y-1">
              <h2 className="text-base font-semibold text-ink">{t("dashboard.systemHealth")}</h2>
              <p className="text-sm text-ink-muted">{t("dashboard.systemHealthDesc")}</p>
            </div>
            <div className="mt-5 space-y-4">
              {orderedStatusRows.map(([status, count], index) => {
                const pct = Math.round((count / Math.max(totalSubs, 1)) * 100);
                return (
                  <div key={status} className="space-y-1.5">
                    <div className="flex items-center justify-between gap-3">
                      <Badge tone={SUBMISSION_STATUS_COLORS[status] || "neutral"}>
                        {statusLabels[status] || status}
                      </Badge>
                      <span className="text-sm font-semibold text-ink">{count}</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className={`h-full rounded-full transition-all duration-700 ${barClasses[index % barClasses.length]}`}
                        style={{ width: `${Math.max(pct, 2)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}
      </div>

      {byTrack.length > 0 && (
        <section className="space-y-3">
          <div className="space-y-1">
            <h2 className="text-base font-semibold text-ink">{t("dashboard.trackLoad")}</h2>
            <p className="text-sm text-ink-muted">{t("dashboard.trackLoadDesc")}</p>
          </div>
          <div className="rounded-2xl border border-border bg-white p-5 shadow-sm">
            <div className="space-y-4">
              {byTrack.map((tr, i) => {
                const pct = Math.round((tr.count / Math.max(totalSubs, 1)) * 100);
                return (
                  <div key={`${tr.name}-${i}`} className="space-y-1.5">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm font-medium text-ink">{tr.name}</span>
                      <span className="text-sm font-semibold text-ink">{tr.count}</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className={`h-full rounded-full transition-all duration-700 ${barClasses[i % barClasses.length]}`}
                        style={{ width: `${Math.max(pct, 2)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}
    </>
  );
}
