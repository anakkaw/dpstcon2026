"use client";

import { useI18n } from "@/lib/i18n";

interface PageLoadingProps {
  label?: string;
}

export function PageLoading({ label }: PageLoadingProps) {
  const { t } = useI18n();

  return (
    <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
      <div className="h-8 w-8 rounded-full border-2 border-brand-500 border-t-transparent animate-spin" />
      <div>
        <p className="text-sm font-medium text-ink">
          {label || t("common.loading")}
        </p>
        <p className="text-xs text-ink-muted">
          {t("common.pleaseWait")}
        </p>
      </div>
    </div>
  );
}
