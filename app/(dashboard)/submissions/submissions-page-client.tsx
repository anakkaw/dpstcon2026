"use client";

import { useState, useMemo, useCallback, memo } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { SectionTitle } from "@/components/ui/section-title";
import { Card, CardBody } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { SummaryStatCard } from "@/components/ui/summary-stat-card";
import { TrackFilter } from "@/components/track-filter";
import { Alert } from "@/components/ui/alert";
import { getSubmissionStatusLabels, SUBMISSION_STATUS_COLORS } from "@/lib/labels";
import { useI18n } from "@/lib/i18n";
import { formatDate, truncate } from "@/lib/utils";
import { displayNameTh } from "@/lib/display-name";
import { useDashboardAuth } from "@/components/dashboard-auth-context";
import { useDebounce } from "@/lib/hooks/use-debounce";
import {
  Plus, FileText, Download, ChevronUp, ChevronDown, ArrowUpDown,
  ExternalLink, Users, Search, X, CheckCircle2, XCircle, Clock,
  Eye, Trash2, MoreHorizontal, Pencil,
} from "lucide-react";
import { SubmissionPipeline } from "@/components/author/submission-pipeline";
import { getNextAction } from "@/lib/author-utils";

export interface SubmissionData {
  id: string;
  paperCode?: string | null;
  title: string;
  abstract: string | null;
  status: string;
  createdAt: string;
  author: { id: string; name: string; email: string };
  track: { id: string; name: string } | null;
  reviews: { id: string; recommendation: string | null; completedAt: string | null }[];
  reviewAssignments?: { id: string; status: string }[];
  advisorApprovalStatus?: string | null;
  advisorName?: string | null;
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
  const canCreateSubmission = roles.includes("AUTHOR");

  const [submissions, setSubmissions] = useState<SubmissionData[]>(initialSubmissions);
  const [trackFilter, setTrackFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  // Reset to page 1 whenever filters change
  const setTrackFilterAndReset = useCallback((v: string) => { setTrackFilter(v); setPage(1); }, []);
  const setStatusFilterAndReset = useCallback((v: string) => { setStatusFilter(v); setPage(1); }, []);
  const setSearchQueryAndReset = useCallback((v: string) => { setSearchQuery(v); setPage(1); }, []);
  const debouncedSearch = useDebounce(searchQuery, 300);
  const [message, setMessage] = useState("");
  const [messageTone, setMessageTone] = useState<"success" | "danger">("success");
  const [editingPaperId, setEditingPaperId] = useState<string | null>(null);
  const [paperCodeDraft, setPaperCodeDraft] = useState("");
  const [savingPaperCode, setSavingPaperCode] = useState(false);
  const [generatingCodes, setGeneratingCodes] = useState(false);
  const [showGenerateConfirm, setShowGenerateConfirm] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);

