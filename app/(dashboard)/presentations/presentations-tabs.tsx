"use client";

import Link from "next/link";
import { Mic, Image as ImageIcon } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

interface PresentationsTabsProps {
  activeTab: "oral" | "poster";
  children: React.ReactNode;
}

export function PresentationsTabs({ activeTab, children }: PresentationsTabsProps) {
  const { t } = useI18n();
  const tabs = [
    {
      key: "oral" as const,
      label: t("presentations.oral"),
      icon: Mic,
      href: "/presentations?tab=oral",
    },
    {
      key: "poster" as const,
      label: t("presentations.poster"),
      icon: ImageIcon,
      href: "/presentations?tab=poster",
    },
  ];

  return (
    <div className="space-y-4">
      <div
        role="tablist"
        aria-label={t("nav.presentations")}
        className="flex gap-1 border-b border-border"
      >
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <Link
              key={tab.key}
              href={tab.href}
              role="tab"
              aria-selected={isActive}
              className={cn(
                "inline-flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors",
                isActive
                  ? "border-brand-500 text-brand-600"
                  : "border-transparent text-ink-muted hover:border-border hover:text-ink"
              )}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </Link>
          );
        })}
      </div>
      <div>{children}</div>
    </div>
  );
}
