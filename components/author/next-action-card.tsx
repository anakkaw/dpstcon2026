"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import { ArrowRight, AlertTriangle, Clock, Zap } from "lucide-react";
import type { NextAction } from "@/lib/author-utils";

interface NextActionCardProps {
  action: NextAction;
  paperTitle: string;
  href: string;
  deadline?: string;
  daysLeft?: number;
}

const urgencyStyles = {
  normal: "border-brand-200 bg-brand-50/40",
  warning: "border-amber-200 bg-amber-50/40",
  urgent: "border-red-200 bg-red-50/40",
};

const urgencyIcons = {
  normal: <Zap className="h-4 w-4 text-brand-500" />,
  warning: <Clock className="h-4 w-4 text-amber-500" />,
  urgent: <AlertTriangle className="h-4 w-4 text-red-500" />,
};

export function NextActionCard({ action, paperTitle, href, deadline, daysLeft }: NextActionCardProps) {
  return (
    <Link href={href}>
      <div
        className={cn(
          "flex items-center gap-4 rounded-xl border p-4 transition-all hover:shadow-md hover:-translate-y-0.5 cursor-pointer",
          urgencyStyles[action.urgency]
        )}
      >
        <div className="shrink-0">{urgencyIcons[action.urgency]}</div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-ink">{action.label}</p>
          <p className="text-xs text-ink-muted truncate">{paperTitle}</p>
          {deadline && daysLeft !== undefined && (
            <p className={cn(
              "text-xs mt-1 font-medium",
              daysLeft <= 3 ? "text-red-600" : daysLeft <= 14 ? "text-amber-600" : "text-ink-muted"
            )}>
              {daysLeft > 0 ? `เหลือ ${daysLeft} วัน` : daysLeft === 0 ? "วันนี้!" : `เลยกำหนด ${Math.abs(daysLeft)} วัน`}
            </p>
          )}
        </div>
        <ArrowRight className="h-4 w-4 text-ink-muted shrink-0" />
      </div>
    </Link>
  );
}
