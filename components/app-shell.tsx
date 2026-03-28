"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { getNavItemsForRoles } from "@/lib/constants";
import { getRoleLabels } from "@/lib/labels";
import { signOut } from "@/lib/auth-client";
import { useI18n } from "@/lib/i18n";
import type { TranslationKey } from "@/lib/i18n/translations/th";
import { LanguageToggle } from "@/components/language-toggle";
import { NotificationBell } from "@/components/notification-bell";
import { useDashboardAuth } from "@/components/dashboard-auth-context";
import { Footer } from "@/components/ui/footer";
import {
  LayoutDashboard,
  FileText,
  ClipboardCheck,
  Presentation,
  Mic,
  Image as ImageIcon,
  Settings,
  Calendar,
  Users,
  Files,
  BarChart3,
  LogOut,
  Menu,
  X,
} from "lucide-react";
import { useState } from "react";

const iconMap: Record<string, React.ReactNode> = {
  LayoutDashboard: <LayoutDashboard className="h-5 w-5" />,
  FileText: <FileText className="h-5 w-5" />,
  ClipboardCheck: <ClipboardCheck className="h-5 w-5" />,
  Presentation: <Presentation className="h-5 w-5" />,
  Mic: <Mic className="h-5 w-5" />,
  Image: <ImageIcon className="h-5 w-5" />,
  Settings: <Settings className="h-5 w-5" />,
  Calendar: <Calendar className="h-5 w-5" />,
  Users: <Users className="h-5 w-5" />,
  Files: <Files className="h-5 w-5" />,
  BarChart3: <BarChart3 className="h-5 w-5" />,
};

export function AppShell({ children }: { children: React.ReactNode }) {
  const user = useDashboardAuth();
  const pathname = usePathname();
  const { t } = useI18n();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const ROLE_LABELS = getRoleLabels(t);

  const navItems = getNavItemsForRoles(user.roles);
  const activeItem = navItems.find(
    (item) => pathname === item.href || pathname.startsWith(item.href + "/")
  );
  const activeLabel = activeItem ? t(activeItem.label as TranslationKey) : t("dashboard.workspaceTitle");
  const roleSummary = user.roles.map((r) => ROLE_LABELS[r] || r).join(", ");

  return (
    <div className="flex h-screen overflow-hidden bg-slate-100">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden animate-fade-in"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-white/10 bg-slate-950",
          "transition-transform duration-300 ease-out",
          "lg:static lg:translate-x-0",
          sidebarOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full"
        )}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 border-b border-white/10 px-6 py-5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-500">
            <span className="text-lg font-bold text-white">D</span>
          </div>
          <div>
            <h1 className="text-base font-semibold text-white">DPSTCon2026</h1>
            <p className="text-[11px] text-slate-400">{t("app.shellSubtitle")}</p>
          </div>
          <button
            className="ml-auto text-slate-400 transition-colors hover:text-white lg:hidden"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-3 py-4">
          {navItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setSidebarOpen(false)}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-medium transition-all duration-200",
                  isActive
                    ? "bg-white text-slate-950 shadow-sm"
                    : "text-slate-300 hover:bg-white/5 hover:text-white"
                )}
              >
                {iconMap[item.icon] || <LayoutDashboard className="h-5 w-5" />}
                {t(item.label as TranslationKey)}
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <header className="flex h-[72px] shrink-0 items-center gap-4 border-b border-border bg-white/90 px-4 backdrop-blur lg:px-8">
          <button
            className="rounded-xl p-2 text-ink-muted transition-colors hover:bg-surface-hover hover:text-ink lg:hidden"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </button>

          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-ink-muted">
              {roleSummary}
            </p>
            <h1 className="truncate text-base font-semibold text-ink sm:text-lg">
              {activeLabel}
            </h1>
          </div>

          <LanguageToggle />
          <NotificationBell />

          {/* User info */}
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-900">
              <span className="text-sm font-semibold text-white">
                {(() => {
                  return user.firstNameEn?.[0]?.toUpperCase() || user.firstNameTh?.[0] || user.name?.[0]?.toUpperCase() || "U";
                })()}
              </span>
            </div>
            <div className="hidden sm:block min-w-0">
              <p className="text-sm font-medium text-ink truncate leading-tight">
                {(() => {
                  const f = user.firstNameTh || "";
                  const l = user.lastNameTh || "";
                  if (f || l) return `${user.prefixTh || ""}${f} ${l}`.trim();
                  return user.name || t("common.unknownUser");
                })()}
              </p>
              <p className="text-xs text-ink-muted leading-tight">
                {roleSummary}
              </p>
            </div>
            <button
              onClick={async () => {
                try {
                  await signOut();
                  window.location.href = "/login";
                } catch {
                  window.location.href = "/login";
                }
              }}
              className="p-1.5 rounded-lg text-ink-muted hover:text-red-500 hover:bg-red-50 transition-all cursor-pointer"
              title={t("common.signOut")}
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto bg-slate-50 px-4 py-6 lg:px-8 lg:py-8">
          <div className="mx-auto w-full max-w-7xl">
            {children}
            <Footer className="mt-10" />
          </div>
        </main>
      </div>
    </div>
  );
}
