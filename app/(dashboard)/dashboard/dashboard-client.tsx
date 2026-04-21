"use client";

import dynamic from "next/dynamic";
import { getRoleLabels } from "@/lib/labels";
import { useI18n } from "@/lib/i18n";

const AuthorDashboard = dynamic(() => import("./author-dashboard"));
const ReviewerDashboard = dynamic(() => import("./reviewer-dashboard"));
const AdminDashboard = dynamic(() => import("./admin-dashboard"));
const CommitteeDashboard = dynamic(() => import("./committee-dashboard"));

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

      {visibleRoles.includes("AUTHOR") && (
        <AuthorDashboard stats={statsByRole.AUTHOR || {}} />
      )}
      {visibleRoles.includes("REVIEWER") && (
        <ReviewerDashboard stats={statsByRole.REVIEWER || {}} />
      )}
      {showManagerDashboard && <AdminDashboard stats={statsByRole.MANAGER || {}} roles={visibleRoles} />}
      {visibleRoles.includes("COMMITTEE") && <CommitteeDashboard stats={statsByRole.COMMITTEE} />}
    </div>
  );
}
