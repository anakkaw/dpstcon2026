import { cn } from "@/lib/utils";
import { AlertCircle, CheckCircle2, AlertTriangle, Info } from "lucide-react";

type Tone = "info" | "success" | "warning" | "danger";

interface AlertProps {
  tone?: Tone;
  title?: string;
  children: React.ReactNode;
  className?: string;
}

/* Full static class strings */
const toneStyles: Record<Tone, string> = {
  info: "bg-blue-50 border-blue-200 text-blue-800",
  success: "bg-emerald-50 border-emerald-200 text-emerald-800",
  warning: "bg-amber-50 border-amber-200 text-amber-800",
  danger: "bg-red-50 border-red-200 text-red-800",
};

const iconStyles: Record<Tone, string> = {
  info: "text-blue-500",
  success: "text-emerald-500",
  warning: "text-amber-500",
  danger: "text-red-500",
};

const iconComponents: Record<Tone, typeof Info> = {
  info: Info,
  success: CheckCircle2,
  warning: AlertTriangle,
  danger: AlertCircle,
};

export function Alert({ tone = "info", title, children, className }: AlertProps) {
  const Icon = iconComponents[tone];

  return (
    <div
      className={cn(
        "flex gap-3 rounded-xl border px-4 py-3.5 text-sm animate-fade-in",
        toneStyles[tone],
        className
      )}
      role="alert"
      aria-live="polite"
    >
      <div className="shrink-0 mt-0.5">
        <Icon className={cn("h-5 w-5", iconStyles[tone])} aria-hidden="true" />
      </div>
      <div>
        {title && <p className="font-semibold mb-0.5">{title}</p>}
        <div className="leading-relaxed">{children}</div>
      </div>
    </div>
  );
}
