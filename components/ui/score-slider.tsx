"use client";

import { cn } from "@/lib/utils";
import { useId } from "react";

interface ScoreSliderProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  rubric?: Record<number, string>;
  className?: string;
}

function getColor(value: number, max: number): string {
  const ratio = value / max;
  if (ratio >= 0.8) return "text-emerald-600";
  if (ratio >= 0.6) return "text-blue-600";
  if (ratio >= 0.4) return "text-amber-600";
  if (ratio >= 0.2) return "text-orange-600";
  return "text-red-600";
}

function getBgColor(value: number, max: number): string {
  const ratio = value / max;
  if (ratio >= 0.8) return "bg-emerald-50";
  if (ratio >= 0.6) return "bg-blue-50";
  if (ratio >= 0.4) return "bg-amber-50";
  if (ratio >= 0.2) return "bg-orange-50";
  return "bg-red-50";
}

export function ScoreSlider({
  label,
  value,
  onChange,
  min = 1,
  max = 10,
  rubric,
  className,
}: ScoreSliderProps) {
  const labelId = useId();
  const rubricText = rubric?.[value];

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center justify-between">
        <label id={labelId} className="text-sm font-medium text-ink">{label}</label>
        <span
          className={cn(
            "text-sm font-bold tabular-nums px-2 py-0.5 rounded-md",
            getColor(value, max),
            getBgColor(value, max)
          )}
        >
          {value}/{max}
        </span>
      </div>
      {/* M20: Add aria-label and aria-valuetext */}
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-labelledby={labelId}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={value}
        aria-valuetext={rubricText ? `${value} จาก ${max}: ${rubricText}` : `${value} จาก ${max}`}
        className="w-full cursor-pointer"
      />
      {rubricText && (
        <p className="text-xs text-ink-muted italic leading-relaxed">
          {rubricText}
        </p>
      )}
    </div>
  );
}
