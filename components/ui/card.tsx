import { cn } from "@/lib/utils";
import type { HTMLAttributes } from "react";

type AccentColor = "brand" | "success" | "warning" | "danger" | "info" | "none";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  accent?: AccentColor;
  hover?: boolean;
}

/* Full static class strings */
const accentStyles: Record<AccentColor, string> = {
  brand: "border-l-4 border-l-brand-500",
  success: "border-l-4 border-l-emerald-500",
  warning: "border-l-4 border-l-amber-500",
  danger: "border-l-4 border-l-red-500",
  info: "border-l-4 border-l-blue-500",
  none: "",
};

export function Card({
  className,
  accent = "none",
  hover = false,
  children,
  ...props
}: CardProps) {
  return (
    <div
      className={cn(
        "bg-white rounded-2xl border border-border shadow-card",
        accentStyles[accent],
        hover && "transition-all duration-200 hover:shadow-card-hover hover:-translate-y-0.5 cursor-pointer",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  className,
  children,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("px-6 py-4 border-b border-border-light", className)} {...props}>
      {children}
    </div>
  );
}

export function CardBody({
  className,
  children,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("px-6 py-5", className)} {...props}>
      {children}
    </div>
  );
}

export function CardFooter({
  className,
  children,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("px-6 py-4 border-t border-border-light bg-surface-alt/50 rounded-b-2xl", className)}
      {...props}
    >
      {children}
    </div>
  );
}
