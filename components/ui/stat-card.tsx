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
const styles: Record<AccentColor, { card: string; icon: string; value: string }> = {
  brand: {
    card: "bg-stat-brand border-brand-300",
    icon: "bg-brand-500 shadow-brand-glow",
    value: "text-brand-700",
  },
  info: {
    card: "bg-stat-info border-blue-300",
    icon: "bg-blue-500 shadow-blue-glow",
    value: "text-blue-800",
  },
  success: {
    card: "bg-stat-success border-emerald-300",
    icon: "bg-emerald-500 shadow-emerald-glow",
    value: "text-emerald-800",
  },
  warning: {
    card: "bg-stat-warning border-amber-300",
    icon: "bg-amber-500 shadow-amber-glow",
    value: "text-amber-800",
  },
  danger: {
    card: "bg-stat-danger border-red-300",
    icon: "bg-red-500 shadow-red-glow",
    value: "text-red-800",
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
        "rounded-2xl border-2 p-5 transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5",
        onClick && "cursor-pointer",
        s.card,
        className
      )}
      onClick={onClick}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-slate-500">{label}</p>
          <p className={cn("text-3xl font-extrabold tracking-tight mt-1", s.value)}>
            {value}
          </p>
          {hint && <p className="text-xs text-slate-500 mt-1">{hint}</p>}
        </div>
        {icon && (
          <div className={cn("h-12 w-12 rounded-xl flex items-center justify-center shrink-0 text-white", s.icon)}>
            {icon}
          </div>
        )}
      </div>
    </div>
  );
}
