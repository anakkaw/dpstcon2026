"use client";

import { useState, useMemo, useCallback, memo, useEffect, Fragment } from "react";
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
  Eye, Trash2, MoreHorizontal, Pencil, AlertCircle, Copy, Check,
  Send, FileDown,
} from "lucide-react";
import { SubmissionPipeline } from "@/components/author/submission-pipeline";
import { getNextAction } from "@/lib/author-utils";
import { MyReviewTasksCard, type MyReviewTask } from "@/components/reviews/my-review-tasks-card";
import { AssignmentPanel, type ReviewerOption } from "@/components/reviews/assignment-panel";
import { ReviewProgressMini, type ProgressAssignment } from "@/components/reviews/review-progress-mini";
import { PdfPreviewModal } from "@/components/ui/pdf-preview-modal";

export interface SubmissionAssignment {
  id: string;
  status: string;
  assignedAt?: string;
  dueDate?: string | null;
  reviewer?: {
    id: string;
    name: string;
    affiliation?: string | null;
    prefixTh?: string | null;
    firstNameTh?: string | null;
    lastNameTh?: string | null;
  } | null;
}

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
  reviewAssignments?: SubmissionAssignment[];
  advisorApprovalStatus?: string | null;
  advisorName?: string | null;
  advisorEmail?: string | null;
  advisorApprovalAt?: string | null;
  submittedAt?: string | null;
  /** @deprecated legacy column from pre-R2 storage — no longer populated by the app. */
  fileUrl?: string | null;
  /** Latest MANUSCRIPT file for 1-click preview from the workbench row. */
  manuscriptFile?: { id: string; originalName: string; mimeType: string } | null;
}

const NEEDS_ACTION_STATUSES = new Set([
  "DRAFT",
  "ADVISOR_APPROVAL_PENDING",
  "REVISION_REQUIRED",
  "CAMERA_READY_PENDING",
]);

function daysSince(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
}

type SortKey = "title" | "author" | "track" | "status" | "createdAt" | "reviews";

