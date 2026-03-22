import { cn } from "@/lib/utils";
import { Inbox } from "lucide-react";

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  body?: string;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({
  icon,
  title,
  body,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div className={cn(
      "flex flex-col items-center justify-center py-16 text-center rounded-2xl bg-gray-50/50 border border-dashed border-gray-200",
      className
    )}>
      <div className="text-gray-300 mb-4">
        {icon || <Inbox className="h-14 w-14" />}
      </div>
      <h3 className="text-base font-bold text-ink">{title}</h3>
      {body && <p className="text-sm text-gray-500 mt-1.5 max-w-sm leading-relaxed">{body}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
