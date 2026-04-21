"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { SectionTitle } from "@/components/ui/section-title";
import { SummaryStatCard } from "@/components/ui/summary-stat-card";
import { useI18n } from "@/lib/i18n";
import { displayNameTh } from "@/lib/display-name";
import { formatDateTime } from "@/lib/utils";
import {
  ArrowRight,
  CheckCircle2,
  Clock,
  Image as ImageIcon,
  MapPin,
  Mic,
  Search,
  Star,
  X,
} from "lucide-react";

export interface ScoringListItem {
  presentationId: string;
  type: string;
  status: string;
  scheduledAt: string | null;
  room: string | null;
  submission: {
    paperCode: string | null;
    title: string;
    author: {
      name: string;
      prefixTh: string | null;
      firstNameTh: string | null;
      lastNameTh: string | null;
      prefixEn: string | null;
      firstNameEn: string | null;
      lastNameEn: string | null;
    };
    track: { id: string; name: string } | null;
  };
  hasEvaluation: boolean;
  earnedTotal: number;
}

export function ScoringListClient({
  items,
  criteriaTotals,
}: {
  items: ScoringListItem[];
  criteriaTotals: { ORAL: number; POSTER: number };
}) {
  const { t } = useI18n();
  const router = useRouter();
  const searchParams = useSearchParams();

  type FilterKey = "ALL" | "PENDING" | "DONE" | "ORAL" | "POSTER";
  const initialFilter = (searchParams.get("filter") as FilterKey | null) ?? "ALL";
  const initialQuery = searchParams.get("q") ?? "";

  const [filter, setFilter] = useState<FilterKey>(
    ["ALL", "PENDING", "DONE", "ORAL", "POSTER"].includes(initialFilter) ? initialFilter : "ALL"
  );
  const [search, setSearch] = useState(initialQuery);

  const updateParams = useCallback(
    (next: { filter?: FilterKey; q?: string }) => {
      const params = new URLSearchParams(searchParams.toString());
      const nextFilter = next.filter ?? filter;
      const nextQuery = next.q ?? search;
      if (nextFilter === "ALL") params.delete("filter");
      else params.set("filter", nextFilter);
      if (!nextQuery) params.delete("q");
      else params.set("q", nextQuery);
      const qs = params.toString();
      router.replace(qs ? `/presentations/scoring?${qs}` : "/presentations/scoring", {
        scroll: false,
      });
    },
    [filter, search, searchParams, router]
  );

  // Debounced sync of search query to URL
  useEffect(() => {
    const t = setTimeout(() => updateParams({ q: search }), 300);
    return () => clearTimeout(t);
  }, [search, updateParams]);

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((item) => {
      if (filter === "PENDING" && item.hasEvaluation) return false;
      if (filter === "DONE" && !item.hasEvaluation) return false;
      if (filter === "ORAL" && item.type !== "ORAL") return false;
      if (filter === "POSTER" && item.type !== "POSTER") return false;
      if (!q) return true;
      return (
        item.submission.title.toLowerCase().includes(q) ||
        (item.submission.paperCode ?? "").toLowerCase().includes(q) ||
        displayNameTh(item.submission.author).toLowerCase().includes(q) ||
        (item.submission.track?.name ?? "").toLowerCase().includes(q)
      );
    });
  }, [items, filter, search]);

  const counts = useMemo(() => {
    const pending = items.filter((i) => !i.hasEvaluation).length;
    const done = items.filter((i) => i.hasEvaluation).length;
    const oral = items.filter((i) => i.type === "ORAL").length;
    const poster = items.filter((i) => i.type === "POSTER").length;
    return { pending, done, oral, poster };
  }, [items]);

  const tabs = (
    [
      { key: "ALL", label: t("common.all"), count: items.length },
      { key: "PENDING", label: t("scoring.tabPending"), count: counts.pending },
      { key: "DONE", label: t("scoring.tabDone"), count: counts.done },
      { key: "ORAL", label: t("presentations.oral"), count: counts.oral },
      { key: "POSTER", label: t("presentations.poster"), count: counts.poster },
    ] satisfies { key: typeof filter; label: string; count: number }[]
  ).filter((tab) => tab.key === "ALL" || tab.count > 0);

  return (
    <div className="space-y-6">
      <Breadcrumb
        items={[
          { label: t("nav.dashboard"), href: "/dashboard" },
          { label: t("scoring.hubTitle") },
        ]}
      />

      <SectionTitle
        title={t("scoring.hubTitle")}
        subtitle={t("scoring.hubSubtitle", { n: items.length })}
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <SummaryStatCard
          label={t("scoring.tabPending")}
          value={counts.pending}
          icon={<Clock className="h-5 w-5" />}
          color="amber"
        />
        <SummaryStatCard
          label={t("scoring.tabDone")}
          value={counts.done}
          icon={<CheckCircle2 className="h-5 w-5" />}
          color="emerald"
        />
        <SummaryStatCard
          label={t("presentations.oral")}
          value={counts.oral}
          icon={<Mic className="h-5 w-5" />}
          color="blue"
        />
        <SummaryStatCard
          label={t("presentations.poster")}
          value={counts.poster}
          icon={<ImageIcon className="h-5 w-5" />}
          color="violet"
        />
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="relative w-full lg:max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-muted pointer-events-none" />
          <input
            type="text"
            placeholder={t("scoring.searchPlaceholder")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-border/60 bg-surface py-2 pl-9 pr-8 text-sm transition-all focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-muted hover:text-ink"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <div className="flex w-full gap-1 overflow-x-auto pb-1 lg:w-auto lg:flex-wrap">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => {
                setFilter(tab.key);
                updateParams({ filter: tab.key });
              }}
              className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium transition-all duration-150 ${
                filter === tab.key
                  ? "bg-brand-500 text-white shadow-sm"
                  : "bg-surface-alt text-ink-muted hover:text-ink hover:bg-gray-200/80"
              }`}
            >
              {tab.label}
              <span
                className={`text-[10px] rounded-full px-1.5 py-0.5 font-bold ${
                  filter === tab.key ? "bg-white/20 text-white" : "bg-gray-200/80 text-gray-500"
                }`}
              >
                {tab.count}
              </span>
            </button>
          ))}
        </div>
      </div>

      {filteredItems.length === 0 ? (
        <EmptyState
          icon={<Star className="h-12 w-12" />}
          title={items.length === 0 ? t("scoring.emptyTitle") : t("scoring.emptyFilteredTitle")}
          body={items.length === 0 ? t("scoring.emptyBody") : undefined}
        />
      ) : (
        <div className="space-y-3">
          {filteredItems.map((item) => {
            const TypeIcon = item.type === "ORAL" ? Mic : ImageIcon;
            const maxScore =
              item.type === "ORAL" ? criteriaTotals.ORAL : criteriaTotals.POSTER;
            const pct = maxScore > 0 ? Math.round((item.earnedTotal / maxScore) * 100) : 0;
            const scoreTone =
              pct >= 80
                ? "text-emerald-600"
                : pct >= 60
                  ? "text-blue-600"
                  : pct >= 40
                    ? "text-amber-600"
                    : "text-red-600";

            return (
              <Card key={item.presentationId} hover className="mb-0">
                <CardBody>
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge tone={item.type === "ORAL" ? "info" : "neutral"}>
                          <TypeIcon className="h-3 w-3" />
                          {item.type === "ORAL"
                            ? t("presentations.oral")
                            : t("presentations.poster")}
                        </Badge>
                        {item.submission.paperCode && (
                          <Badge>{item.submission.paperCode}</Badge>
                        )}
                        {item.submission.track && (
                          <Badge tone="info">{item.submission.track.name}</Badge>
                        )}
                        {item.hasEvaluation ? (
                          <Badge tone="success">
                            <CheckCircle2 className="h-3 w-3" />
                            {t("scoring.submitted")}
                          </Badge>
                        ) : (
                          <Badge tone="warning">
                            <Clock className="h-3 w-3" />
                            {t("scoring.tabPending")}
                          </Badge>
                        )}
                      </div>
                      <h3 className="text-base font-semibold leading-snug text-ink">
                        {item.submission.title}
                      </h3>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-muted">
                        <span>{displayNameTh(item.submission.author)}</span>
                        {item.scheduledAt && (
                          <span className="inline-flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {formatDateTime(item.scheduledAt)}
                          </span>
                        )}
                        {item.room && (
                          <span className="inline-flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {item.room}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      {item.hasEvaluation && maxScore > 0 && (
                        <div className="text-right">
                          <p className="text-xs font-medium text-ink-muted">
                            {t("scoring.totalScore")}
                          </p>
                          <p className={`text-xl font-bold tabular-nums leading-tight ${scoreTone}`}>
                            {item.earnedTotal}
                            <span className="text-sm font-normal text-ink-muted">
                              {" "}
                              / {maxScore}
                            </span>
                          </p>
                          <p className={`text-xs font-medium ${scoreTone}`}>{pct}%</p>
                        </div>
                      )}
                      <Link href={`/presentations/${item.presentationId}/score`}>
                        <Button
                          size="sm"
                          variant={item.hasEvaluation ? "secondary" : "primary"}
                        >
                          <Star className="h-3.5 w-3.5" />
                          {item.hasEvaluation
                            ? t("scoring.viewScore")
                            : t("scoring.giveScore")}
                          <ArrowRight className="h-3.5 w-3.5" />
                        </Button>
                      </Link>
                    </div>
                  </div>
                </CardBody>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
