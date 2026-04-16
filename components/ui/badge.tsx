import { cn } from "@/lib/utils";
import { CheckCircle2, Clock, AlertTriangle, XCircle, Info, type LucideIcon } from "lucide-react";

type Tone = "neutral" | "success" | "warning" | "danger" | "info";

interface BadgeProps {
  tone?: Tone;
  /** Custom Lucide icon. When omitted, falls back to the tone's default icon. */
  icon?: LucideIcon;
  /** Legacy pulsing dot indicator. Suppresses the icon when true. */
  dot?: boolean;
  children: React.ReactNode;
  className?: string;
}

/* Full static class strings */
const toneStyles: Record<Tone, string> = {
  neutral: "bg-gray-100 text-gray-700 border-gray-200",
  success: "bg-emerald-100 text-emerald-800 border-emerald-200",
  warning: "bg-amber-100 text-amber-800 border-amber-200",
  danger: "bg-red-100 text-red-800 border-red-200",
  info: "bg-blue-100 text-blue-800 border-blue-200",
};

const dotColors: Record<Tone, string> = {
  neutral: "bg-gray-500",
  success: "bg-emerald-500",
  warning: "bg-amber-500",
  danger: "bg-red-500",
  info: "bg-blue-500",
};

const defaultIcons: Record<Tone, LucideIcon> = {
  neutral: Clock,
  success: CheckCircle2,
  warning: AlertTriangle,
  danger: XCircle,
  info: Info,
};

export function Badge({
  tone = "neutral",
  icon,
  dot = false,
  children,
  className,
}: BadgeProps) {
  const IconComponent = icon ?? defaultIcons[tone];

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-chip border px-2.5 py-0.5 text-xs font-semibold",
        toneStyles[tone],
        className
      )}
    >
      {dot ? (
        <span className={cn("h-2 w-2 shrink-0 rounded-full animate-pulse", dotColors[tone])} aria-hidden="true" />
      ) : (
        <IconComponent className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      )}
      {children}
    </span>
  );
}
