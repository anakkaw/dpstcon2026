"use client";

import { startTransition } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n";
import { Globe } from "lucide-react";

export function LanguageToggle({ className }: { className?: string }) {
  const router = useRouter();
  const { locale, setLocale, t } = useI18n();
  const nextLocale = locale === "th" ? "en" : "th";

  return (
    <button
      onClick={() => {
        setLocale(nextLocale);
        startTransition(() => {
          router.refresh();
        });
      }}
      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border border-border/60 hover:bg-surface-hover transition-colors cursor-pointer ${className || ""}`}
      title={
        locale === "th"
          ? t("language.switchToEnglish")
          : t("language.switchToThai")
      }
    >
      <Globe className="h-3.5 w-3.5" />
      {nextLocale.toUpperCase()}
    </button>
  );
}
