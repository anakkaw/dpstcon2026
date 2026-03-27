"use client";

import { useState, useEffect, Fragment } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { Select } from "@/components/ui/select";
import { SectionTitle } from "@/components/ui/section-title";
import { EmptyState } from "@/components/ui/empty-state";
import { Alert } from "@/components/ui/alert";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { SummaryStatCard } from "@/components/ui/summary-stat-card";
import { TrackFilter } from "@/components/track-filter";
import { getAssignmentStatusLabels } from "@/lib/labels";
import { useI18n } from "@/lib/i18n";
import { formatDate } from "@/lib/utils";
import { displayNameTh, nameInitial } from "@/lib/display-name";
import { useDashboardAuth } from "@/components/dashboard-auth-context";
import {
  ClipboardCheck, ChevronUp, ChevronDown, ChevronRight,
  ArrowUpDown, ExternalLink, Clock, AlertTriangle, Users,
  UserPlus, Trash2, Search, X, CheckCircle2, CircleDot,
} from "lucide-react";

const STATUS_COLORS: Record<string, "neutral" | "success" | "warning" | "danger" | "info"> = {
  PENDING: "warning", ACCEPTED: "info", DECLINED: "neutral", COMPLETED: "success", OVERDUE: "danger",
};

export interface AssignmentData {
  id: string;
  status: string;
  assignedAt: string;
  dueDate: string | null;
  submission: {
    id: string;
    title: string;
    status: string;
    author: { id: string; name: string };
    track: { id: string; name: string } | null;
  };
  reviewer: { id: string; name: string } | null;
}

export interface ReviewerUser {
  id: string;
  name: string;
  email: string;
}

interface GroupedSubmission {
  submissionId: string;
  title: string;
  authorName: string;
  track: { id: string; name: string } | null;
  assignments: AssignmentData[];
  completedCount: number;
  totalCount: number;
  hasOverdue: boolean;
}

type SortKey = "title" | "author" | "track" | "reviewers" | "progress";

