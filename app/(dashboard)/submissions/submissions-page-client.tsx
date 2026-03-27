"use client";

import { useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SectionTitle } from "@/components/ui/section-title";
import { Card, CardBody } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { SummaryStatCard } from "@/components/ui/summary-stat-card";
import { TrackFilter } from "@/components/track-filter";
import { getSubmissionStatusLabels, SUBMISSION_STATUS_COLORS } from "@/lib/labels";
import { useI18n } from "@/lib/i18n";
import { formatDate, truncate } from "@/lib/utils";
import { displayNameTh } from "@/lib/display-name";
import { useDashboardAuth } from "@/components/dashboard-auth-context";
import {
  Plus, FileText, Download, ChevronUp, ChevronDown, ArrowUpDown,
  ExternalLink, Users, Search, X, CheckCircle2, XCircle, Clock,
  Eye,
} from "lucide-react";
import { SubmissionPipeline } from "@/components/author/submission-pipeline";
import { getNextAction } from "@/lib/author-utils";

export interface SubmissionData {
  id: string;
  title: string;
  abstract: string | null;
  status: string;
  createdAt: string;
  author: { id: string; name: string; email: string };
  track: { id: string; name: string } | null;
  reviews: { id: string; recommendation: string | null; completedAt: string | null }[];
  reviewAssignments?: { id: string; status: string }[];
}

type SortKey = "title" | "author" | "track" | "status" | "createdAt" | "reviews";

