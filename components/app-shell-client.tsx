"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "@/lib/auth-client";
import type { DashboardAuthUser } from "@/components/dashboard-auth-context";
import { Footer } from "@/components/ui/footer";
import { displayNameTh, nameInitial } from "@/lib/display-name";
import { useI18n } from "@/lib/i18n";
import type { TranslationKey } from "@/lib/i18n";
import { getRoleLabels } from "@/lib/labels";
import { cn } from "@/lib/utils";
import { LanguageToggle } from "@/components/language-toggle";
import { NotificationBell } from "@/components/notification-bell";
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
  Layers,
  Star,
} from "lucide-react";

export interface AppShellNavItem {
  href: string;
  labelKey: TranslationKey;
  icon: string;
}

export interface AppShellNavGroup {
  role: string;
  items: AppShellNavItem[];
}

interface AppShellClientProps {
  appTitle: string;
  navItems: AppShellNavItem[];
  navGroups?: AppShellNavGroup[];
  user: DashboardAuthUser;
  children: React.ReactNode;
}

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
  Layers: <Layers className="h-5 w-5" />,
  Star: <Star className="h-5 w-5" />,
};

export function AppShellClient({
  appTitle,
  navItems,
  navGroups,
  user,
  children,
}: AppShellClientProps) {
  const pathname = usePathname();
  const { t } = useI18n();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [prevPathname, setPrevPathname] = useState(pathname);
  const roleLabels = getRoleLabels(t);

  // Auto-close sidebar on mobile when navigating (reset-on-prop-change pattern)
  if (pathname !== prevPathname) {
    setPrevPathname(pathname);
    setSidebarOpen(false);
  }

  const allItems = navGroups
    ? navGroups.flatMap((g) => g.items)
    : navItems;
  const activeItem = allItems.find(
    (item) => pathname === item.href || pathname.startsWith(item.href + "/")
  );
  const activeLabel = activeItem
    ? t(activeItem.labelKey)
    : t("dashboard.workspaceTitle");
  const roleSummary = user.roles
    .map((role) => roleLabels[role] || role)
    .join(", ");
  const displayName = displayNameTh(user);
  const initials = nameInitial(user);

  const renderNavLink = (item: AppShellNavItem) => {
    const isActive =
      pathname === item.href || pathname.startsWith(item.href + "/");
    return (
      <Link
        key={item.href}
        href={item.href}
        onClick={() => setSidebarOpen(false)}
        aria-current={isActive ? "page" : undefined}
        className={cn(
          "flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-medium transition-all duration-200",
          isActive
            ? "bg-white text-slate-950 shadow-sm"
            : "text-slate-300 hover:bg-white/5 hover:text-white"
        )}
      >
        {iconMap[item.icon] || <LayoutDashboard className="h-5 w-5" />}
        {t(item.labelKey)}
      </Link>
    );
  };

  return (
    <div className="flex h-screen overflow-hidden bg-slate-100">
      {/* Skip to main content link for keyboard/screen reader users */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-xl focus:bg-brand-500 focus:px-4 focus:py-2 focus:text-white focus:shadow-lg"
      >
        Skip to main content
      </a>

      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden animate-fade-in"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        id="app-sidebar"
        aria-label={t("common.primaryNavigation")}
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-white/10 bg-slate-950",
          "transition-transform duration-300 ease-out",
          "lg:static lg:translate-x-0",
          sidebarOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full"
        )}
      >
        <div className="flex items-center gap-3 border-b border-white/10 px-6 py-5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-500">
            <span className="text-lg font-bold text-white">D</span>
          </div>
          <div>
            <h1 className="text-base font-semibold text-white">{appTitle}</h1>
            <p className="text-[11px] text-slate-400">{t("app.shellSubtitle")}</p>
          </div>
          <button
            type="button"
            aria-label={t("common.closeNavigation")}
            className="ml-auto inline-flex h-10 w-10 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-white/5 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-3 py-4">
          {navGroups && navGroups.length > 0 ? (
            navGroups.map((group, idx) => (
              <div key={group.role}>
                {idx > 0 && (
                  <div className="mx-3 my-2 border-t border-white/10" />
                )}
                {group.role !== "_COMMON" && (
                  <p className="mb-1 mt-1 px-4 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    {roleLabels[group.role] || group.role}
                  </p>
                )}
                {group.items.map(renderNavLink)}
              </div>
            ))
          ) : (
            navItems.map(renderNavLink)
          )}
        </nav>
      </aside>

      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex h-[72px] shrink-0 items-center gap-4 border-b border-border bg-white/90 px-4 backdrop-blur lg:px-8">
          <button
            type="button"
            aria-label={t("common.openNavigation")}
            aria-expanded={sidebarOpen}
            aria-controls="app-sidebar"
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-ink-muted transition-colors hover:bg-surface-hover hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 lg:hidden"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="h-5 w-5" aria-hidden="true" />
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

          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-900">
              <span className="text-sm font-semibold text-white">{initials}</span>
            </div>
            <div className="hidden min-w-0 sm:block">
              <p className="truncate text-sm font-medium leading-tight text-ink">
                {displayName}
              </p>
              <p className="text-xs leading-tight text-ink-muted">
                {roleSummary}
              </p>
            </div>
            <button
              type="button"
              onClick={async () => {
                try {
                  await signOut();
                  window.location.href = "/login";
                } catch {
                  window.location.href = "/login";
                }
              }}
              className="inline-flex h-10 w-10 cursor-pointer items-center justify-center rounded-lg text-ink-muted transition-all hover:bg-red-50 hover:text-red-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/40"
              title={t("common.signOut")}
              aria-label={t("common.signOut")}
            >
              <LogOut className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </header>

        <main id="main-content" className="flex-1 overflow-y-auto bg-slate-50 px-4 py-6 lg:px-8 lg:py-8">
          <div className="mx-auto w-full max-w-7xl">
            {children}
            <Footer
              className="mt-10"
              developedBy={t("footer.developedBy")}
              university={t("footer.university")}
            />
          </div>
        </main>
      </div>
    </div>
  );
}
