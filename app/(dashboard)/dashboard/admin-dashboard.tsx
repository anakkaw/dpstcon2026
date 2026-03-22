"use client";

import { StatCard } from "@/components/ui/stat-card";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  getSubmissionStatusLabels,
  SUBMISSION_STATUS_COLORS,
} from "@/lib/labels";
import { useI18n } from "@/lib/i18n";
import {
  FileText, ClipboardCheck, Users, BarChart3,
  UserPlus, Settings, Download,
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

export default function AdminDashboard({ stats }: { stats: Record<string, unknown> }) {
  const { t } = useI18n();
  const statusLabels = getSubmissionStatusLabels(t);

  /* Full static class strings — Tailwind v4 scanner finds these */
  const quickActions = [
    { href: "/admin/users", icon: <UserPlus className="h-5 w-5" />, label: t("dashboard.manageUsers"), sub: t("dashboard.manageUsersDesc"), cardBg: "bg-action-blue", iconBg: "bg-blue-500", iconShadow: "shadow-blue-glow" },
    { href: "/submissions", icon: <FileText className="h-5 w-5" />, label: t("dashboard.managePapers"), sub: t("dashboard.managePapersDesc"), cardBg: "bg-action-orange", iconBg: "bg-brand-500", iconShadow: "shadow-brand-glow" },
    { href: "/deadlines", icon: <Settings className="h-5 w-5" />, label: t("dashboard.scheduleSetting"), sub: t("dashboard.scheduleSettingDesc"), cardBg: "bg-action-green", iconBg: "bg-emerald-500", iconShadow: "shadow-emerald-glow" },
    { href: "/api/exports/proceedings?format=csv", icon: <Download className="h-5 w-5" />, label: t("dashboard.exportData"), sub: t("dashboard.exportDataDesc"), cardBg: "bg-action-violet", iconBg: "bg-violet-500", iconShadow: "shadow-violet-glow", isExternal: true },
  ];

  const byStatus = (stats.submissionsByStatus || {}) as Record<string, number>;
  const byTrack = (stats.submissionsByTrack || []) as { name: string; count: number }[];
  const totalSubs = (stats.totalSubmissions as number) || 0;

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <StatCard label={t("dashboard.totalPapers")} value={(stats.totalSubmissions as number) || 0} icon={<FileText className="h-5 w-5" />} accent="brand" />
        <StatCard label={t("dashboard.reviewers")} value={(stats.totalReviewers as number) || 0} icon={<Users className="h-5 w-5" />} accent="info" />
        <StatCard label={t("dashboard.totalReviews")} value={(stats.totalReviews as number) || 0} icon={<ClipboardCheck className="h-5 w-5" />} accent="warning" />
        <StatCard label={t("dashboard.accepted")} value={byStatus.ACCEPTED || 0} icon={<BarChart3 className="h-5 w-5" />} accent="success" />
      </div>

      {/* Quick Actions */}
      <div>
        <h3 className="text-base font-semibold text-ink mb-4">{t("dashboard.quickActions")}</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {quickActions.map((item) => {
            const Wrapper = item.isExternal ? "a" : Link;
            const extraProps = item.isExternal ? { download: true } : {};
            return (
              <Wrapper key={item.label} href={item.href} {...(extraProps as Record<string, unknown>)}>
                <div className={`group rounded-2xl border border-border p-5 hover:shadow-lg hover:-translate-y-1 transition-all duration-300 cursor-pointer ${item.cardBg}`}>
                  <div className={`h-12 w-12 rounded-xl flex items-center justify-center text-white mb-4 group-hover:scale-110 transition-transform duration-300 ${item.iconBg} ${item.iconShadow}`}>
                    {item.icon}
                  </div>
                  <p className="text-sm font-semibold text-ink">{item.label}</p>
                  <p className="text-xs text-ink-muted mt-0.5">{item.sub}</p>
                </div>
              </Wrapper>
            );
          })}
        </div>
      </div>

      {/* Status + Track breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {Object.keys(byStatus).length > 0 && (
          <Card>
            <CardHeader><h3 className="text-base font-semibold text-ink">{t("dashboard.summaryByStatus")}</h3></CardHeader>
            <CardBody>
              <div className="flex flex-wrap gap-2">
                {Object.entries(byStatus).map(([status, count]) => (
                  <Badge key={status} tone={SUBMISSION_STATUS_COLORS[status] || "neutral"}>
                    {statusLabels[status] || status}: {count}
                  </Badge>
                ))}
              </div>
            </CardBody>
          </Card>
        )}

        {byTrack.length > 0 && (
          <Card>
            <CardHeader><h3 className="text-base font-semibold text-ink">{t("dashboard.summaryByTrack")}</h3></CardHeader>
            <CardBody>
              <div className="space-y-4">
                {byTrack.map((tr, i) => {
                  const pct = Math.round((tr.count / Math.max(totalSubs, 1)) * 100);
                  return (
                    <div key={i}>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-sm font-medium text-ink">{tr.name}</span>
                        <span className="text-sm font-bold text-ink">{tr.count}</span>
                      </div>
                      <div className="w-full h-2.5 rounded-full bg-gray-100 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-700 ${barClasses[i % barClasses.length]}`}
                          style={{ width: `${Math.max(pct, 4)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardBody>
          </Card>
        )}
      </div>
    </>
  );
}
