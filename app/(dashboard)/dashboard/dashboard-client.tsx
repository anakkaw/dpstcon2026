"use client";

import dynamic from "next/dynamic";
import { getRoleLabels } from "@/lib/labels";
import { useI18n } from "@/lib/i18n";

const AuthorDashboard = dynamic(() => import("./author-dashboard"));
const ReviewerDashboard = dynamic(() => import("./reviewer-dashboard"));
const AdminDashboard = dynamic(() => import("./admin-dashboard"));
const CommitteeDashboard = dynamic(() => import("./committee-dashboard"));

interface DashboardClientProps {
  role: string;
  userName: string;
  stats: Record<string, unknown>;
}

export function DashboardClient({ role, userName, stats }: DashboardClientProps) {
  const { t } = useI18n();
  const roleLabels = getRoleLabels(t);
  const isAdmin = ["ADMIN", "PROGRAM_CHAIR"].includes(role);

  return (
    <div className="flex max-w-6xl flex-col gap-8">
      <section className="space-y-3 border-b border-border pb-6">
        <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-ink-muted">
          {roleLabels[role] || role}
        </p>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-1">
            <h1 className="text-3xl font-semibold tracking-tight text-ink">
              {t("dashboard.workspaceTitle")}
            </h1>
            <p className="max-w-2xl text-sm text-ink-muted">
              {t("dashboard.workspaceSubtitle", { name: userName, role: roleLabels[role] || role })}
            </p>
          </div>
          <div className="rounded-2xl border border-border bg-white px-4 py-3 shadow-sm lg:min-w-[240px]">
            <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-ink-muted">
              {t("dashboard.activeUser")}
            </p>
            <p className="mt-1 text-sm font-semibold text-ink">{userName}</p>
            <p className="mt-0.5 text-xs text-ink-muted">{roleLabels[role] || role}</p>
          </div>
        </div>
      </section>

      {role === "AUTHOR" && <AuthorDashboard stats={stats} />}
      {role === "REVIEWER" && <ReviewerDashboard stats={stats} />}
      {isAdmin && <AdminDashboard stats={stats} />}
      {role === "COMMITTEE" && <CommitteeDashboard />}
    </div>
  );
}