export function SubmissionsPageClient({
  initialSubmissions,
  reviewerPool = [],
}: {
  initialSubmissions: SubmissionData[];
  reviewerPool?: ReviewerOption[];
}) {
  const { t, locale } = useI18n();
  const statusLabels = getSubmissionStatusLabels(t);
  const { roles, id: currentUserId } = useDashboardAuth();
  const isAdmin = roles.some((role) => ["ADMIN", "PROGRAM_CHAIR"].includes(role));
  const canCreateSubmission = roles.includes("AUTHOR");

  const [submissions, setSubmissions] = useState<SubmissionData[]>(initialSubmissions);

  // Sync local state with fresh server data after router.refresh() (e.g. after
  // assigning a reviewer). Without this, useState keeps the initial prop and
  // the table looks stale.
  useEffect(() => {
    setSubmissions(initialSubmissions);
  }, [initialSubmissions]);
  const [trackFilter, setTrackFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  // quick filters: "none" | "needs_action" | "advisor_stalled"
  const [quickFilter, setQuickFilter] = useState<"none" | "needs_action" | "advisor_stalled">("none");
  const [resendingId, setResendingId] = useState<string | null>(null);
  const [copiedEmail, setCopiedEmail] = useState<string | null>(null);

  // Reset to page 1 whenever filters change
  const setTrackFilterAndReset = useCallback((v: string) => { setTrackFilter(v); setPage(1); }, []);
  const setStatusFilterAndReset = useCallback((v: string) => { setStatusFilter(v); setPage(1); setQuickFilter("none"); }, []);
  const setSearchQueryAndReset = useCallback((v: string) => { setSearchQuery(v); setPage(1); }, []);
  const setQuickFilterAndReset = useCallback((v: "none" | "needs_action" | "advisor_stalled") => {
    setQuickFilter((prev) => (prev === v ? "none" : v));
    setStatusFilter("ALL");
    setPage(1);
  }, []);

  async function handleResendAdvisor(subId: string) {
    setResendingId(subId);
    setMessage("");
    try {
      const res = await fetch(`/api/submissions/${subId}/resend-advisor-approval`, { method: "POST" });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setMessageTone("danger");
        setMessage(data?.error || t("detail.advisorResendError"));
        return;
      }
      setMessageTone("success");
      setMessage(t("detail.advisorResendSuccess"));
    } catch {
      setMessageTone("danger");
      setMessage(t("detail.advisorResendError"));
    } finally {
      setResendingId(null);
    }
  }

  async function copyEmail(email: string) {
    try {
      await navigator.clipboard.writeText(email);
      setCopiedEmail(email);
      setTimeout(() => setCopiedEmail((e) => (e === email ? null : e)), 1500);
    } catch {
      // ignore
    }
  }
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
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [previewFor, setPreviewFor] = useState<{
    submissionId: string;
    fileId: string;
    fileName: string;
    mimeType: string;
  } | null>(null);

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
        if (quickFilter === "needs_action" && !NEEDS_ACTION_STATUSES.has(s.status)) return false;
        if (quickFilter === "advisor_stalled") {
          if (s.status !== "ADVISOR_APPROVAL_PENDING") return false;
          if (!s.submittedAt || daysSince(s.submittedAt) < 7) return false;
        }
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
    [submissions, trackFilter, statusFilter, debouncedSearch, sortKey, sortDir, statusLabels, quickFilter]);

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

  const needsActionCount = useMemo(
    () => submissions.filter((s) => (!trackFilter || s.track?.id === trackFilter) && NEEDS_ACTION_STATUSES.has(s.status)).length,
    [submissions, trackFilter]
  );

  // Derive "my review tasks" — the logged-in user's own pending/accepted assignments
  // across any paper visible in the workbench. Powers the top card for dual-role PCs.
  const myReviewTasks = useMemo<MyReviewTask[]>(() => {
    if (!roles.includes("REVIEWER") || !currentUserId) return [];
    const out: MyReviewTask[] = [];
    for (const s of submissions) {
      for (const a of s.reviewAssignments || []) {
        if (!a.reviewer || a.reviewer.id !== currentUserId) continue;
        if (a.status === "COMPLETED") continue;
        out.push({
          id: a.id,
          status: a.status,
          dueDate: a.dueDate ?? null,
          submission: {
            id: s.id,
            title: s.title,
            track: s.track,
          },
        });
      }
    }
    return out;
  }, [submissions, roles, currentUserId]);
  const advisorStalledCount = useMemo(
    () => submissions.filter((s) =>
      (!trackFilter || s.track?.id === trackFilter) &&
      s.status === "ADVISOR_APPROVAL_PENDING" &&
      s.submittedAt &&
      daysSince(s.submittedAt) >= 7
    ).length,
    [submissions, trackFilter]
  );

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

      {/* Personal review tasks — surfaced on the workbench so PC+Reviewer users
          see their own pending reviews before the management table. */}
      <MyReviewTasksCard tasks={myReviewTasks} />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <ClickableStatCard active={statusFilter === "ALL" && quickFilter === "none"} onClick={() => { setStatusFilterAndReset("ALL"); }}>
          <SummaryStatCard label={t("common.total")} value={totalFiltered} icon={<FileText className="h-5 w-5" />} color="blue" />
        </ClickableStatCard>
        <ClickableStatCard active={statusFilter === "UNDER_REVIEW"} onClick={() => setStatusFilterAndReset("UNDER_REVIEW")}>
          <SummaryStatCard label={t("submissions.inReview")} value={submitted} icon={<Eye className="h-5 w-5" />} color="indigo" />
        </ClickableStatCard>
        <ClickableStatCard active={statusFilter === "ACCEPTED"} onClick={() => setStatusFilterAndReset("ACCEPTED")}>
          <SummaryStatCard label={t("dashboard.accepted")} value={accepted} icon={<CheckCircle2 className="h-5 w-5" />} color="emerald" />
        </ClickableStatCard>
        <ClickableStatCard active={statusFilter === "REJECTED"} onClick={() => setStatusFilterAndReset("REJECTED")}>
          <SummaryStatCard label={t("submissions.rejected")} value={rejected} icon={<XCircle className="h-5 w-5" />} color="red" />
        </ClickableStatCard>
        <ClickableStatCard active={quickFilter === "needs_action"} onClick={() => setQuickFilterAndReset("needs_action")}>
          <SummaryStatCard label={t("submissions.needsAction")} value={needsActionCount} icon={<AlertCircle className="h-5 w-5" />} color="amber" />
        </ClickableStatCard>
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
        {advisorStalledCount > 0 && (
          <button
            type="button"
            onClick={() => setQuickFilterAndReset("advisor_stalled")}
            className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-chip px-3 py-1.5 text-xs font-medium transition-all duration-150 ${
              quickFilter === "advisor_stalled"
                ? "bg-amber-500 text-white shadow-sm"
                : "bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100"
            }`}
            title={t("submissions.advisorStalled")}
          >
            <Clock className="h-3 w-3" />
            {t("submissions.advisorStalled")}
            <span className={`text-[10px] rounded-full px-1.5 py-0.5 font-bold ${
              quickFilter === "advisor_stalled" ? "bg-white/20 text-white" : "bg-amber-200/70 text-amber-800"
            }`}>{advisorStalledCount}</span>
          </button>
        )}
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
                      const isExpanded = expandedId === sub.id;
                      const userIsReviewerOnThisPaper = Boolean(
                        currentUserId &&
                          sub.reviewAssignments?.some(
                            (a) => a.reviewer?.id === currentUserId && a.status !== "DECLINED"
                          )
                      );
                      const progressAssignments: ProgressAssignment[] =
                        (sub.reviewAssignments || [])
                          .filter((a): a is SubmissionAssignment & { reviewer: NonNullable<SubmissionAssignment["reviewer"]> } => Boolean(a.reviewer))
                          .map((a) => ({ id: a.id, status: a.status, reviewer: a.reviewer }));
                      return (
                        <Fragment key={sub.id}>
                        <tr className={`border-t border-border/40 transition-colors group ${selectedIds.has(sub.id) ? "bg-brand-50/40" : isExpanded ? "bg-brand-50/30" : "hover:bg-surface-1"}`}>
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
                            <div className="flex items-start gap-2">
                              <Link href={`/submissions/${sub.id}`} className="group/link block min-w-0 flex-1">
                                <p
                                  className="font-medium text-ink leading-snug line-clamp-2 group-hover/link:text-brand-600 transition-colors"
                                  title={sub.abstract || undefined}
                                >
                                  {sub.title}
                                  {userIsReviewerOnThisPaper && (
                                    <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-brand-100 px-2 py-0.5 align-middle text-[10px] font-semibold uppercase tracking-wider text-brand-700">
                                      {t("reviews.youAreReviewer")}
                                    </span>
                                  )}
                                </p>
                                <p className="mt-0.5 text-[11px] text-ink-muted">
                                  {displayNameTh(sub.author)} · {formatDate(sub.createdAt, locale)}
                                  <span className="mx-1 text-ink-muted/60">·</span>
                                  <span className={daysSince(sub.createdAt) >= 14 ? "text-amber-600 font-medium" : ""}>
                                    {t("submissions.ageDays", { n: daysSince(sub.createdAt) })}
                                  </span>
                                </p>
                              </Link>
                              {sub.manuscriptFile && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setPreviewFor({
                                      submissionId: sub.id,
                                      fileId: sub.manuscriptFile!.id,
                                      fileName: sub.manuscriptFile!.originalName,
                                      mimeType: sub.manuscriptFile!.mimeType,
                                    });
                                  }}
                                  className="shrink-0 text-ink-muted hover:text-brand-600 transition-colors"
                                  title={t("submissions.previewPdf")}
                                  aria-label={t("submissions.previewPdf")}
                                >
                                  <Eye className="h-4 w-4" />
                                </button>
                              )}
                            </div>
                          </td>
                          {/* track */}
                          <td className="px-4 py-3">
                            {sub.track ? <Badge tone="info">{sub.track.name}</Badge> : <span className="text-ink-muted text-xs">—</span>}
                          </td>
                          {/* reviews — avatar stack + progress bar for chairs who can see reviewers */}
                          <td className="px-4 py-3">
                            {isAdmin && progressAssignments.length > 0 ? (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setExpandedId((prev) => (prev === sub.id ? null : sub.id));
                                }}
                                className="w-full rounded-md px-2 py-1 text-left transition-colors hover:bg-surface-alt"
                                title={isExpanded ? t("common.collapse") : t("common.expand")}
                              >
                                <ReviewProgressMini
                                  assignments={progressAssignments}
                                  currentUserId={currentUserId}
                                />
                              </button>
                            ) : totalAssign > 0 ? (
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
                            ) : isAdmin ? (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setExpandedId((prev) => (prev === sub.id ? null : sub.id));
                                }}
                                className="text-xs font-medium text-brand-600 hover:underline"
                              >
                                {t("reviews.assignReviewer")}
                              </button>
                            ) : (
                              <span className="text-ink-muted text-xs">—</span>
                            )}
                          </td>
                          {/* status + advisor stacked */}
                          <td className="px-4 py-3">
                            <Badge tone={SUBMISSION_STATUS_COLORS[sub.status] || "neutral"}>
                              {statusLabels[sub.status] || sub.status}
                            </Badge>
                            {(sub.advisorName || sub.advisorEmail) && (
                              <AdvisorCell
                                sub={sub}
                                copied={copiedEmail === sub.advisorEmail}
                                onCopy={() => sub.advisorEmail && copyEmail(sub.advisorEmail)}
                                onResend={() => handleResendAdvisor(sub.id)}
                                resending={resendingId === sub.id}
                                labels={{
                                  copyEmail: t("submissions.copyEmail"),
                                  copied: t("submissions.copied"),
                                  resend: t("submissions.resendAdvisor"),
                                  daysAgo: (n: number) => t("submissions.daysAgo", { n }),
                                }}
                              />
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
                        {isExpanded && isAdmin && (
                          <tr className="border-t border-border/20 bg-brand-50/10">
                            <td colSpan={7} className="px-6 py-4">
                              <div className="max-w-3xl">
                                <AssignmentPanel
                                  submissionId={sub.id}
                                  assignments={(sub.reviewAssignments || [])
                                    .filter((a): a is SubmissionAssignment & { reviewer: NonNullable<SubmissionAssignment["reviewer"]>; assignedAt: string } => Boolean(a.reviewer && a.assignedAt))
                                    .map((a) => ({
                                      id: a.id,
                                      status: a.status,
                                      assignedAt: a.assignedAt,
                                      dueDate: a.dueDate ?? null,
                                      reviewer: a.reviewer,
                                    }))}
                                  reviewers={reviewerPool}
                                  currentUserId={currentUserId}
                                  trackId={sub.track?.id ?? null}
                                  canAssignSelf={isAdmin}
                                  onMessage={(msg) => { setMessage(msg); setMessageTone("success"); }}
                                />
                              </div>
                            </td>
                          </tr>
                        )}
                        </Fragment>
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

      {previewFor && (
        <PdfPreviewModal
          open={!!previewFor}
          submissionId={previewFor.submissionId}
          fileId={previewFor.fileId}
          fileName={previewFor.fileName}
          mimeType={previewFor.mimeType}
          onClose={() => setPreviewFor(null)}
        />
      )}
    </div>
  );
}

function AdvisorCell({
  sub, copied, onCopy, onResend, resending, labels,
}: {
  sub: SubmissionData;
  copied: boolean;
  onCopy: () => void;
  onResend: () => void;
  resending: boolean;
  labels: { copyEmail: string; copied: string; resend: string; daysAgo: (n: number) => string };
}) {
  const canResend = sub.status === "ADVISOR_APPROVAL_PENDING" && sub.advisorApprovalStatus === "PENDING" && !!sub.advisorEmail;
  const pendingDays = sub.submittedAt && sub.advisorApprovalStatus === "PENDING" ? daysSince(sub.submittedAt) : null;
  const stalled = pendingDays !== null && pendingDays >= 7;
  const StatusIcon =
    sub.advisorApprovalStatus === "APPROVED" ? <CheckCircle2 className="h-3 w-3 text-emerald-500" /> :
    sub.advisorApprovalStatus === "REJECTED" ? <XCircle className="h-3 w-3 text-red-500" /> :
    <Clock className={`h-3 w-3 ${stalled ? "text-amber-600" : "text-amber-400"}`} />;

  return (
    <div className="mt-1 space-y-0.5 text-[11px]">
      <div className="inline-flex items-center gap-1 text-ink-muted">
        {StatusIcon}
        <span className={stalled ? "font-medium text-amber-700" : ""}>{truncate(sub.advisorName || "—", 22)}</span>
        {pendingDays !== null && (
          <span className={stalled ? "text-amber-700" : "text-ink-muted/70"}>
            · {labels.daysAgo(pendingDays)}
          </span>
        )}
      </div>
      {sub.advisorEmail && (
        <div className="flex items-center gap-1">
          <span className="truncate max-w-[160px] font-mono text-[10px] text-ink-muted/90" title={sub.advisorEmail}>
            {sub.advisorEmail}
          </span>
          <button
            type="button"
            onClick={onCopy}
            className="text-ink-muted hover:text-ink transition-colors"
            title={labels.copyEmail}
            aria-label={labels.copyEmail}
          >
            {copied ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
          </button>
          {canResend && (
            <button
              type="button"
              onClick={onResend}
              disabled={resending}
              className="inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-medium text-amber-700 hover:bg-amber-50 disabled:opacity-50 transition-colors"
              title={labels.resend}
            >
              <Send className="h-2.5 w-2.5" />
              {resending ? "…" : labels.resend}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function ClickableStatCard({ children, onClick, active }: { children: React.ReactNode; onClick: () => void; active?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-left rounded-xl transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 ${
        active ? "ring-2 ring-brand-500 ring-offset-1" : "hover:brightness-[1.03]"
      }`}
    >
      {children}
    </button>
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
