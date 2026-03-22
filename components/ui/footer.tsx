"use client";

import { APP_VERSION } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";

interface FooterProps {
  variant?: "light" | "dark";
  className?: string;
}

export function Footer({ variant = "light", className }: FooterProps) {
  const { t } = useI18n();
  return (
    <footer
      className={cn(
        "shrink-0 border-t py-4 px-6 text-center text-xs leading-relaxed",
        variant === "dark"
          ? "border-slate-800 text-slate-500"
          : "border-border text-ink-muted",
        className
      )}
    >
      <p>{t("footer.developedBy")}</p>
      <p>{t("footer.university")}</p>
      <p className="mt-1 opacity-60">v{APP_VERSION}</p>
    </footer>
  );
}
