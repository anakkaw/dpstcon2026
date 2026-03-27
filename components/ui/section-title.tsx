import { cn } from "@/lib/utils";

interface SectionTitleProps {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  className?: string;
}

export function SectionTitle({
  title,
  subtitle,
  action,
  className,
}: SectionTitleProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between",
        className
      )}
    >
      <div className="min-w-0">
        <h2 className="text-2xl font-bold text-ink tracking-tight">{title}</h2>
        {subtitle && (
          <p className="text-sm text-ink-muted mt-0.5">{subtitle}</p>
        )}
      </div>
      {action && (
        <div className="flex w-full justify-start sm:w-auto sm:shrink-0 sm:justify-end">
          {action}
        </div>
      )}
    </div>
  );
}
