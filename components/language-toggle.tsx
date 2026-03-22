"use client";

import { useI18n } from "@/lib/i18n";
import { Globe } from "lucide-react";

export function LanguageToggle({ className }: { className?: string }) {
  const { locale, setLocale } = useI18n();

  return (
    <button
      onClick={() => setLocale(locale === "th" ? "en" : "th")}
      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border border-border/60 hover:bg-surface-hover transition-colors cursor-pointer ${className || ""}`}
      title={locale === "th" ? "Switch to English" : "เปลี่ยนเป็นภาษาไทย"}
    >
      <Globe className="h-3.5 w-3.5" />
      {locale === "th" ? "EN" : "TH"}
    </button>
  );
}
