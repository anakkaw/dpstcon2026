"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { getNavItemsForRoles } from "@/lib/constants";
import { getRoleLabels } from "@/lib/labels";
import { useSession, signOut } from "@/lib/auth-client";
import { useI18n } from "@/lib/i18n";
import { LanguageToggle } from "@/components/language-toggle";
import { NotificationBell } from "@/components/notification-bell";
import { Footer } from "@/components/ui/footer";
import {
  LayoutDashboard,
  FileText,
  ClipboardCheck,
  Presentation,
  Mic,
  Image,
  Settings,
  Calendar,
  Users,
  Files,
  BarChart3,
  LogOut,
  Menu,
  X,
} from "lucide-react";
import { useState, useEffect, useRef } from "react";

const iconMap: Record<string, React.ReactNode> = {
  LayoutDashboard: <LayoutDashboard className="h-5 w-5" />,
  FileText: <FileText className="h-5 w-5" />,
  ClipboardCheck: <ClipboardCheck className="h-5 w-5" />,
  Presentation: <Presentation className="h-5 w-5" />,
  Mic: <Mic className="h-5 w-5" />,
  Image: <Image className="h-5 w-5" />,
  Settings: <Settings className="h-5 w-5" />,
  Calendar: <Calendar className="h-5 w-5" />,
  Users: <Users className="h-5 w-5" />,
  Files: <Files className="h-5 w-5" />,
  BarChart3: <BarChart3 className="h-5 w-5" />,
};

export function AppShell({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();
  const pathname = usePathname();
  const { t } = useI18n();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const ROLE_LABELS = getRoleLabels(t);

  const role = ((session?.user as Record<string, unknown>)?.role as string) || "AUTHOR";
  const userId = (session?.user as Record<string, unknown>)?.id as string | undefined;

  const [roles, setRoles] = useState<string[]>([role]);
  const fetchedForRef = useRef<string | null>(null);

  // Fetch roles once per user — ref prevents duplicate requests
  useEffect(() => {
    if (!userId || fetchedForRef.current === userId) return;
    fetchedForRef.current = userId;
    fetch("/api/users/me/roles")
      .then((r) => r.json())
      .then((data) => {
        if (data.roles?.length) setRoles(data.roles);
      })
      .catch(() => {});
  }, [userId]);

  const navItems = getNavItemsForRoles(roles);

  return (
    <div className="flex h-screen overflow-hidden bg-surface-hover">
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
          "fixed inset-y-0 left-0 z-50 w-64 flex flex-col bg-sidebar-gradient",
          "transition-transform duration-300 ease-out",
          "lg:static lg:translate-x-0",
          sidebarOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full"
        )}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 px-6 py-5">
          <div className="h-10 w-10 rounded-xl bg-brand-gradient flex items-center justify-center shrink-0 shadow-brand-glow">
            <span className="text-white font-bold text-lg">D</span>
          </div>
          <div>
            <h1 className="font-bold text-base text-white">DPSTCon2026</h1>
            <p className="text-[11px] text-side-muted">Conference Management</p>
          </div>
          <button
            className="ml-auto lg:hidden text-side-muted hover:text-white transition-colors"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 flex flex-col gap-1">
          {navItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setSidebarOpen(false)}
                className={cn(
                  "flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200",
                  isActive
                    ? "bg-brand-gradient text-white shadow-brand-active"
                    : "text-side-text hover:bg-side-hover hover:text-white"
                )}
              >
                {iconMap[item.icon] || <LayoutDashboard className="h-5 w-5" />}
                {t(item.label as any)}
              </Link>
            );
          })}
        </nav>

      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <header className="flex items-center gap-4 px-6 h-16 bg-white border-b border-border shadow-xs shrink-0">
          <button
            className="lg:hidden p-2 rounded-xl text-ink-muted hover:text-ink hover:bg-surface-hover transition-colors"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="flex-1" />

          <LanguageToggle />
          <NotificationBell />

          {/* User info */}
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-full bg-brand-gradient flex items-center justify-center shrink-0">
              <span className="text-white text-sm font-bold">
                {(() => {
                  const u = session?.user as unknown as { firstNameEn?: string; firstNameTh?: string; name?: string } | undefined;
                  return u?.firstNameEn?.[0]?.toUpperCase() || u?.firstNameTh?.[0] || u?.name?.[0]?.toUpperCase() || "U";
                })()}
              </span>
            </div>
            <div className="hidden sm:block min-w-0">
              <p className="text-sm font-medium text-ink truncate leading-tight">
                {(() => {
                  const u = session?.user as unknown as { prefixTh?: string; firstNameTh?: string; lastNameTh?: string; name?: string } | undefined;
                  const f = u?.firstNameTh || "";
                  const l = u?.lastNameTh || "";
                  if (f || l) return `${u?.prefixTh || ""}${f} ${l}`.trim();
                  return u?.name || "User";
                })()}
              </p>
              <p className="text-xs text-ink-muted leading-tight">
                {roles.map((r) => ROLE_LABELS[r] || r).join(", ")}
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
        <main className="flex-1 overflow-y-auto p-6 lg:p-8">
          {children}
          <Footer className="mt-8 -mx-6 lg:-mx-8 -mb-6 lg:-mb-8" />
        </main>
      </div>
    </div>
  );
}
