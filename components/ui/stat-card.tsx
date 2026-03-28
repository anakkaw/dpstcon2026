import { cn } from "@/lib/utils";

type AccentColor = "brand" | "success" | "warning" | "danger" | "info";

interface StatCardProps {
  label: string;
  value: string | number;
  hint?: string;
  icon?: React.ReactNode;
  accent?: AccentColor;
  className?: string;
  onClick?: () => void;
}

/* Full static class strings — Tailwind v4 scanner finds each one */
const styles: Record<AccentColor, { card: string; icon: string; value: string; label: string }> = {
  brand: {
    card: "border-brand-200/80 bg-white",
    icon: "bg-brand-50 text-brand-600",
    value: "text-brand-700",
    label: "text-brand-700/80",
  },
  info: {
    card: "border-blue-200/80 bg-white",
    icon: "bg-blue-50 text-blue-600",
    value: "text-blue-800",
    label: "text-blue-800/75",
  },
  success: {
    card: "border-emerald-200/80 bg-white",
    icon: "bg-emerald-50 text-emerald-600",
    value: "text-emerald-800",
    label: "text-emerald-800/75",
  },
  warning: {
    card: "border-amber-200/80 bg-white",
    icon: "bg-amber-50 text-amber-600",
    value: "text-amber-800",
    label: "text-amber-800/75",
  },
  danger: {
    card: "border-red-200/80 bg-white",
    icon: "bg-red-50 text-red-600",
    value: "text-red-800",
    label: "text-red-800/75",
  },
};

export function StatCard({
  label,
  value,
  hint,
  icon,
  accent = "brand",
  className,
  onClick,
}: StatCardProps) {
  const s = styles[accent];

  return (
    <div
      className={cn(
        "rounded-2xl border p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md",
        onClick && "cursor-pointer",
        s.card,
        className
      )}
      onClick={onClick}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className={cn("text-xs font-medium uppercase tracking-[0.16em]", s.label)}>{label}</p>
          <p className={cn("mt-2 text-2xl font-semibold tracking-tight sm:text-[1.75rem]", s.value)}>
            {value}
          </p>
          {hint && <p className="mt-1 text-xs text-ink-muted">{hint}</p>}
        </div>
        {icon && (
          <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", s.icon)}>
            {icon}
          </div>
        )}
      </div>
    </div>
  );
}
