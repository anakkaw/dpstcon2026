"use client";

import dynamic from "next/dynamic";
import { getRoleLabels } from "@/lib/labels";
import { useI18n } from "@/lib/i18n";
import { ClipboardCheck, LayoutDashboard, Star, FileText } from "lucide-react";

const AuthorDashboard = dynamic(() => import("./author-dashboard"));
const ReviewerDashboard = dynamic(() => import("./reviewer-dashboard"));
const AdminDashboard = dynamic(() => import("./admin-dashboard"));
const CommitteeDashboard = dynamic(() => import("./committee-dashboard"));

function RoleSectionHeader({ icon, title, subtitle }: { icon: React.ReactNode; title: string; subtitle: string }) {
  return (
    <div className="flex items-center gap-3 border-l-4 border-brand-500 pl-4 py-1">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
        {icon}
      </div>
      <div>
        <h2 className="text-lg font-semibold text-ink leading-tight">{title}</h2>
        <p className="text-xs text-ink-muted">{subtitle}</p>
      </div>
    </div>
  );
}

interface DashboardClientProps {
  primaryRole: string;
  roles: string[];
  userName: string;
  statsByRole: Record<string, Record<string, unknown>>;
}

export function DashboardClient({
  primaryRole,
  roles,
  userName,
  statsByRole,
}: DashboardClientProps) {
  const { t } = useI18n();
  const roleLabels = getRoleLabels(t);
  const visibleRoles = Array.from(new Set(roles));
  const roleSummary = visibleRoles.map((role) => roleLabels[role] || role).join(", ");
  const showManagerDashboard = visibleRoles.some((role) =>
    ["ADMIN", "PROGRAM_CHAIR"].includes(role)
  );

  return (
    <div className="flex max-w-6xl flex-col gap-8">
      <section className="space-y-3 border-b border-border pb-6">
        <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-ink-muted">
          {roleLabels[primaryRole] || primaryRole}
        </p>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-1">
            <h1 className="text-3xl font-semibold tracking-tight text-ink">
              {t("dashboard.workspaceTitle")}
            </h1>
            <p className="max-w-2xl text-sm text-ink-muted">
              {t("dashboard.workspaceSubtitle", { name: userName, role: roleSummary })}
            </p>
          </div>
          <div className="rounded-2xl border border-border bg-white px-4 py-3 shadow-sm lg:min-w-[240px]">
            <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-ink-muted">
              {t("dashboard.activeUser")}
            </p>
            <p className="mt-1 text-sm font-semibold text-ink">{userName}</p>
            <p className="mt-0.5 text-xs text-ink-muted">{roleSummary}</p>
          </div>
        </div>
      </section>

      {(() => {
        // Count distinct workspace contexts to decide whether to show section headers
        const contextCount =
          (visibleRoles.includes("AUTHOR") ? 1 : 0) +
          (visibleRoles.includes("REVIEWER") ? 1 : 0) +
          (showManagerDashboard ? 1 : 0) +
          (visibleRoles.includes("COMMITTEE") ? 1 : 0);
        const hasMultiple = contextCount > 1;
        return (
          <>
            {visibleRoles.includes("AUTHOR") && (
              <section className="space-y-4">
                {hasMultiple && (
                  <RoleSectionHeader
                    icon={<FileText className="h-4.5 w-4.5" />}
                    title={t("dashboard.roleSection.author")}
                    subtitle={t("dashboard.roleSection.authorDesc")}
                  />
                )}
                <AuthorDashboard stats={statsByRole.AUTHOR || {}} />
              </section>
            )}
            {visibleRoles.includes("REVIEWER") && (
              <section className="space-y-4">
                {hasMultiple && (
                  <RoleSectionHeader
                    icon={<ClipboardCheck className="h-4.5 w-4.5" />}
                    title={t("dashboard.roleSection.reviewer")}
                    subtitle={t("dashboard.roleSection.reviewerDesc")}
                  />
                )}
                <ReviewerDashboard stats={statsByRole.REVIEWER || {}} />
              </section>
            )}
            {showManagerDashboard && (
              <section className="space-y-4">
                {hasMultiple && (
                  <RoleSectionHeader
                    icon={<LayoutDashboard className="h-4.5 w-4.5" />}
                    title={visibleRoles.includes("ADMIN") ? t("dashboard.roleSection.admin") : t("dashboard.roleSection.chair")}
                    subtitle={visibleRoles.includes("ADMIN") ? t("dashboard.roleSection.adminDesc") : t("dashboard.roleSection.chairDesc")}
                  />
                )}
                <AdminDashboard stats={statsByRole.MANAGER || {}} roles={visibleRoles} />
              </section>
            )}
            {visibleRoles.includes("COMMITTEE") && (
              <section className="space-y-4">
                {hasMultiple && (
                  <RoleSectionHeader
                    icon={<Star className="h-4.5 w-4.5" />}
                    title={t("dashboard.roleSection.committee")}
                    subtitle={t("dashboard.roleSection.committeeDesc")}
                  />
                )}
                <CommitteeDashboard stats={statsByRole.COMMITTEE} />
              </section>
            )}
          </>
        );
      })()}
    </div>
  );
}
