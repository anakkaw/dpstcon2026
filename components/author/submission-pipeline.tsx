"use client";

import { cn } from "@/lib/utils";
import { getPipelineSteps, type PipelineStepState } from "@/lib/author-utils";
import { Check } from "lucide-react";

interface SubmissionPipelineProps {
  status: string;
  compact?: boolean;
}

const stateStyles: Record<PipelineStepState, { dot: string; line: string; text: string }> = {
  completed: {
    dot: "bg-emerald-500 border-emerald-500 text-white",
    line: "bg-emerald-500",
    text: "text-emerald-700",
  },
  current: {
    dot: "bg-brand-500 border-brand-500 text-white ring-4 ring-brand-500/20",
    line: "bg-gray-200",
    text: "text-brand-600 font-semibold",
  },
  future: {
    dot: "bg-white border-gray-300",
    line: "bg-gray-200",
    text: "text-ink-muted",
  },
};

export function SubmissionPipeline({ status, compact = false }: SubmissionPipelineProps) {
  const steps = getPipelineSteps(status);

  if (compact) {
    return (
      <div className="flex items-center gap-1">
        {steps.map((step, i) => (
          <div key={step.key} className="flex items-center">
            <div
              className={cn(
                "rounded-full shrink-0",
                step.state === "completed" ? "h-2 w-2 bg-emerald-500" :
                step.state === "current" ? "h-2.5 w-2.5 bg-brand-500 ring-2 ring-brand-500/30" :
                "h-2 w-2 bg-gray-300"
              )}
              title={step.label}
            />
            {i < steps.length - 1 && (
              <div className={cn("h-0.5 w-3", step.state === "completed" ? "bg-emerald-400" : "bg-gray-200")} />
            )}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="flex items-center w-full">
      {steps.map((step, i) => {
        const styles = stateStyles[step.state];
        return (
          <div key={step.key} className="flex items-center flex-1 last:flex-none">
            {/* Step dot + label */}
            <div className="flex flex-col items-center gap-1.5">
              <div
                className={cn(
                  "h-7 w-7 rounded-full border-2 flex items-center justify-center shrink-0 transition-all",
                  styles.dot,
                  step.state === "current" && "animate-pulse"
                )}
              >
                {step.state === "completed" ? (
                  <Check className="h-3.5 w-3.5" />
                ) : (
                  <span className="text-[10px] font-bold">{i + 1}</span>
                )}
              </div>
              <span className={cn("text-[10px] whitespace-nowrap", styles.text)}>
                {step.label}
              </span>
            </div>
            {/* Connector line */}
            {i < steps.length - 1 && (
              <div className={cn("flex-1 h-0.5 mx-1 mt-[-18px]", styles.line)} />
            )}
          </div>
        );
      })}
    </div>
  );
}