  const [sortKey, setSortKey] = useState<SortKey>("createdAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const [actionsOpenId, setActionsOpenId] = useState<string | null>(null);

  const PAGE_SIZE = 25;

  const toggleSort = useCallback((key: SortKey) => {
    setSortKey((prev) => {
      if (prev === key) {
        setSortDir((d) => (d === "asc" ? "desc" : "asc"));
        return prev;
      }
      setSortDir("desc");
      return key;
    });
    setPage(1);
  }, []);

  async function savePaperCode(submissionId: string) {
    setSavingPaperCode(true);
    setMessage("");
    try {
      const response = await fetch(`/api/submissions/${submissionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paperCode: paperCodeDraft.toUpperCase() }),
      });

      const data = await response.json().catch(() => null);
      if (!response.ok) {
        setMessageTone("danger");
        setMessage(data?.error || "Unable to save Paper ID");
        return;
      }

      setSubmissions((prev) =>
        prev.map((submission) =>
          submission.id === submissionId
            ? { ...submission, paperCode: data.submission.paperCode }
            : submission
        )
      );
      setEditingPaperId(null);
      setPaperCodeDraft("");
      setMessageTone("success");
      setMessage("Paper ID updated");
    } finally {
      setSavingPaperCode(false);
    }
  }

  async function generatePaperCodes() {
    setGeneratingCodes(true);
    setMessage("");
    try {
      const response = await fetch("/api/submissions/paper-codes/generate", {
        method: "POST",
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        setMessageTone("danger");
        setMessage(data?.error || "Unable to generate Paper IDs");
        return;
      }

      if (Array.isArray(data?.updated)) {
        const updatedMap = new Map<string, string>(
          data.updated.map((row: { id: string; paperCode: string }) => [row.id, row.paperCode])
        );
        setSubmissions((prev) =>
          prev.map((submission) => ({
            ...submission,
            paperCode: updatedMap.get(submission.id) || submission.paperCode,
          }))
        );
      }

      setMessageTone("success");
      setMessage(`Generated ${data?.count || 0} Paper ID(s)`);
    } finally {
      setGeneratingCodes(false);
    }
  }

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback((filteredIds: string[]) => {
    setSelectedIds((prev) => {
      const allSelected = filteredIds.every((id) => prev.has(id));
      if (allSelected) return new Set();
      return new Set(filteredIds);
    });
  }, []);

  async function handleBulkDelete() {
    setBulkDeleting(true);
    setMessage("");
    try {
      const res = await fetch("/api/submissions/bulk-delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: Array.from(selectedIds) }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setMessageTone("danger");
        setMessage(data?.error || t("detail.deleteError"));
        return;
      }
      setSubmissions((prev) => prev.filter((s) => !selectedIds.has(s.id)));
      setMessageTone("success");
      setMessage(t("submissions.bulkDeleteSuccess", { n: data.deletedCount }));
      setSelectedIds(new Set());
    } catch {
      setMessageTone("danger");
      setMessage(t("detail.deleteError"));
    } finally {
      setBulkDeleting(false);
      setShowBulkDeleteConfirm(false);
    }
  }

  const { statusCounts, totalFiltered } = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const sub of submissions) {
      if (trackFilter && sub.track?.id !== trackFilter) continue;
      counts[sub.status] = (counts[sub.status] || 0) + 1;
    }
    return { statusCounts: counts, totalFiltered: Object.values(counts).reduce((s, v) => s + v, 0) };
  }, [submissions, trackFilter]);

  const trackCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const sub of submissions) {
      if (sub.track?.id) counts[sub.track.id] = (counts[sub.track.id] || 0) + 1;
    }
    return counts;
  }, [submissions]);

  const filtered = useMemo(() =>
    submissions
      .filter((s) => {
        if (trackFilter && s.track?.id !== trackFilter) return false;
        if (statusFilter !== "ALL" && s.status !== statusFilter) return false;
        if (debouncedSearch) {
          const q = debouncedSearch.toLowerCase();
          return s.title.toLowerCase().includes(q) ||
            displayNameTh(s.author).toLowerCase().includes(q) ||
            s.author.email.toLowerCase().includes(q) ||
            s.track?.name.toLowerCase().includes(q) ||
            (statusLabels[s.status] || s.status).toLowerCase().includes(q) ||
            (s.advisorName && s.advisorName.toLowerCase().includes(q));
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
      }),
    [submissions, trackFilter, statusFilter, debouncedSearch, sortKey, sortDir, statusLabels]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const pagedFiltered = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  if (!isAdmin) {
    return (
      <div className="space-y-5">
      <SectionTitle
          title={t("submissions.mySubmissions")}
          subtitle={t("submissions.mySubtitle", { n: filtered.length })}
          action={canCreateSubmission ? <Link href="/submissions/new"><Button size="sm"><Plus className="h-3.5 w-3.5" />{t("submissions.newSubmission")}</Button></Link> : undefined}
        />
        <TrackFilter value={trackFilter} onChange={setTrackFilter} counts={trackCounts} />
        {filtered.length === 0 ? (
          <EmptyState icon={<FileText className="h-12 w-12" />} title={t("submissions.noSubmissions")} body={t("submissions.startSubmitting")}
            action={canCreateSubmission ? <Link href="/submissions/new"><Button>{t("submissions.newSubmission")}</Button></Link> : undefined} />
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
      <ConfirmDialog
        open={showGenerateConfirm}
        title={t("admin.generatePaperCodesConfirm")}
        description={t("admin.generatePaperCodesDesc")}
        confirmLabel={t("common.confirm")}
        cancelLabel={t("common.cancel")}
        loading={generatingCodes}
        onConfirm={async () => {
          await generatePaperCodes();
          setShowGenerateConfirm(false);
        }}
        onCancel={() => setShowGenerateConfirm(false)}
      />
      <ConfirmDialog
        open={showBulkDeleteConfirm}
        title={t("submissions.bulkDeleteConfirm", { n: selectedIds.size })}
        description={t("submissions.bulkDeleteDesc")}
        confirmLabel={t("detail.deleteAction")}
        cancelLabel={t("common.cancel")}
        tone="danger"
        loading={bulkDeleting}
        onConfirm={handleBulkDelete}
        onCancel={() => setShowBulkDeleteConfirm(false)}
      />
      <SectionTitle
        title={t("submissions.submissions")}
        subtitle={t("submissions.managementSubtitle", { n: totalFiltered })}
        action={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowGenerateConfirm(true)} loading={generatingCodes}>
              <CheckCircle2 className="h-3.5 w-3.5" />{t("submissions.generatePaperCodes")}
            </Button>
            <a href="/api/exports/proceedings?format=csv" download>
              <Button variant="outline" size="sm"><Download className="h-3.5 w-3.5" />{t("common.exportCSV")}</Button>
            </a>
          </div>
        }
      />

      {message && <Alert tone={messageTone}>{message}</Alert>}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <SummaryStatCard label={t("common.total")} value={totalFiltered} icon={<FileText className="h-5 w-5" />} color="blue" />
        <SummaryStatCard label={t("submissions.inReview")} value={submitted} icon={<Eye className="h-5 w-5" />} color="indigo" />
        <SummaryStatCard label={t("dashboard.accepted")} value={accepted} icon={<CheckCircle2 className="h-5 w-5" />} color="emerald" />
        <SummaryStatCard label={t("submissions.rejected")} value={rejected} icon={<XCircle className="h-5 w-5" />} color="red" />
        <SummaryStatCard label={t("dashboard.pending")} value={pending} icon={<Clock className="h-5 w-5" />} color="gray" />
      </div>

      {/* ── Unified toolbar: search + track + status in one row ── */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-0 flex-1 lg:max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-muted pointer-events-none" />
          <input
            type="text"
            placeholder={t("submissions.searchPlaceholder")}
            value={searchQuery}
            onChange={(e) => setSearchQueryAndReset(e.target.value)}
            className="w-full pl-9 pr-8 py-2 text-sm border border-border/60 rounded-lg bg-surface focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 transition-all"
          />
          {searchQuery && (
            <button type="button" aria-label={t("common.clear")} onClick={() => setSearchQueryAndReset("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-muted hover:text-ink">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <TrackFilter value={trackFilter} onChange={setTrackFilterAndReset} counts={trackCounts} />
        <div className="flex flex-wrap gap-1">
          {statusTabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setStatusFilterAndReset(tab.key)}
              className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-chip px-3 py-1.5 text-xs font-medium transition-all duration-150 ${
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

      {selectedIds.size > 0 && (
        <div className="sticky top-0 z-20 flex items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 shadow-sm">
          <span className="text-sm font-medium text-red-800">
            {t("submissions.deleteSelected", { n: selectedIds.size })}
          </span>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => setSelectedIds(new Set())}>
              {t("common.cancel")}
            </Button>
            <Button variant="danger" size="sm" onClick={() => setShowBulkDeleteConfirm(true)}>
              <Trash2 className="h-3.5 w-3.5" />
              {t("detail.deleteAction")}
            </Button>
          </div>
        </div>
      )}

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
            {pagedFiltered.map((sub) => {
              const totalAssign = sub.reviewAssignments?.length || 0;
              const completedAssign = sub.reviewAssignments?.filter((a) => a.status === "COMPLETED").length || 0;

              return (
                <div key={sub.id} className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(sub.id)}
                    onChange={() => toggleSelect(sub.id)}
                    className="mt-4 h-4 w-4 shrink-0 rounded border-gray-300 text-brand-600 focus:ring-brand-500 cursor-pointer"
                  />
                  <Link href={`/submissions/${sub.id}`} className="flex-1 min-w-0">
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
                        {sub.paperCode && <Badge>{sub.paperCode}</Badge>}
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
                        {sub.advisorName && (
                          <div className="col-span-2">
                            <p className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
                              {t("submissions.advisorCol")}
                            </p>
                            <p className="mt-1 text-ink inline-flex items-center gap-1">
                              {sub.advisorApprovalStatus === "APPROVED" ? (
                                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                              ) : sub.advisorApprovalStatus === "PENDING" ? (
                                <Clock className="h-3.5 w-3.5 text-amber-500" />
                              ) : sub.advisorApprovalStatus === "REJECTED" ? (
                                <XCircle className="h-3.5 w-3.5 text-red-500" />
                              ) : null}
                              {sub.advisorName}
                            </p>
                          </div>
                        )}
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
                </div>
              );
            })}
          </div>

          {/* ── Desktop 7-column table ── */}
          <Card className="hidden lg:block">
            <CardBody className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50/80 border-b border-border/60">
                      <th className="w-10 px-4 py-3">
                        <input
                          type="checkbox"
                          checked={filtered.length > 0 && filtered.every((s) => selectedIds.has(s.id))}
                          onChange={() => toggleSelectAll(filtered.map((s) => s.id))}
                          aria-label={t("submissions.selectAll")}
                          className="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500 cursor-pointer"
                        />
                      </th>
                      <th className="w-[90px] px-3 py-3 text-left text-xs font-semibold text-ink-muted uppercase tracking-wider">
                        Paper ID
                      </th>
                      <SortTh label={t("submissions.title")} sortKey_="title" currentKey={sortKey} dir={sortDir} onSort={toggleSort} className="w-[35%]" />
                      <SortTh label={t("submissions.track")} sortKey_="track" currentKey={sortKey} dir={sortDir} onSort={toggleSort} />
                      <SortTh label={t("submissions.reviewsCol")} sortKey_="reviews" currentKey={sortKey} dir={sortDir} onSort={toggleSort} align="center" />
                      <SortTh label={t("submissions.status")} sortKey_="status" currentKey={sortKey} dir={sortDir} onSort={toggleSort} />
                      <th className="w-10" />
                    </tr>
                  </thead>
                  <tbody>
                    {pagedFiltered.map((sub) => {
                      const totalAssign = sub.reviewAssignments?.length || 0;
                      const completedAssign = sub.reviewAssignments?.filter((a) => a.status === "COMPLETED").length || 0;
                      return (
                        <tr key={sub.id} className={`border-t border-border/40 transition-colors group ${selectedIds.has(sub.id) ? "bg-brand-50/40" : "hover:bg-surface-1"}`}>
                          {/* checkbox */}
                          <td className="px-4 py-3">
                            <input
                              type="checkbox"
                              checked={selectedIds.has(sub.id)}
                              onChange={() => toggleSelect(sub.id)}
                              className="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500 cursor-pointer"
                            />
                          </td>
                          {/* paper code — popover edit */}
                          <td className="relative px-3 py-3">
                            <PaperCodeCell
                              submissionId={sub.id}
                              paperCode={sub.paperCode}
                              open={editingPaperId === sub.id}
                              draft={paperCodeDraft}
                              saving={savingPaperCode}
                              onOpen={() => { setEditingPaperId(sub.id); setPaperCodeDraft(sub.paperCode || ""); }}
                              onClose={() => setEditingPaperId(null)}
                              onDraftChange={(v) => setPaperCodeDraft(v.toUpperCase())}
                              onSave={() => savePaperCode(sub.id)}
                            />
                          </td>
                          {/* title + author + time */}
                          <td className="px-4 py-3">
                            <Link href={`/submissions/${sub.id}`} className="group/link block">
                              <p className="font-medium text-ink leading-snug line-clamp-2 group-hover/link:text-brand-600 transition-colors">{sub.title}</p>
                              <p className="mt-0.5 text-[11px] text-ink-muted">
                                {displayNameTh(sub.author)} · {formatDate(sub.createdAt, locale)}
                              </p>
                            </Link>
                          </td>
                          {/* track */}
                          <td className="px-4 py-3">
                            {sub.track ? <Badge tone="info">{sub.track.name}</Badge> : <span className="text-ink-muted text-xs">—</span>}
                          </td>
                          {/* reviews */}
                          <td className="px-4 py-3 text-center">
                            {totalAssign > 0 ? (
                              <div className="inline-flex items-center gap-1.5">
                                <Users className="h-3 w-3 text-ink-muted" aria-hidden="true" />
                                <span className={`text-xs font-medium ${completedAssign === totalAssign ? "text-emerald-600" : "text-ink"}`}>{completedAssign}/{totalAssign}</span>
                                <div className="w-10 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                  <div
                                    className={`h-full rounded-full ${completedAssign === totalAssign ? "bg-emerald-500" : "bg-blue-500"}`}
                                    style={{ width: `${(completedAssign / totalAssign) * 100}%` }}
                                  />
                                </div>
                              </div>
                            ) : (
                              <span className="text-ink-muted text-xs">—</span>
                            )}
                          </td>
                          {/* status + advisor stacked */}
                          <td className="px-4 py-3">
                            <Badge tone={SUBMISSION_STATUS_COLORS[sub.status] || "neutral"}>
                              {statusLabels[sub.status] || sub.status}
                            </Badge>
                            {sub.advisorName && (
                              <p className="mt-1 inline-flex items-center gap-1 text-[11px] text-ink-muted">
                                {sub.advisorApprovalStatus === "APPROVED" ? <CheckCircle2 className="h-3 w-3 text-emerald-500" aria-hidden="true" /> :
                                  sub.advisorApprovalStatus === "REJECTED" ? <XCircle className="h-3 w-3 text-red-500" aria-hidden="true" /> :
                                  <Clock className="h-3 w-3 text-amber-400" aria-hidden="true" />}
                                {truncate(sub.advisorName, 22)}
                              </p>
                            )}
                          </td>
                          {/* ⋮ actions */}
                          <td className="pr-3 py-3">
                            <RowActionsMenu
                              submissionId={sub.id}
                              open={actionsOpenId === sub.id}
                              onToggle={() => setActionsOpenId((prev) => prev === sub.id ? null : sub.id)}
                              onClose={() => setActionsOpenId(null)}
                              viewLabel={t("common.viewAll")}
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardBody>
          </Card>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between text-xs text-ink-muted">
              <span>
                {t("submissions.showingCount", {
                  shown: Math.min(page * PAGE_SIZE, filtered.length),
                  total: filtered.length,
                })}
              </span>
              <div className="flex items-center gap-1">
                <button type="button" disabled={page === 1} onClick={() => setPage((p) => p - 1)}
                  className="h-8 w-8 inline-flex items-center justify-center rounded-lg border border-border/60 disabled:opacity-40 hover:bg-surface-hover transition-colors">
                  <ChevronDown className="h-3.5 w-3.5 rotate-90" aria-hidden="true" />
                </button>
                <span className="px-2 font-medium text-ink">{page} / {totalPages}</span>
                <button type="button" disabled={page === totalPages} onClick={() => setPage((p) => p + 1)}
                  className="h-8 w-8 inline-flex items-center justify-center rounded-lg border border-border/60 disabled:opacity-40 hover:bg-surface-hover transition-colors">
                  <ChevronDown className="h-3.5 w-3.5 -rotate-90" aria-hidden="true" />
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {filtered.length > 0 && totalPages <= 1 && (
        <p className="text-xs text-ink-muted text-center">
          {t("submissions.showingCount", { shown: filtered.length, total: totalFiltered })}
        </p>
      )}
    </div>
  );
}

const SortTh = memo(function SortTh({ label, sortKey_, currentKey, dir, onSort, align, className }: {
  label: string; sortKey_: string; currentKey: string; dir: "asc" | "desc";
  onSort: (k: never) => void; align?: "center" | "left"; className?: string;
}) {
  const active = currentKey === sortKey_;
  return (
    <th
      className={`${align === "center" ? "text-center" : "text-left"} px-4 py-3 text-xs font-semibold text-ink-muted uppercase tracking-wider ${className || ""}`}
      aria-sort={active ? (dir === "asc" ? "ascending" : "descending") : "none"}
    >
      <button
        type="button"
        onClick={() => onSort(sortKey_ as never)}
        className="inline-flex items-center gap-1 select-none hover:text-ink transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 rounded"
        aria-label={`${label}${active ? (dir === "asc" ? ", sorted ascending" : ", sorted descending") : ""}`}
      >
        {label}
        {active ? (dir === "asc" ? <ChevronUp className="h-3 w-3" aria-hidden="true" /> : <ChevronDown className="h-3 w-3" aria-hidden="true" />) : <ArrowUpDown className="h-3 w-3 opacity-30" aria-hidden="true" />}
      </button>
    </th>
  );
});

const PaperCodeCell = memo(function PaperCodeCell({
  paperCode, open, draft, saving, onOpen, onClose, onDraftChange, onSave,
}: {
  submissionId: string; paperCode?: string | null; open: boolean; draft: string; saving: boolean;
  onOpen: () => void; onClose: () => void; onDraftChange: (v: string) => void; onSave: () => void;
}) {
  return (
    <div className="relative">
      <button
        type="button"
        onClick={open ? onClose : onOpen}
        className="inline-flex items-center gap-1 font-mono text-xs font-semibold text-brand-700 hover:text-brand-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 rounded"
        title="Edit paper code"
      >
        {paperCode || <span className="text-ink-muted font-normal">Set ID</span>}
        <Pencil className="h-2.5 w-2.5 opacity-50" aria-hidden="true" />
      </button>
      {open && (
        <div className="absolute left-0 top-full z-30 mt-1 w-52 rounded-card border border-border bg-white p-3 shadow-elev-3">
          <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-ink-muted">Paper ID</label>
          <input
            autoFocus
            value={draft}
            onChange={(e) => onDraftChange(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") onSave(); if (e.key === "Escape") onClose(); }}
            className="w-full rounded-lg border border-border/60 px-2.5 py-1.5 font-mono text-xs text-ink focus:outline-none focus:ring-2 focus:ring-brand-500/30"
          />
          <div className="mt-2 flex justify-end gap-2">
            <button type="button" onClick={onClose} className="text-xs text-ink-muted hover:text-ink">Cancel</button>
            <button type="button" onClick={onSave} disabled={saving} className="rounded-button bg-brand-500 px-2.5 py-1 text-xs font-semibold text-white hover:brightness-110 disabled:opacity-50">
              {saving ? "…" : "Save"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
});

const RowActionsMenu = memo(function RowActionsMenu({
  submissionId, open, onToggle, onClose, viewLabel,
}: {
  submissionId: string; open: boolean; onToggle: () => void; onClose: () => void; viewLabel: string;
}) {
  return (
    <div className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Row actions"
        onClick={onToggle}
        className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-ink-muted opacity-0 transition-opacity group-hover:opacity-100 hover:bg-surface-hover focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40"
      >
        <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-20" aria-hidden="true" onClick={onClose} />
          <div role="menu" className="absolute right-0 top-full z-30 mt-1 w-32 rounded-card border border-border bg-white py-1 shadow-elev-3">
            <Link
              href={`/submissions/${submissionId}`}
              role="menuitem"
              onClick={onClose}
              className="flex items-center gap-2 px-3 py-2 text-xs text-ink hover:bg-surface-1 transition-colors"
            >
              <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
              {viewLabel}
            </Link>
          </div>
        </>
      )}
    </div>
  );
});
