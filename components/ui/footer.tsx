import { APP_VERSION } from "@/lib/constants";
import { cn } from "@/lib/utils";

interface FooterProps {
  developedBy: string;
  university: string;
  variant?: "light" | "dark";
  className?: string;
}

export function Footer({
  developedBy,
  university,
  variant = "light",
  className,
}: FooterProps) {
  return (
    <footer
      className={cn(
        "shrink-0 border-t py-4 px-6 text-center text-xs leading-relaxed",
        variant === "dark"
          ? "border-slate-800 text-slate-500"
          : "border-border text-ink-muted",
        className
      )}
    >
      <p>{developedBy}</p>
      <p>{university}</p>
      <p className="mt-1 opacity-60">v{APP_VERSION}</p>
    </footer>
  );
}
