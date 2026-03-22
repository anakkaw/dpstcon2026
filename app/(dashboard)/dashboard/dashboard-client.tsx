"use client";

import dynamic from "next/dynamic";
import { getRoleLabels } from "@/lib/labels";
import { useI18n } from "@/lib/i18n";
import { Sparkles } from "lucide-react";

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
    <div className="max-w-6xl flex flex-col gap-8">
      {/* Welcome banner */}
      <div className="bg-welcome-gradient rounded-2xl p-8 text-white shadow-xl relative overflow-hidden">
        {/* Decorative orbs */}
        <div className="absolute -top-20 -right-20 w-72 h-72 rounded-full opacity-20 blur-3xl bg-orb-brand" />
        <div className="absolute -bottom-16 -left-16 w-56 h-56 rounded-full opacity-10 blur-2xl bg-orb-brand" />
        {/* Content */}
        <div className="relative">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="h-4 w-4 text-amber-400" />
            <p className="text-amber-300 text-sm font-medium">{roleLabels[role] || role} — DPSTCon 2026</p>
          </div>
          <h1 className="text-3xl font-bold">{t("dashboard.welcome", { name: userName })}</h1>
          <p className="text-slate-400 text-sm mt-2">{t("dashboard.welcomeSubtitle")}</p>
        </div>
      </div>

      {role === "AUTHOR" && <AuthorDashboard stats={stats} />}
      {role === "REVIEWER" && <ReviewerDashboard stats={stats} />}
      {isAdmin && <AdminDashboard stats={stats} />}
      {role === "COMMITTEE" && <CommitteeDashboard />}
    </div>
  );
}
