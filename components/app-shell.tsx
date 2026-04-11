import { getNavItemsGroupedByRole, getNavItemsForRoles } from "@/lib/constants";
import type { TranslationKey } from "@/lib/i18n";
import {
  AppShellClient,
  type AppShellNavItem,
  type AppShellNavGroup,
} from "@/components/app-shell-client";
import type { DashboardAuthUser } from "@/components/dashboard-auth-context";

function buildNavGroups(roles: string[]): AppShellNavGroup[] {
  return getNavItemsGroupedByRole(roles).map((group) => ({
    role: group.role,
    items: group.items.map((item) => ({
      href: item.href,
      icon: item.icon,
      labelKey: item.label as TranslationKey,
    })),
  }));
}

function buildNavItems(roles: string[]): AppShellNavItem[] {
  return getNavItemsForRoles(roles).map((item) => ({
    href: item.href,
    icon: item.icon,
    labelKey: item.label as TranslationKey,
  }));
}

export function AppShell({
  user,
  children,
}: {
  user: DashboardAuthUser;
  children: React.ReactNode;
}) {
  return (
    <AppShellClient
      appTitle="DPSTCon2026"
      navItems={buildNavItems(user.roles)}
      navGroups={buildNavGroups(user.roles)}
      user={user}
    >
      {children}
    </AppShellClient>
  );
}