export function ReviewsPageClient({
  initialAssignments,
  initialReviewerUsers,
}: {
  initialAssignments: AssignmentData[];
  initialReviewerUsers: ReviewerUser[];
}) {
  const { t, locale } = useI18n();
  const assignmentLabels = getAssignmentStatusLabels(t);
  const { roles } = useDashboardAuth();
  const isAdmin = roles.some((role) => ["ADMIN", "PROGRAM_CHAIR"].includes(role));

  const [assignments, setAssignments] = useState<AssignmentData[]>(initialAssignments);
  const [reviewerUsers] = useState<ReviewerUser[]>(initialReviewerUsers);
  const [trackFilter, setTrackFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  const [assigningSubId, setAssigningSubId] = useState<string | null>(null);
  const [selectedReviewerId, setSelectedReviewerId] = useState("");
  const [assignDueDate, setAssignDueDate] = useState("");
  const [assignSaving, setAssignSaving] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [assignmentToRemove, setAssignmentToRemove] = useState<AssignmentData | null>(null);

  const [sortKey, setSortKey] = useState<SortKey>("title");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [now, setNow] = useState(() => Date.now());

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("asc"); }
  }

  async function reloadAssignments() {
    const data = await fetch("/api/reviews/assignments").then((response) => response.json());
    setAssignments(data.assignments || []);
  }

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  function isDueSoon(dueDate: string | null) {
    if (!dueDate) return false;
    const diff = new Date(dueDate).getTime() - now;
    return diff > 0 && diff < 3 * 24 * 60 * 60 * 1000;
  }

  function isOverdue(dueDate: string | null) {
    if (!dueDate) return false;
    return new Date(dueDate).getTime() < now;
  }

  async function handleAssign(submissionId: string) {
    if (!selectedReviewerId) return;
    setAssignSaving(true);
    try {
      const res = await fetch("/api/reviews/assignments/manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          submissionId,
          reviewerId: selectedReviewerId,
          dueDate: assignDueDate || undefined,
        }),
      });
      if (res.ok) {
        setMessage(t("reviews.assignmentAssigned"));
        setAssigningSubId(null);
        setSelectedReviewerId("");
        setAssignDueDate("");
        await reloadAssignments();
      } else {
        const err = await res.json();
        setMessage(err.error || t("reviews.assignFailed"));
      }
    } catch {
      setMessage(t("reviews.assignFailed"));
    }
    setAssignSaving(false);
  }

  async function handleRemove(assignmentId: string) {
    setRemovingId(assignmentId);
    try {
      const res = await fetch(`/api/reviews/assignments/${assignmentId}`, { method: "DELETE" });
      if (res.ok) {
        setMessage(t("reviews.assignmentRemoved"));
        await reloadAssignments();
      } else {
        setMessage(t("reviews.removeFailed"));
      }
    } catch {
      setMessage(t("reviews.removeFailed"));
    }
    setRemovingId(null);
    setAssignmentToRemove(null);
  }

  const statusCounts: Record<string, number> = {};
  for (const assignment of assignments) {
    if (trackFilter && assignment.submission.track?.id !== trackFilter) continue;
    statusCounts[assignment.status] = (statusCounts[assignment.status] || 0) + 1;
  }
  const totalAssignments = Object.values(statusCounts).reduce((sum, count) => sum + count, 0);

  const trackCounts: Record<string, number> = {};
  for (const assignment of assignments) {
    if (assignment.submission.track?.id) {
      trackCounts[assignment.submission.track.id] = (trackCounts[assignment.submission.track.id] || 0) + 1;
    }
  }

  const groupMap = new Map<string, GroupedSubmission>();
  for (const assignment of assignments) {
    if (trackFilter && assignment.submission.track?.id !== trackFilter) continue;
    if (statusFilter !== "ALL" && assignment.status !== statusFilter) continue;
    let group = groupMap.get(assignment.submission.id);
    if (!group) {
      group = {
        submissionId: assignment.submission.id,
        title: assignment.submission.title,
        authorName: displayNameTh(assignment.submission.author),
        track: assignment.submission.track,
        assignments: [],
        completedCount: 0,
        totalCount: 0,
        hasOverdue: false,
      };
      groupMap.set(assignment.submission.id, group);
    }
    group.assignments.push(assignment);
    group.totalCount++;
    if (assignment.status === "COMPLETED") group.completedCount++;
    if (assignment.status !== "COMPLETED" && assignment.status !== "DECLINED" && isOverdue(assignment.dueDate)) {
      group.hasOverdue = true;
    }
  }

  const groups = [...groupMap.values()]
    .filter((group) => {
      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();
      return group.title.toLowerCase().includes(q) ||
        group.authorName.toLowerCase().includes(q) ||
        group.track?.name.toLowerCase().includes(q) ||
        group.assignments.some((assignment) => assignment.reviewer ? displayNameTh(assignment.reviewer).toLowerCase().includes(q) : false);
    })
    .sort((a, b) => {
      const dir = sortDir === "asc" ? 1 : -1;
      switch (sortKey) {
        case "title": return dir * a.title.localeCompare(b.title);
        case "author": return dir * a.authorName.localeCompare(b.authorName);
        case "track": return dir * (a.track?.name || "").localeCompare(b.track?.name || "");
        case "reviewers": return dir * (a.totalCount - b.totalCount);
        case "progress": {
          const pa = a.totalCount > 0 ? a.completedCount / a.totalCount : 0;
          const pb = b.totalCount > 0 ? b.completedCount / b.totalCount : 0;
          return dir * (pa - pb);
        }
        default: return 0;
      }
    });

  if (!isAdmin) {
    const myFiltered = assignments.filter((assignment) => !trackFilter || assignment.submission.track?.id === trackFilter);
    return (
      <div className="space-y-5">
        <SectionTitle
          title={t("reviews.myReviewTasks")}
          subtitle={t("reviews.mySubtitle", { n: myFiltered.length })}
        />
        <TrackFilter value={trackFilter} onChange={setTrackFilter} counts={trackCounts} />
        {myFiltered.length === 0 ? (
          <EmptyState icon={<ClipboardCheck className="h-12 w-12" />} title={t("reviews.noReviewTasks")} body={t("reviews.noReviewTasksDesc")} />
        ) : (
          <div className="space-y-3">
            {myFiltered.map((assignment) => (
              <Link key={assignment.id} href={`/submissions/${assignment.submission.id}`}>
                <Card hover className="mb-0">
                  <CardBody className="py-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-semibold text-ink truncate">{assignment.submission.title}</h3>
                        <div className="flex items-center gap-2.5 mt-2 text-xs text-ink-muted flex-wrap">
                          {assignment.submission.track && <Badge tone="info">{assignment.submission.track.name}</Badge>}
                          <span>{t("reviews.author")}: {displayNameTh(assignment.submission.author)}</span>
                          {assignment.dueDate && (
                            <span className={isOverdue(assignment.dueDate) ? "text-danger font-medium" : isDueSoon(assignment.dueDate) ? "text-amber-600 font-medium" : ""}>
                              {t("reviews.due")} {formatDate(assignment.dueDate, locale)}
                            </span>
                          )}
                        </div>
                      </div>
                      <Badge tone={STATUS_COLORS[assignment.status] || "neutral"}>{assignmentLabels[assignment.status] || assignment.status}</Badge>
                    </div>
                  </CardBody>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    );
  }

  const statusTabs = [
    { key: "ALL", label: t("common.all"), count: totalAssignments },
    { key: "PENDING", label: t("reviews.pending"), count: statusCounts.PENDING || 0 },
    { key: "ACCEPTED", label: t("reviews.inReview"), count: statusCounts.ACCEPTED || 0 },
    { key: "COMPLETED", label: t("reviews.completed"), count: statusCounts.COMPLETED || 0 },
    { key: "OVERDUE", label: t("reviews.overdue"), count: statusCounts.OVERDUE || 0 },
    { key: "DECLINED", label: t("reviews.declined"), count: statusCounts.DECLINED || 0 },
  ].filter((tab) => tab.key === "ALL" || tab.count > 0);

  const assignedReviewerIds = assigningSubId
    ? new Set(assignments.filter((assignment) => assignment.submission.id === assigningSubId).map((assignment) => assignment.reviewer?.id).filter(Boolean))
    : new Set<string>();

  return (
    <div className="space-y-6">
      <SectionTitle
        title={t("reviews.management")}
        subtitle={t("reviews.summary", { submissions: groups.length, assignments: totalAssignments })}
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <SummaryStatCard label={t("reviews.submissions")} value={groups.length} icon={<ClipboardCheck className="h-5 w-5" />} color="blue" />
        <SummaryStatCard label={t("reviews.totalReviews")} value={totalAssignments} icon={<Users className="h-5 w-5" />} color="indigo" />
        <SummaryStatCard label={t("reviews.inProgress")} value={statusCounts.ACCEPTED || 0} icon={<CircleDot className="h-5 w-5" />} color="violet" />
        <SummaryStatCard label={t("reviews.completed")} value={statusCounts.COMPLETED || 0} icon={<CheckCircle2 className="h-5 w-5" />} color="emerald" />
        <SummaryStatCard label={t("reviews.overdue")} value={statusCounts.OVERDUE || 0} icon={<AlertTriangle className="h-5 w-5" />} color="red" />
      </div>

      <TrackFilter value={trackFilter} onChange={setTrackFilter} counts={trackCounts} />

      {message && (
        <Alert tone="info" className="animate-fade-in">
          {message}
          <button onClick={() => setMessage("")} className="ml-2 opacity-60 hover:opacity-100"><X className="h-3.5 w-3.5 inline" /></button>
        </Alert>
      )}

      <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
        <div className="relative w-full lg:max-w-xl xl:max-w-2xl">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-muted pointer-events-none" />
          <input
            type="text"
            placeholder={t("reviews.searchPlaceholder")}
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
        <div className="flex w-full gap-1 overflow-x-auto pb-1 lg:flex-wrap">
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

      {groups.length === 0 ? (
        <EmptyState
          icon={<ClipboardCheck className="h-12 w-12" />}
          title={
            searchQuery
              ? t("reviews.noResults")
              : statusFilter !== "ALL"
                ? t("reviews.noStatusItems", {
                    status: statusTabs.find((tab) => tab.key === statusFilter)?.label || statusFilter,
                  })
                : t("reviews.noReviewsYet")
          }
        />
      ) : (
        <>
          <div className="space-y-3 lg:hidden">
            {groups.map((group) => {
              const isExpanded = expandedId === group.submissionId;
              const pct = group.totalCount > 0 ? Math.round((group.completedCount / group.totalCount) * 100) : 0;
              const isAssigning = assigningSubId === group.submissionId;

              return (
                <Card key={group.submissionId}>
                  <CardBody className="space-y-4">
                    <div className="flex items-start justify-between gap-3">
                      <button
                        className="min-w-0 flex-1 text-left"
                        onClick={() => {
                          setExpandedId(isExpanded ? null : group.submissionId);
                          setAssigningSubId(null);
                        }}
                      >
                        <p className="text-base font-semibold leading-snug text-ink">{group.title}</p>
                        <p className="mt-1 text-sm text-ink-muted">{group.authorName}</p>
                      </button>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => {
                          setExpandedId(isExpanded ? null : group.submissionId);
                          setAssigningSubId(null);
                        }}
                      >
                        {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      </Button>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {group.track && <Badge tone="info">{group.track.name}</Badge>}
                      {group.hasOverdue && <Badge tone="danger">{t("reviews.overdue")}</Badge>}
                    </div>

                    <div className="rounded-xl bg-surface-alt p-3">
                      <div className="mb-2 flex items-center justify-between text-sm">
                        <span className="text-ink-muted">{t("reviews.progress")}</span>
                        <span className="font-medium text-ink">
                          {group.completedCount}/{group.totalCount}
                        </span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-gray-100">
                        <div
                          className={`h-full rounded-full ${pct === 100 ? "bg-emerald-500" : group.hasOverdue ? "bg-red-400" : "bg-blue-500"}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant={isAssigning ? "secondary" : "outline"}
                        onClick={() => {
                          setAssigningSubId(isAssigning ? null : group.submissionId);
                          setExpandedId(group.submissionId);
                          setSelectedReviewerId("");
                          setAssignDueDate("");
                        }}
                      >
                        <UserPlus className="h-4 w-4" />
                        {t("reviews.assignReviewer")}
                      </Button>
                      <Link href={`/submissions/${group.submissionId}`}>
                        <Button size="sm" variant="secondary">
                          <ExternalLink className="h-4 w-4" />
                          {t("common.viewAll")}
                        </Button>
                      </Link>
                    </div>

                    {isExpanded && (
                      <div className="space-y-3 border-t border-border-light pt-4">
                        {group.assignments.map((assignment) => {
                          const overdue =
                            assignment.status !== "COMPLETED" &&
                            assignment.status !== "DECLINED" &&
                            isOverdue(assignment.dueDate);
                          const dueSoon =
                            !overdue &&
                            assignment.status !== "COMPLETED" &&
                            assignment.status !== "DECLINED" &&
                            isDueSoon(assignment.dueDate);

                          return (
                            <div key={assignment.id} className="rounded-xl bg-surface-alt p-3">
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <p className="text-sm font-medium text-ink">
                                    {assignment.reviewer ? displayNameTh(assignment.reviewer) : "—"}
                                  </p>
                                  <p className="mt-1 text-xs text-ink-muted">
                                    {t("reviews.assigned")} {formatDate(assignment.assignedAt, locale)}
                                  </p>
                                </div>
                                <Badge tone={STATUS_COLORS[assignment.status] || "neutral"} dot>
                                  {assignmentLabels[assignment.status] || assignment.status}
                                </Badge>
                              </div>

                              <div className="mt-3 flex items-center justify-between gap-3">
                                <span className="text-xs text-ink-muted">{t("reviews.dueDate")}</span>
                                <span
                                  className={`text-xs ${overdue ? "font-medium text-red-600" : dueSoon ? "font-medium text-amber-600" : "text-ink-muted"}`}
                                >
                                  {assignment.dueDate ? formatDate(assignment.dueDate, locale) : t("reviews.noDeadline")}
                                </span>
                              </div>

                              {assignment.status !== "COMPLETED" && (
                                <div className="mt-3 flex justify-end">
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => setAssignmentToRemove(assignment)}
                                    disabled={removingId === assignment.id}
                                  >
                                    <Trash2 className="h-4 w-4 text-red-500" />
                                    {t("common.delete")}
                                  </Button>
                                </div>
                              )}
                            </div>
                          );
                        })}

                        {isAssigning && (
                          <div className="rounded-xl border border-brand-200/50 bg-brand-50/40 p-4">
                            <div className="space-y-3">
                              <Field label={t("reviews.reviewers")} className="flex-1">
                                <Select value={selectedReviewerId} onChange={(e) => setSelectedReviewerId(e.target.value)}>
                                  <option value="">{t("reviews.selectReviewer")}</option>
                                  {reviewerUsers
                                    .filter((reviewer) => !assignedReviewerIds.has(reviewer.id))
                                    .map((reviewer) => (
                                      <option key={reviewer.id} value={reviewer.id}>
                                        {displayNameTh(reviewer)} ({reviewer.email})
                                      </option>
                                    ))}
                                </Select>
                              </Field>
                              <Field label={t("reviews.dueDate")}>
                                <Input type="date" value={assignDueDate} onChange={(e) => setAssignDueDate(e.target.value)} />
                              </Field>
                              <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                                <Button size="sm" onClick={() => handleAssign(group.submissionId)} loading={assignSaving} disabled={!selectedReviewerId}>
                                  {t("reviews.assign")}
                                </Button>
                                <Button size="sm" variant="ghost" onClick={() => setAssigningSubId(null)}>
                                  {t("common.cancel")}
                                </Button>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </CardBody>
                </Card>
              );
            })}
          </div>

          <Card className="hidden lg:block">
            <CardBody className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50/80 border-b border-border/60">
                    <th className="w-10" />
                    <SortTh label={t("reviews.submission")} sortKey_="title" currentKey={sortKey} dir={sortDir} onSort={toggleSort} className="w-[35%] pl-1" />
                    <SortTh label={t("reviews.author")} sortKey_="author" currentKey={sortKey} dir={sortDir} onSort={toggleSort} />
                    <SortTh label={t("reviews.track")} sortKey_="track" currentKey={sortKey} dir={sortDir} onSort={toggleSort} />
                    <SortTh label={t("reviews.reviewers")} sortKey_="reviewers" currentKey={sortKey} dir={sortDir} onSort={toggleSort} align="center" />
                    <SortTh label={t("reviews.progress")} sortKey_="progress" currentKey={sortKey} dir={sortDir} onSort={toggleSort} className="w-[160px]" />
                    <th className="w-20 px-3 py-3 text-xs font-semibold text-ink-muted uppercase tracking-wider text-center">{t("reviews.actions")}</th>
                  </tr>
                </thead>
                <tbody>
                  {groups.map((group) => {
                    const isExpanded = expandedId === group.submissionId;
                    const pct = group.totalCount > 0 ? Math.round((group.completedCount / group.totalCount) * 100) : 0;
                    const isAssigning = assigningSubId === group.submissionId;

                    return (
                      <Fragment key={group.submissionId}>
                        <tr
                          className={`border-t border-border/40 hover:bg-blue-50/30 transition-colors cursor-pointer ${group.hasOverdue ? "bg-red-50/20" : ""} ${isExpanded ? "bg-blue-50/40" : ""}`}
                          onClick={() => { setExpandedId(isExpanded ? null : group.submissionId); setAssigningSubId(null); }}
                        >
                          <td className="pl-4 py-3.5">
                            <div className={`w-6 h-6 rounded-md flex items-center justify-center transition-all duration-200 ${isExpanded ? "bg-brand-500 text-white" : "bg-gray-100 text-ink-muted"}`}>
                              <ChevronRight className={`h-3.5 w-3.5 transition-transform duration-200 ${isExpanded ? "rotate-90" : ""}`} />
                            </div>
                          </td>
                          <td className="pl-1 pr-2 py-3.5">
                            <p className="font-medium text-ink leading-snug line-clamp-2">{group.title}</p>
                          </td>
                          <td className="px-4 py-3.5 text-xs text-ink-light whitespace-nowrap">{group.authorName}</td>
                          <td className="px-4 py-3.5">
                            {group.track ? <Badge tone="info">{group.track.name}</Badge> : <span className="text-ink-muted text-xs">—</span>}
                          </td>
                          <td className="px-4 py-3.5 text-center">
                            <div className="flex items-center justify-center">
                              <div className="flex -space-x-1.5">
                                {group.assignments.slice(0, 3).map((assignment) => (
                                  <div key={assignment.id} className="relative" title={`${assignment.reviewer ? displayNameTh(assignment.reviewer) : "?"} - ${assignmentLabels[assignment.status] || assignment.status}`}>
                                    <div className={`w-7 h-7 rounded-full border-2 border-white flex items-center justify-center text-[10px] font-bold ${
                                      assignment.status === "COMPLETED" ? "bg-emerald-100 text-emerald-700" :
                                      assignment.status === "OVERDUE" ? "bg-red-100 text-red-700" :
                                      assignment.status === "ACCEPTED" ? "bg-blue-100 text-blue-700" :
                                      assignment.status === "DECLINED" ? "bg-gray-100 text-gray-500" :
                                      "bg-amber-100 text-amber-700"
                                    }`}>
                                      {assignment.reviewer ? nameInitial(assignment.reviewer) : "?"}
                                    </div>
                                  </div>
                                ))}
                                {group.assignments.length > 3 && (
                                  <div className="w-7 h-7 rounded-full border-2 border-white bg-gray-100 flex items-center justify-center text-[10px] font-bold text-gray-500">
                                    +{group.assignments.length - 3}
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3.5">
                            <div className="flex items-center gap-2.5">
                              <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                                <div className={`h-full rounded-full transition-all ${pct === 100 ? "bg-emerald-500" : group.hasOverdue ? "bg-red-400" : "bg-blue-500"}`} style={{ width: `${pct}%` }} />
                              </div>
                              <span className={`text-xs font-medium w-14 text-right ${pct === 100 ? "text-emerald-600" : group.hasOverdue ? "text-red-500" : "text-ink-muted"}`}>
                                {group.completedCount}/{group.totalCount}
                              </span>
                            </div>
                          </td>
                          <td className="px-3 py-3.5 text-center">
                            <div className="flex items-center justify-center gap-1" onClick={(e) => e.stopPropagation()}>
                              <button
                                onClick={() => { setAssigningSubId(isAssigning ? null : group.submissionId); setExpandedId(group.submissionId); setSelectedReviewerId(""); setAssignDueDate(""); }}
                                className={`p-1.5 rounded-lg transition-colors ${isAssigning ? "bg-brand-100 text-brand-600" : "text-ink-muted hover:text-brand-600 hover:bg-brand-50"}`}
                                title={t("reviews.assignReviewer")}
                              >
                                <UserPlus className="h-4 w-4" />
                              </button>
                              <Link href={`/submissions/${group.submissionId}`} className="p-1.5 rounded-lg text-ink-muted hover:text-ink hover:bg-surface-hover transition-colors">
                                <ExternalLink className="h-4 w-4" />
                              </Link>
                            </div>
                          </td>
                        </tr>

                        {isExpanded && (
                          <>
                            {group.assignments.map((assignment) => {
                              const overdue = assignment.status !== "COMPLETED" && assignment.status !== "DECLINED" && isOverdue(assignment.dueDate);
                              const dueSoon = !overdue && assignment.status !== "COMPLETED" && assignment.status !== "DECLINED" && isDueSoon(assignment.dueDate);
                              return (
                                <tr key={assignment.id} className="bg-gray-50/60 border-t border-border/20 hover:bg-gray-100/50 transition-colors">
                                  <td />
                                  <td colSpan={2} className="px-2 py-2.5">
                                    <div className="flex items-center gap-3 pl-4">
                                      <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                                        assignment.status === "COMPLETED" ? "bg-emerald-100" :
                                        assignment.status === "OVERDUE" ? "bg-red-100" :
                                        assignment.status === "ACCEPTED" ? "bg-blue-100" :
                                        assignment.status === "DECLINED" ? "bg-gray-100" :
                                        "bg-amber-100"
                                      }`}>
                                        <span className={`text-xs font-bold ${
                                          assignment.status === "COMPLETED" ? "text-emerald-700" :
                                          assignment.status === "OVERDUE" ? "text-red-700" :
                                          assignment.status === "ACCEPTED" ? "text-blue-700" :
                                          assignment.status === "DECLINED" ? "text-gray-500" :
                                          "text-amber-700"
                                        }`}>{assignment.reviewer ? nameInitial(assignment.reviewer) : "?"}</span>
                                      </div>
                                      <div className="min-w-0 flex-1">
                                        <p className="text-sm font-medium text-ink">{assignment.reviewer ? displayNameTh(assignment.reviewer) : "—"}</p>
                                        <p className="text-[11px] text-ink-muted">{t("reviews.assigned")} {formatDate(assignment.assignedAt, locale)}</p>
                                      </div>
                                    </div>
                                  </td>
                                  <td className="px-4 py-2.5">
                                    <Badge tone={STATUS_COLORS[assignment.status] || "neutral"} dot>
                                      {assignmentLabels[assignment.status] || assignment.status}
                                    </Badge>
                                  </td>
                                  <td className="px-4 py-2.5 text-center">
                                    {assignment.dueDate ? (
                                      <span className={`inline-flex items-center gap-1 text-xs ${overdue ? "text-red-600 font-medium" : dueSoon ? "text-amber-600 font-medium" : "text-ink-muted"}`}>
                                        {overdue && <AlertTriangle className="h-3 w-3" />}
                                        {dueSoon && <Clock className="h-3 w-3" />}
                                        {formatDate(assignment.dueDate, locale)}
                                      </span>
                                    ) : <span className="text-ink-muted text-xs">{t("reviews.noDeadline")}</span>}
                                  </td>
                                  <td />
                                  <td className="px-3 py-2.5 text-center">
                                    {assignment.status !== "COMPLETED" && (
                                      <button
                                        onClick={() => setAssignmentToRemove(assignment)}
                                        disabled={removingId === assignment.id}
                                        className="p-1.5 rounded-lg text-ink-muted hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-50"
                                        title={t("common.delete")}
                                      >
                                        <Trash2 className="h-3.5 w-3.5" />
                                      </button>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}

                            {isAssigning && (
                              <tr className="bg-brand-50/40 border-t border-brand-200/40">
                                <td />
                                <td colSpan={6} className="px-6 py-3">
                                  <div className="flex items-end gap-3 max-w-2xl">
                                    <Field label={t("reviews.reviewers")} className="flex-1">
                                      <Select value={selectedReviewerId} onChange={(e) => setSelectedReviewerId(e.target.value)}>
                                        <option value="">{t("reviews.selectReviewer")}</option>
                                        {reviewerUsers
                                          .filter((reviewer) => !assignedReviewerIds.has(reviewer.id))
                                          .map((reviewer) => (
                                            <option key={reviewer.id} value={reviewer.id}>{displayNameTh(reviewer)} ({reviewer.email})</option>
                                          ))}
                                      </Select>
                                    </Field>
                                    <Field label={t("reviews.dueDate")} className="w-44">
                                      <Input type="date" value={assignDueDate} onChange={(e) => setAssignDueDate(e.target.value)} />
                                    </Field>
                                    <div className="flex gap-1.5 pb-0.5">
                                      <Button size="sm" onClick={() => handleAssign(group.submissionId)} loading={assignSaving} disabled={!selectedReviewerId}>{t("reviews.assign")}</Button>
                                      <Button size="sm" variant="ghost" onClick={() => setAssigningSubId(null)}>{t("common.cancel")}</Button>
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
            </CardBody>
          </Card>
        </>
      )}

      <ConfirmDialog
        open={Boolean(assignmentToRemove)}
        title={t("reviews.removeAssignmentTitle")}
        description={t("reviews.removeAssignmentDescription", {
          reviewer: assignmentToRemove?.reviewer ? displayNameTh(assignmentToRemove.reviewer) : "—",
        })}
        confirmLabel={t("common.delete")}
        cancelLabel={t("common.cancel")}
        tone="danger"
        loading={Boolean(assignmentToRemove && removingId === assignmentToRemove.id)}
        onCancel={() => {
          if (!removingId) {
            setAssignmentToRemove(null);
          }
        }}
        onConfirm={() => {
          if (assignmentToRemove) {
            void handleRemove(assignmentToRemove.id);
          }
        }}
      />
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
