import { cn } from "@/lib/utils";

interface DividerProps {
  label?: string;
  className?: string;
}

export function Divider({ label, className }: DividerProps) {
  if (label) {
    return (
      <div className={cn("flex items-center gap-3 my-1", className)}>
        <div className="flex-1 h-px bg-border/60" />
        <span className="text-xs text-ink-muted font-medium uppercase tracking-wider">
          {label}
        </span>
        <div className="flex-1 h-px bg-border/60" />
      </div>
    );
  }

  return <div className={cn("h-px bg-border/60 my-1", className)} />;
}
