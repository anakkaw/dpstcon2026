"use client";

import { CheckCircle2, RotateCcw, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";

type Recommendation = "" | "ACCEPT" | "REVISE" | "REJECT";

interface RecommendationPickerProps {
  value: Recommendation;
  onChange: (value: Recommendation) => void;
  disabled?: boolean;
}

export function RecommendationPicker({
  value,
  onChange,
  disabled = false,
}: RecommendationPickerProps) {
  const { t } = useI18n();

  const options = [
    {
      key: "ACCEPT" as const,
      label: t("reviewForm.recACCEPTLabel"),
      desc: t("reviewForm.recACCEPTDesc"),
      icon: CheckCircle2,
      activeClass: "border-emerald-500 bg-emerald-50 ring-2 ring-emerald-500/20",
      idleClass: "border-border hover:border-emerald-300 hover:bg-emerald-50/30",
      iconClass: "text-emerald-600",
      badgeClass: "bg-emerald-100 text-emerald-700",
    },
    {
      key: "REVISE" as const,
      label: t("reviewForm.recREVISELabel"),
      desc: t("reviewForm.recREVISEDesc"),
      icon: RotateCcw,
      activeClass: "border-amber-500 bg-amber-50 ring-2 ring-amber-500/20",
      idleClass: "border-border hover:border-amber-300 hover:bg-amber-50/30",
      iconClass: "text-amber-600",
      badgeClass: "bg-amber-100 text-amber-700",
    },
    {
      key: "REJECT" as const,
      label: t("reviewForm.recREJECTLabel"),
      desc: t("reviewForm.recREJECTDesc"),
      icon: XCircle,
      activeClass: "border-red-500 bg-red-50 ring-2 ring-red-500/20",
      idleClass: "border-border hover:border-red-300 hover:bg-red-50/30",
      iconClass: "text-red-600",
      badgeClass: "bg-red-100 text-red-700",
    },
  ];

  return (
    <div
      role="radiogroup"
      aria-label={t("reviewForm.recommendation")}
      className="grid gap-3 sm:grid-cols-3"
    >
      {options.map((opt) => {
        const Icon = opt.icon;
        const active = value === opt.key;
        return (
          <button
            key={opt.key}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={disabled}
            onClick={() => onChange(opt.key)}
            className={cn(
              "relative flex flex-col items-start gap-2 rounded-xl border-2 bg-white p-4 text-left transition-all",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40",
              disabled && "opacity-50 cursor-not-allowed",
              active ? opt.activeClass : opt.idleClass
            )}
          >
            <div className="flex w-full items-start justify-between gap-2">
              <Icon className={cn("h-5 w-5 shrink-0", opt.iconClass)} />
              {active && (
                <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-bold uppercase", opt.badgeClass)}>
                  {t("reviewForm.recSelected")}
                </span>
              )}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-ink leading-tight">{opt.label}</p>
              <p className="mt-1 text-xs text-ink-muted leading-snug">{opt.desc}</p>
            </div>
          </button>
        );
      })}
    </div>
  );
}
