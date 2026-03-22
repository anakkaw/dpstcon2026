"use client";

import { useState, useEffect } from "react";
import { Filter } from "lucide-react";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";

interface Track {
  id: string;
  name: string;
}

interface TrackFilterProps {
  value: string;
  onChange: (trackId: string) => void;
  tracks?: Track[];
  counts?: Record<string, number>;
}

const COLOR_PALETTE = [
  {
    dot: "bg-blue-500",
    idle: "bg-white border-gray-200 text-blue-700 hover:bg-blue-50",
    active: "bg-blue-100 text-blue-700 border-blue-300 shadow-sm",
    count: "bg-blue-200 text-blue-800",
  },
  {
    dot: "bg-purple-500",
    idle: "bg-white border-gray-200 text-purple-700 hover:bg-purple-50",
    active: "bg-purple-100 text-purple-700 border-purple-300 shadow-sm",
    count: "bg-purple-200 text-purple-800",
  },
  {
    dot: "bg-amber-500",
    idle: "bg-white border-gray-200 text-amber-700 hover:bg-amber-50",
    active: "bg-amber-100 text-amber-700 border-amber-300 shadow-sm",
    count: "bg-amber-200 text-amber-800",
  },
  {
    dot: "bg-emerald-500",
    idle: "bg-white border-gray-200 text-emerald-700 hover:bg-emerald-50",
    active: "bg-emerald-100 text-emerald-700 border-emerald-300 shadow-sm",
    count: "bg-emerald-200 text-emerald-800",
  },
  {
    dot: "bg-teal-500",
    idle: "bg-white border-gray-200 text-teal-700 hover:bg-teal-50",
    active: "bg-teal-100 text-teal-700 border-teal-300 shadow-sm",
    count: "bg-teal-200 text-teal-800",
  },
  {
    dot: "bg-rose-500",
    idle: "bg-white border-gray-200 text-rose-700 hover:bg-rose-50",
    active: "bg-rose-100 text-rose-700 border-rose-300 shadow-sm",
    count: "bg-rose-200 text-rose-800",
  },
];

function getColorForIndex(index: number) {
  return COLOR_PALETTE[index % COLOR_PALETTE.length];
}

export function TrackFilter({ value, onChange, tracks: propTracks, counts }: TrackFilterProps) {
  const { t } = useI18n();
  const [tracks, setTracks] = useState<Track[]>(propTracks || []);

  useEffect(() => {
    if (!propTracks) {
      fetch("/api/submissions/tracks")
        .then((r) => r.json())
        .then((d) => setTracks(d.tracks || []))
        .catch(() => {});
    }
  }, [propTracks]);

  if (tracks.length === 0) return null;

  const totalCount = counts
    ? Object.values(counts).reduce((sum, c) => sum + c, 0)
    : undefined;

  return (
    <div className="rounded-2xl border border-gray-200 bg-white px-5 py-3.5 shadow-card">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 shrink-0">
          <div className="h-8 w-8 rounded-lg bg-gray-100 flex items-center justify-center">
            <Filter className="h-4 w-4 text-gray-500" />
          </div>
          <span className="text-sm font-semibold text-gray-500">{t("trackFilter.label")}</span>
        </div>

        <div className="w-px h-6 bg-gray-200 shrink-0" />

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => onChange("")}
            className={cn(
              "inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold border transition-all duration-200",
              value === ""
                ? "bg-slate-900 text-white border-slate-900 shadow-md"
                : "bg-white text-gray-500 border-gray-200 hover:bg-gray-50 hover:text-gray-700"
            )}
          >
            {t("trackFilter.all")}
            {totalCount !== undefined && (
              <span className={cn(
                "text-xs font-bold px-1.5 py-0.5 rounded-lg min-w-[1.25rem] text-center",
                value === "" ? "bg-white/20 text-white" : "bg-gray-100 text-gray-500"
              )}>
                {totalCount}
              </span>
            )}
          </button>

          {tracks.map((t, i) => {
            const isActive = value === t.id;
            const color = getColorForIndex(i);
            const trackCount = counts?.[t.id];

            return (
              <button
                key={t.id}
                onClick={() => onChange(isActive ? "" : t.id)}
                className={cn(
                  "inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold border transition-all duration-200",
                  isActive
                    ? color.active
                    : color.idle
                )}
              >
                <span className={cn("h-2.5 w-2.5 rounded-full shrink-0", color.dot, !isActive && "opacity-50")} />
                {t.name}
                {trackCount !== undefined && (
                  <span className={cn(
                    "text-xs font-bold px-1.5 py-0.5 rounded-lg min-w-[1.25rem] text-center",
                    isActive ? color.count : "bg-gray-100 text-gray-500"
                  )}>
                    {trackCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function getTrackBadgeColor(trackName: string): string {
  const map: Record<string, "info" | "success" | "warning" | "danger" | "neutral"> = {
    "คณิตศาสตร์และสถิติ": "info",
    "วิทยาการคอมพิวเตอร์": "info",
    "ฟิสิกส์": "warning",
    "เคมี": "success",
    "ชีววิทยา": "success",
  };
  return map[trackName] || "neutral";
}
