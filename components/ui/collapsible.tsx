"use client";

import { cn } from "@/lib/utils";
import { useState, useId } from "react";
import { ChevronDown } from "lucide-react";

interface CollapsibleProps {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
  className?: string;
}

export function Collapsible({
  title,
  defaultOpen = false,
  children,
  className,
}: CollapsibleProps) {
  const [open, setOpen] = useState(defaultOpen);
  const contentId = useId();

  return (
    <div className={cn(
      "border border-gray-200 rounded-xl overflow-hidden transition-colors duration-200",
      open && "border-brand-200 shadow-sm",
      className
    )}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-controls={contentId}
        className={cn(
          "flex w-full items-center justify-between px-5 py-3.5 text-left text-sm font-semibold text-ink",
          "hover:bg-gray-50 transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 focus-visible:ring-inset",
          open && "bg-brand-50/50"
        )}
      >
        {title}
        <ChevronDown className={cn(
          "h-4 w-4 text-gray-400 transition-transform duration-200",
          open && "rotate-180 text-brand-500"
        )} aria-hidden="true" />
      </button>
      {open && (
        <div id={contentId} role="region" aria-label={title} className="px-5 pb-4 pt-1 text-sm text-ink-light border-t border-gray-100">
          {children}
        </div>
      )}
    </div>
  );
}