export function SubmissionsPageClient({
  initialSubmissions,
}: {
  initialSubmissions: SubmissionData[];
}) {
  const { t, locale } = useI18n();
  const statusLabels = getSubmissionStatusLabels(t);
  const { roles } = useDashboardAuth();
  const isAdmin = roles.some((role) => ["ADMIN", "PROGRAM_CHAIR"].includes(role));

  const [submissions] = useState<SubmissionData[]>(initialSubmissions);
  const [trackFilter, setTrackFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  const [sortKey, setSortKey] = useState<SortKey>("createdAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("desc"); }
  }

  const statusCounts: Record<string, number> = {};
  for (const sub of submissions) {
    if (trackFilter && sub.track?.id !== trackFilter) continue;
    statusCounts[sub.status] = (statusCounts[sub.status] || 0) + 1;
  }
  const totalFiltered = Object.values(statusCounts).reduce((s, v) => s + v, 0);

  const trackCounts: Record<string, number> = {};
  for (const sub of submissions) {
    if (sub.track?.id) trackCounts[sub.track.id] = (trackCounts[sub.track.id] || 0) + 1;
  }

  const filtered = submissions
    .filter((s) => {
      if (trackFilter && s.track?.id !== trackFilter) return false;
      if (statusFilter !== "ALL" && s.status !== statusFilter) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return s.title.toLowerCase().includes(q) ||
          displayNameTh(s.author).toLowerCase().includes(q) ||
          s.author.email.toLowerCase().includes(q) ||
          s.track?.name.toLowerCase().includes(q) ||
          (statusLabels[s.status] || s.status).toLowerCase().includes(q);
      }
      return true;
    })
    .sort((a, b) => {
      const dir = sortDir === "asc" ? 1 : -1;
      switch (sortKey) {
        case "title": return dir * a.title.localeCompare(b.title);
        case "author": return dir * displayNameTh(a.author).localeCompare(displayNameTh(b.author));
        case "track": return dir * (a.track?.name || "").localeCompare(b.track?.name || "");
        case "status": return dir * a.status.localeCompare(b.status);
        case "createdAt": return dir * a.createdAt.localeCompare(b.createdAt);
        case "reviews": {
          const ra = a.reviewAssignments?.length || 0;
          const rb = b.reviewAssignments?.length || 0;
          return dir * (ra - rb);
        }
        default: return 0;
      }
    });

  if (!isAdmin) {
    return (
      <div className="space-y-5">
      <SectionTitle
          title={t("submissions.mySubmissions")}
          subtitle={t("submissions.mySubtitle", { n: filtered.length })}
          action={<Link href="/submissions/new"><Button size="sm"><Plus className="h-3.5 w-3.5" />{t("submissions.newSubmission")}</Button></Link>}
        />
        <TrackFilter value={trackFilter} onChange={setTrackFilter} counts={trackCounts} />
        {filtered.length === 0 ? (
          <EmptyState icon={<FileText className="h-12 w-12" />} title={t("submissions.noSubmissions")} body={t("submissions.startSubmitting")}
            action={<Link href="/submissions/new"><Button>{t("submissions.newSubmission")}</Button></Link>} />
        ) : (
          <div className="space-y-4">
            {filtered.map((sub) => {
              const action = getNextAction(sub.status, true, t);
              return (
                <Link key={sub.id} href={`/submissions/${sub.id}`}>
                  <Card hover className="mb-0">
                    <CardBody className="py-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <h3 className="text-sm font-semibold text-ink truncate">{sub.title}</h3>
                          {sub.abstract && <p className="text-xs text-ink-muted mt-1 line-clamp-1">{truncate(sub.abstract, 120)}</p>}
                          <div className="flex items-center gap-2.5 mt-2 text-xs text-ink-muted flex-wrap">
                            {sub.track && <Badge tone="info">{sub.track.name}</Badge>}
                            <span>{formatDate(sub.createdAt, locale)}</span>
                            {action && <Badge tone={action.urgency === "urgent" ? "danger" : action.urgency === "warning" ? "warning" : "neutral"}>{action.label}</Badge>}
                          </div>
                          <div className="mt-2.5"><SubmissionPipeline status={sub.status} compact /></div>
                        </div>
                        <Badge tone={SUBMISSION_STATUS_COLORS[sub.status] || "neutral"}>{statusLabels[sub.status] || sub.status}</Badge>
                      </div>
                    </CardBody>
                  </Card>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  const statusTabs = [
    { key: "ALL", label: t("common.all"), count: totalFiltered },
    ...Object.entries(statusCounts)
      .sort(([a], [b]) => {
        const order = ["DRAFT", "ADVISOR_APPROVAL_PENDING", "SUBMITTED", "UNDER_REVIEW", "REVISION_REQUIRED", "REBUTTAL", "ACCEPTED", "CAMERA_READY_PENDING", "CAMERA_READY_SUBMITTED", "REJECTED", "DESK_REJECTED", "WITHDRAWN"];
        return order.indexOf(a) - order.indexOf(b);
      })
      .map(([key, count]) => ({ key, label: statusLabels[key] || key, count })),
  ];

  const submitted = (statusCounts.SUBMITTED || 0) + (statusCounts.UNDER_REVIEW || 0);
  const accepted = (statusCounts.ACCEPTED || 0) + (statusCounts.CAMERA_READY_PENDING || 0) + (statusCounts.CAMERA_READY_SUBMITTED || 0);
  const rejected = (statusCounts.REJECTED || 0) + (statusCounts.DESK_REJECTED || 0);
  const pending = (statusCounts.DRAFT || 0) + (statusCounts.ADVISOR_APPROVAL_PENDING || 0);

  return (
    <div className="space-y-6">
      <SectionTitle
        title={t("submissions.submissions")}
        subtitle={t("submissions.managementSubtitle", { n: totalFiltered })}
        action={
          <a href="/api/exports/proceedings?format=csv" download>
            <Button variant="outline" size="sm"><Download className="h-3.5 w-3.5" />{t("common.exportCSV")}</Button>
          </a>
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <SummaryStatCard label={t("common.total")} value={totalFiltered} icon={<FileText className="h-5 w-5" />} color="blue" />
        <SummaryStatCard label={t("submissions.inReview")} value={submitted} icon={<Eye className="h-5 w-5" />} color="indigo" />
        <SummaryStatCard label={t("dashboard.accepted")} value={accepted} icon={<CheckCircle2 className="h-5 w-5" />} color="emerald" />
        <SummaryStatCard label={t("submissions.rejected")} value={rejected} icon={<XCircle className="h-5 w-5" />} color="red" />
        <SummaryStatCard label={t("dashboard.pending")} value={pending} icon={<Clock className="h-5 w-5" />} color="gray" />
      </div>

      <TrackFilter value={trackFilter} onChange={setTrackFilter} counts={trackCounts} />

      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-muted pointer-events-none" />
          <input
            type="text"
            placeholder={t("submissions.searchPlaceholder")}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-8 py-2 text-sm border border-border/60 rounded-lg bg-surface focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 transition-all"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-muted hover:text-ink">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <div className="flex w-full gap-1 overflow-x-auto pb-1 sm:flex-wrap">
          {statusTabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setStatusFilter(tab.key)}
              className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium transition-all duration-150 ${
                statusFilter === tab.key
                  ? "bg-brand-500 text-white shadow-sm"
                  : "bg-surface-alt text-ink-muted hover:text-ink hover:bg-gray-200/80"
              }`}
            >
              {tab.label}
              <span className={`text-[10px] rounded-full px-1.5 py-0.5 font-bold ${
                statusFilter === tab.key ? "bg-white/20 text-white" : "bg-gray-200/80 text-gray-500"
              }`}>{tab.count}</span>
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={<FileText className="h-12 w-12" />}
          title={
            searchQuery
              ? t("submissions.noResultsFor", { query: searchQuery })
              : statusFilter !== "ALL"
                ? t("submissions.noStatusItems", { status: statusLabels[statusFilter] || statusFilter })
                : t("submissions.noSubmissions")
          }
        />
      ) : (
        <>
          <div className="space-y-3 lg:hidden">
            {filtered.map((sub) => {
              const totalAssign = sub.reviewAssignments?.length || 0;
              const completedAssign = sub.reviewAssignments?.filter((a) => a.status === "COMPLETED").length || 0;

              return (
                <Link key={sub.id} href={`/submissions/${sub.id}`}>
                  <Card hover>
                    <CardBody className="space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-base font-semibold leading-snug text-ink">{sub.title}</p>
                          {sub.abstract && (
                            <p className="mt-1 text-sm text-ink-muted line-clamp-2">
                              {truncate(sub.abstract, 140)}
                            </p>
                          )}
                        </div>
                        <ExternalLink className="h-4 w-4 shrink-0 text-ink-muted" />
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {sub.track && <Badge tone="info">{sub.track.name}</Badge>}
                        <Badge tone={SUBMISSION_STATUS_COLORS[sub.status] || "neutral"} dot>
                          {statusLabels[sub.status] || sub.status}
                        </Badge>
                      </div>

                      <div className="grid grid-cols-2 gap-3 rounded-xl bg-surface-alt p-3 text-sm">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
                            {t("submissions.author")}
                          </p>
                          <p className="mt-1 text-ink">{displayNameTh(sub.author)}</p>
                        </div>
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
                            {t("submissions.submitted")}
                          </p>
                          <p className="mt-1 text-ink">{formatDate(sub.createdAt, locale)}</p>
                        </div>
                      </div>

                      <div className="flex items-center justify-between gap-3">
                        <span className="text-sm text-ink-muted">{t("submissions.reviewsCol")}</span>
                        {totalAssign > 0 ? (
                          <div className="flex min-w-0 flex-1 items-center justify-end gap-2">
                            <span className="text-sm font-medium text-ink">
                              {completedAssign}/{totalAssign}
                            </span>
                            <div className="h-2 w-24 overflow-hidden rounded-full bg-gray-100">
                              <div
                                className={`h-full rounded-full ${completedAssign === totalAssign ? "bg-emerald-500" : "bg-blue-500"}`}
                                style={{ width: `${totalAssign > 0 ? (completedAssign / totalAssign) * 100 : 0}%` }}
                              />
                            </div>
                          </div>
                        ) : (
                          <span className="text-sm text-ink-muted">—</span>
                        )}
                      </div>
                    </CardBody>
                  </Card>
                </Link>
              );
            })}
          </div>

          <Card className="hidden lg:block">
            <CardBody className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50/80 border-b border-border/60">
                    <th className="w-12 px-4 py-3 text-left text-xs font-semibold text-ink-muted uppercase tracking-wider">#</th>
                    <SortTh label={t("submissions.title")} sortKey_="title" currentKey={sortKey} dir={sortDir} onSort={toggleSort} className="w-[35%]" />
                    <SortTh label={t("submissions.author")} sortKey_="author" currentKey={sortKey} dir={sortDir} onSort={toggleSort} />
                    <SortTh label={t("submissions.track")} sortKey_="track" currentKey={sortKey} dir={sortDir} onSort={toggleSort} />
                    <SortTh label={t("submissions.reviewsCol")} sortKey_="reviews" currentKey={sortKey} dir={sortDir} onSort={toggleSort} align="center" />
                    <SortTh label={t("submissions.submitted")} sortKey_="createdAt" currentKey={sortKey} dir={sortDir} onSort={toggleSort} />
                    <SortTh label={t("submissions.status")} sortKey_="status" currentKey={sortKey} dir={sortDir} onSort={toggleSort} align="center" />
                    <th className="w-10" />
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((sub, idx) => {
                    const totalAssign = sub.reviewAssignments?.length || 0;
                    const completedAssign = sub.reviewAssignments?.filter((a) => a.status === "COMPLETED").length || 0;
                    return (
                      <tr key={sub.id} className="border-t border-border/40 hover:bg-blue-50/30 transition-colors group">
                        <td className="px-4 py-3.5 text-xs text-ink-muted font-medium">{idx + 1}</td>
                        <td className="px-4 py-3.5">
                          <Link href={`/submissions/${sub.id}`} className="group/link">
                            <p className="font-medium text-ink leading-snug line-clamp-2 group-hover/link:text-brand-600 transition-colors">{sub.title}</p>
                            {sub.abstract && <p className="text-[11px] text-ink-muted mt-0.5 line-clamp-1">{truncate(sub.abstract, 80)}</p>}
                          </Link>
                        </td>
                        <td className="px-4 py-3.5">
                          <div>
                            <p className="text-xs font-medium text-ink whitespace-nowrap">{displayNameTh(sub.author)}</p>
                            <p className="text-[11px] text-ink-muted">{sub.author.email}</p>
                          </div>
                        </td>
                        <td className="px-4 py-3.5">
                          {sub.track ? <Badge tone="info">{sub.track.name}</Badge> : <span className="text-ink-muted text-xs">—</span>}
                        </td>
                        <td className="px-4 py-3.5 text-center">
                          {totalAssign > 0 ? (
                            <div className="flex items-center justify-center gap-1.5">
                              <div className="flex items-center gap-1 text-xs font-medium text-ink">
                                <Users className="h-3 w-3 text-ink-muted" />
                                <span className={completedAssign === totalAssign ? "text-emerald-600" : ""}>{completedAssign}/{totalAssign}</span>
                              </div>
                              <div className="w-10 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full ${completedAssign === totalAssign ? "bg-emerald-500" : "bg-blue-500"}`}
                                  style={{ width: `${totalAssign > 0 ? (completedAssign / totalAssign) * 100 : 0}%` }}
                                />
                              </div>
                            </div>
                          ) : (
                            <span className="text-ink-muted text-xs">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3.5 text-xs text-ink-muted whitespace-nowrap">{formatDate(sub.createdAt, locale)}</td>
                        <td className="px-4 py-3.5 text-center">
                          <Badge tone={SUBMISSION_STATUS_COLORS[sub.status] || "neutral"} dot>
                            {statusLabels[sub.status] || sub.status}
                          </Badge>
                        </td>
                        <td className="pr-4 py-3.5">
                          <Link
                            href={`/submissions/${sub.id}`}
                            className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-lg hover:bg-surface-hover inline-flex"
                          >
                            <ExternalLink className="h-3.5 w-3.5 text-ink-muted" />
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            </CardBody>
          </Card>
        </>
      )}

      {filtered.length > 0 && (
        <p className="text-xs text-ink-muted text-center">
          {t("submissions.showingCount", { shown: filtered.length, total: totalFiltered })}
          {searchQuery ? ` ${t("submissions.matchingQuery", { query: searchQuery })}` : ""}
        </p>
      )}
    </div>
  );
}

function SortTh({ label, sortKey_, currentKey, dir, onSort, align, className }: {
  label: string; sortKey_: string; currentKey: string; dir: "asc" | "desc";
  onSort: (k: never) => void; align?: "center" | "left"; className?: string;
}) {
  const active = currentKey === sortKey_;
  return (
    <th
      className={`${align === "center" ? "text-center" : "text-left"} px-4 py-3 text-xs font-semibold text-ink-muted uppercase tracking-wider cursor-pointer select-none hover:text-ink transition-colors ${className || ""}`}
      onClick={() => onSort(sortKey_ as never)}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {active ? (dir === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />) : <ArrowUpDown className="h-3 w-3 opacity-30" />}
      </span>
    </th>
  );
}
