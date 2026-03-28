import { cn } from "@/lib/utils";
import type { HTMLAttributes } from "react";

interface WorkspaceSectionProps extends HTMLAttributes<HTMLElement> {
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export function WorkspaceSection({
  title,
  description,
  action,
  className,
  children,
  ...props
}: WorkspaceSectionProps) {
  return (
    <section className={cn("space-y-3", className)} {...props}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <h2 className="text-base font-semibold text-ink">{title}</h2>
          {description ? <p className="text-sm text-ink-muted">{description}</p> : null}
        </div>
        {action ? <div className="flex w-full justify-start sm:w-auto sm:justify-end">{action}</div> : null}
      </div>
      {children}
    </section>
  );
}

export function WorkspaceSurface({
  className,
  children,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("rounded-2xl border border-border bg-white shadow-sm", className)}
      {...props}
    >
      {children}
    </div>
  );
}
