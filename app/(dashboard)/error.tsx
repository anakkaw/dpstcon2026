"use client";

import { Button } from "@/components/ui/button";
import { AlertCircle } from "lucide-react";
import { useI18n } from "@/lib/i18n";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { t } = useI18n();

  return (
    <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
      <AlertCircle className="h-12 w-12 text-danger mb-4" />
      <h2 className="text-lg font-bold text-ink mb-2">{t("error.title")}</h2>
      <p className="text-sm text-ink-muted mb-6 max-w-md">
        {error.message || t("error.fallback")}
      </p>
      <Button onClick={reset}>{t("common.retry")}</Button>
    </div>
  );
}
