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
import { TrackFilter } from "@/components/track-filter";
import { ASSIGNMENT_STATUS_LABELS } from "@/lib/labels";
import { formatDate } from "@/lib/utils";
import {
  ClipboardCheck, ChevronUp, ChevronDown, ChevronRight,
  ArrowUpDown, ExternalLink, Clock, AlertTriangle, Users,
  UserPlus, Trash2, Search, X, CheckCircle2, CircleDot,
  Timer, XCircle, BarChart3,
} from "lucide-react";
import { useSession } from "@/lib/auth-client";

const STATUS_COLORS: Record<string, "neutral" | "success" | "warning" | "danger" | "info"> = {
  PENDING: "warning", ACCEPTED: "info", DECLINED: "neutral", COMPLETED: "success", OVERDUE: "danger",
};

const STATUS_ICONS: Record<string, typeof Timer> = {
  PENDING: Timer, ACCEPTED: CircleDot, COMPLETED: CheckCircle2, DECLINED: XCircle, OVERDUE: AlertTriangle,
};

interface AssignmentData {
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

interface ReviewerUser {
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

export default function ReviewsPage() {
  const { data: session, isPending: sessionPending } = useSession();
  const role = (session?.user as Record<string, unknown>)?.role as string || "REVIEWER";
  const isAdmin = ["ADMIN", "PROGRAM_CHAIR"].includes(role);

  const [assignments, setAssignments] = useState<AssignmentData[]>([]);
  const [reviewerUsers, setReviewerUsers] = useState<ReviewerUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [trackFilter, setTrackFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  // Assign reviewer form
  const [assigningSubId, setAssigningSubId] = useState<string | null>(null);
  const [selectedReviewerId, setSelectedReviewerId] = useState("");
  const [assignDueDate, setAssignDueDate] = useState("");
  const [assignSaving, setAssignSaving] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const [sortKey, setSortKey] = useState<SortKey>("title");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("asc"); }
  }

  async function reloadAssignments() {
    const d = await fetch("/api/reviews/assignments").then((r) => r.json());
    setAssignments(d.assignments || []);
  }

  // Wait for session before fetching — prevents double-fetch when isAdmin changes
  useEffect(() => {
    if (sessionPending) return;
    Promise.all([
      fetch("/api/reviews/assignments").then((r) => r.json()),
      isAdmin ? fetch("/api/users?role=REVIEWER").then((r) => r.json()).catch(() => ({ users: [] })) : Promise.resolve({ users: [] }),
    ]).then(([d, u]) => {
      setAssignments(d.assignments || []);
      setReviewerUsers(u.users || []);
      setLoading(false);
    });
  }, [sessionPending]); // eslint-disable-line react-hooks/exhaustive-deps

  // Due date helpers
  function isDueSoon(dueDate: string | null) {
    if (!dueDate) return false;
    const diff = new Date(dueDate).getTime() - Date.now();
    return diff > 0 && diff < 3 * 24 * 60 * 60 * 1000;
  }
  function isOverdue(dueDate: string | null) {
    if (!dueDate) return false;
    return new Date(dueDate).getTime() < Date.now();
  }

  // Assign reviewer
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
        setMessage("Reviewer assigned successfully");
        setAssigningSubId(null);
        setSelectedReviewerId("");
        setAssignDueDate("");
        await reloadAssignments();
      } else {
        const err = await res.json();
        setMessage(err.error || "An error occurred");
      }
    } catch {}
    setAssignSaving(false);
  }

  // Remove assignment
  async function handleRemove(assignmentId: string) {
    setRemovingId(assignmentId);
    try {
      const res = await fetch(`/api/reviews/assignments/${assignmentId}`, { method: "DELETE" });
      if (res.ok) {
        setMessage("Assignment removed successfully");
        await reloadAssignments();
      }
    } catch {}
    setRemovingId(null);
  }

  // Counts
  const statusCounts: Record<string, number> = {};
  for (const a of assignments) {
    if (trackFilter && a.submission.track?.id !== trackFilter) continue;
    statusCounts[a.status] = (statusCounts[a.status] || 0) + 1;
  }
  const totalAssignments = Object.values(statusCounts).reduce((s, v) => s + v, 0);

  const trackCounts: Record<string, number> = {};
  for (const a of assignments) {
    if (a.submission.track?.id) trackCounts[a.submission.track.id] = (trackCounts[a.submission.track.id] || 0) + 1;
  }

  // Group by submission
  const groupMap = new Map<string, GroupedSubmission>();
  for (const a of assignments) {
    if (trackFilter && a.submission.track?.id !== trackFilter) continue;
    if (statusFilter !== "ALL" && a.status !== statusFilter) continue;
    let group = groupMap.get(a.submission.id);
    if (!group) {
      group = {
        submissionId: a.submission.id, title: a.submission.title, authorName: a.submission.author.name,
        track: a.submission.track, assignments: [], completedCount: 0, totalCount: 0, hasOverdue: false,
      };
      groupMap.set(a.submission.id, group);
    }
    group.assignments.push(a);
    group.totalCount++;
    if (a.status === "COMPLETED") group.completedCount++;
    if (a.status !== "COMPLETED" && a.status !== "DECLINED" && isOverdue(a.dueDate)) group.hasOverdue = true;
  }

  // Apply search
  const groups = [...groupMap.values()]
    .filter((g) => {
      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();
      return g.title.toLowerCase().includes(q) ||
        g.authorName.toLowerCase().includes(q) ||
        g.track?.name.toLowerCase().includes(q) ||
        g.assignments.some((a) => a.reviewer?.name.toLowerCase().includes(q));
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

  if (loading || sessionPending) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-6 w-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // ── Non-admin: simple card list ──
  if (!isAdmin) {
    const myFiltered = assignments.filter((a) => !trackFilter || a.submission.track?.id === trackFilter);
    return (
      <div className="space-y-5">
        <SectionTitle title="My Review Tasks" subtitle={`${myFiltered.length} items`} />
        <TrackFilter value={trackFilter} onChange={setTrackFilter} counts={trackCounts} />
        {myFiltered.length === 0 ? (
          <EmptyState icon={<ClipboardCheck className="h-12 w-12" />} title="No review tasks" body="You haven't been assigned any reviews yet" />
        ) : (
          <div className="space-y-3">
            {myFiltered.map((a) => (
              <Link key={a.id} href={`/submissions/${a.submission.id}`}>
                <Card hover className="mb-0">
                  <CardBody className="py-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-semibold text-ink truncate">{a.submission.title}</h3>
                        <div className="flex items-center gap-2.5 mt-2 text-xs text-ink-muted flex-wrap">
                          {a.submission.track && <Badge tone="info">{a.submission.track.name}</Badge>}
                          <span>Author: {a.submission.author.name}</span>
                          {a.dueDate && (
                            <span className={isOverdue(a.dueDate) ? "text-danger font-medium" : isDueSoon(a.dueDate) ? "text-amber-600 font-medium" : ""}>
                              Due {formatDate(a.dueDate)}
                            </span>
                          )}
                        </div>
                      </div>
                      <Badge tone={STATUS_COLORS[a.status] || "neutral"}>{ASSIGNMENT_STATUS_LABELS[a.status] || a.status}</Badge>
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

  // ══════════════════════════════════════════════════════════════
  //  Admin / Program Chair view
  // ══════════════════════════════════════════════════════════════

  const statusTabs = [
    { key: "ALL", label: "All", count: totalAssignments },
    { key: "PENDING", label: "Pending", count: statusCounts.PENDING || 0 },
    { key: "ACCEPTED", label: "In Review", count: statusCounts.ACCEPTED || 0 },
    { key: "COMPLETED", label: "Completed", count: statusCounts.COMPLETED || 0 },
    { key: "OVERDUE", label: "Overdue", count: statusCounts.OVERDUE || 0 },
    { key: "DECLINED", label: "Declined", count: statusCounts.DECLINED || 0 },
  ].filter((t) => t.key === "ALL" || t.count > 0);

  // Reviewers already assigned to the currently-assigning submission
  const assignedReviewerIds = assigningSubId
    ? new Set(assignments.filter((a) => a.submission.id === assigningSubId).map((a) => a.reviewer?.id).filter(Boolean))
    : new Set<string>();

  return (
    <div className="space-y-6">
      <SectionTitle
        title="Review Management"
        subtitle={`${groups.length} submissions · ${totalAssignments} review tasks`}
      />

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <SummaryCard label="Submissions" value={groups.length} icon={<ClipboardCheck className="h-5 w-5" />} color="blue" />
        <SummaryCard label="Total Reviews" value={totalAssignments} icon={<Users className="h-5 w-5" />} color="indigo" />
        <SummaryCard label="In Progress" value={statusCounts.ACCEPTED || 0} icon={<CircleDot className="h-5 w-5" />} color="violet" />
        <SummaryCard label="Completed" value={statusCounts.COMPLETED || 0} icon={<CheckCircle2 className="h-5 w-5" />} color="emerald" />
        <SummaryCard label="Overdue" value={statusCounts.OVERDUE || 0} icon={<AlertTriangle className="h-5 w-5" />} color="red" />
      </div>

      <TrackFilter value={trackFilter} onChange={setTrackFilter} counts={trackCounts} />

      {message && (
        <Alert tone="info" className="animate-fade-in">
          {message}
          <button onClick={() => setMessage("")} className="ml-2 opacity-60 hover:opacity-100"><X className="h-3.5 w-3.5 inline" /></button>
        </Alert>
      )}

      {/* Search + Status filter */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-muted pointer-events-none" />
          <input
            type="text"
            placeholder="Search submissions, authors, reviewers..."
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
        <div className="flex gap-1 overflow-x-auto">
          {statusTabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setStatusFilter(tab.key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full transition-all duration-150 whitespace-nowrap ${
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

      {/* Table */}
      {groups.length === 0 ? (
        <EmptyState
          icon={<ClipboardCheck className="h-12 w-12" />}
          title={searchQuery ? `No results for "${searchQuery}"` : statusFilter !== "ALL" ? `No ${statusTabs.find(t => t.key === statusFilter)?.label || statusFilter} reviews` : "No review assignments yet"}
        />
      ) : (
        <Card>
          <CardBody className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50/80 border-b border-border/60">
                    <th className="w-10" />
                    <SortTh label="Submission" sortKey_="title" currentKey={sortKey} dir={sortDir} onSort={toggleSort} className="w-[35%] pl-1" />
                    <SortTh label="Author" sortKey_="author" currentKey={sortKey} dir={sortDir} onSort={toggleSort} />
                    <SortTh label="Track" sortKey_="track" currentKey={sortKey} dir={sortDir} onSort={toggleSort} />
                    <SortTh label="Reviewers" sortKey_="reviewers" currentKey={sortKey} dir={sortDir} onSort={toggleSort} align="center" />
                    <SortTh label="Progress" sortKey_="progress" currentKey={sortKey} dir={sortDir} onSort={toggleSort} className="w-[160px]" />
                    <th className="w-20 px-3 py-3 text-xs font-semibold text-ink-muted uppercase tracking-wider text-center">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {groups.map((g) => {
                    const isExpanded = expandedId === g.submissionId;
                    const pct = g.totalCount > 0 ? Math.round((g.completedCount / g.totalCount) * 100) : 0;
                    const isAssigning = assigningSubId === g.submissionId;

                    return (
                      <Fragment key={g.submissionId}>
                        {/* ── Submission row ── */}
                        <tr
                          className={`border-t border-border/40 hover:bg-blue-50/30 transition-colors cursor-pointer ${g.hasOverdue ? "bg-red-50/20" : ""} ${isExpanded ? "bg-blue-50/40" : ""}`}
                          onClick={() => { setExpandedId(isExpanded ? null : g.submissionId); setAssigningSubId(null); }}
                        >
                          <td className="pl-4 py-3.5">
                            <div className={`w-6 h-6 rounded-md flex items-center justify-center transition-all duration-200 ${isExpanded ? "bg-brand-500 text-white" : "bg-gray-100 text-ink-muted"}`}>
                              <ChevronRight className={`h-3.5 w-3.5 transition-transform duration-200 ${isExpanded ? "rotate-90" : ""}`} />
                            </div>
                          </td>
                          <td className="pl-1 pr-2 py-3.5">
                            <p className="font-medium text-ink leading-snug line-clamp-2">{g.title}</p>
                          </td>
                          <td className="px-4 py-3.5 text-xs text-ink-light whitespace-nowrap">{g.authorName}</td>
                          <td className="px-4 py-3.5">
                            {g.track ? <Badge tone="info">{g.track.name}</Badge> : <span className="text-ink-muted text-xs">—</span>}
                          </td>
                          <td className="px-4 py-3.5 text-center">
                            {/* Reviewer avatar stack */}
                            <div className="flex items-center justify-center">
                              <div className="flex -space-x-1.5">
                                {g.assignments.slice(0, 3).map((a) => {
                                  const StatusIcon = STATUS_ICONS[a.status] || CircleDot;
                                  return (
                                    <div key={a.id} className="relative" title={`${a.reviewer?.name || "?"} - ${ASSIGNMENT_STATUS_LABELS[a.status] || a.status}`}>
                                      <div className={`w-7 h-7 rounded-full border-2 border-white flex items-center justify-center text-[10px] font-bold ${
                                        a.status === "COMPLETED" ? "bg-emerald-100 text-emerald-700" :
                                        a.status === "OVERDUE" ? "bg-red-100 text-red-700" :
                                        a.status === "ACCEPTED" ? "bg-blue-100 text-blue-700" :
                                        a.status === "DECLINED" ? "bg-gray-100 text-gray-500" :
                                        "bg-amber-100 text-amber-700"
                                      }`}>
                                        {a.reviewer?.name?.[0]?.toUpperCase() || "?"}
                                      </div>
                                    </div>
                                  );
                                })}
                                {g.assignments.length > 3 && (
                                  <div className="w-7 h-7 rounded-full border-2 border-white bg-gray-100 flex items-center justify-center text-[10px] font-bold text-gray-500">
                                    +{g.assignments.length - 3}
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3.5">
                            <div className="flex items-center gap-2.5">
                              <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                                <div className={`h-full rounded-full transition-all ${pct === 100 ? "bg-emerald-500" : g.hasOverdue ? "bg-red-400" : "bg-blue-500"}`} style={{ width: `${pct}%` }} />
                              </div>
                              <span className={`text-xs font-medium w-14 text-right ${pct === 100 ? "text-emerald-600" : g.hasOverdue ? "text-red-500" : "text-ink-muted"}`}>
                                {g.completedCount}/{g.totalCount}
                              </span>
                            </div>
                          </td>
                          <td className="px-3 py-3.5 text-center">
                            <div className="flex items-center justify-center gap-1" onClick={(e) => e.stopPropagation()}>
                              <button
                                onClick={() => { setAssigningSubId(isAssigning ? null : g.submissionId); setExpandedId(g.submissionId); setSelectedReviewerId(""); setAssignDueDate(""); }}
                                className={`p-1.5 rounded-lg transition-colors ${isAssigning ? "bg-brand-100 text-brand-600" : "text-ink-muted hover:text-brand-600 hover:bg-brand-50"}`}
                                title="Assign reviewer"
                              >
                                <UserPlus className="h-4 w-4" />
                              </button>
                              <Link href={`/submissions/${g.submissionId}`} className="p-1.5 rounded-lg text-ink-muted hover:text-ink hover:bg-surface-hover transition-colors">
                                <ExternalLink className="h-4 w-4" />
                              </Link>
                            </div>
                          </td>
                        </tr>

                        {/* ── Expanded: reviewer list ── */}
                        {isExpanded && (
                          <>
                            {g.assignments.map((a) => {
                              const overdue = a.status !== "COMPLETED" && a.status !== "DECLINED" && isOverdue(a.dueDate);
                              const dueSoon = !overdue && a.status !== "COMPLETED" && a.status !== "DECLINED" && isDueSoon(a.dueDate);
                              const StatusIcon = STATUS_ICONS[a.status] || CircleDot;
                              return (
                                <tr key={a.id} className="bg-gray-50/60 border-t border-border/20 hover:bg-gray-100/50 transition-colors">
                                  <td />
                                  <td colSpan={2} className="px-2 py-2.5">
                                    <div className="flex items-center gap-3 pl-4">
                                      <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                                        a.status === "COMPLETED" ? "bg-emerald-100" :
                                        a.status === "OVERDUE" ? "bg-red-100" :
                                        a.status === "ACCEPTED" ? "bg-blue-100" :
                                        a.status === "DECLINED" ? "bg-gray-100" :
                                        "bg-amber-100"
                                      }`}>
                                        <span className={`text-xs font-bold ${
                                          a.status === "COMPLETED" ? "text-emerald-700" :
                                          a.status === "OVERDUE" ? "text-red-700" :
                                          a.status === "ACCEPTED" ? "text-blue-700" :
                                          a.status === "DECLINED" ? "text-gray-500" :
                                          "text-amber-700"
                                        }`}>{a.reviewer?.name?.[0]?.toUpperCase() || "?"}</span>
                                      </div>
                                      <div className="min-w-0 flex-1">
                                        <p className="text-sm font-medium text-ink">{a.reviewer?.name || "—"}</p>
                                        <p className="text-[11px] text-ink-muted">Assigned {formatDate(a.assignedAt)}</p>
                                      </div>
                                    </div>
                                  </td>
                                  <td className="px-4 py-2.5">
                                    <Badge tone={STATUS_COLORS[a.status] || "neutral"} dot>
                                      {ASSIGNMENT_STATUS_LABELS[a.status] || a.status}
                                    </Badge>
                                  </td>
                                  <td className="px-4 py-2.5 text-center">
                                    {a.dueDate ? (
                                      <span className={`inline-flex items-center gap-1 text-xs ${overdue ? "text-red-600 font-medium" : dueSoon ? "text-amber-600 font-medium" : "text-ink-muted"}`}>
                                        {overdue && <AlertTriangle className="h-3 w-3" />}
                                        {dueSoon && <Clock className="h-3 w-3" />}
                                        {formatDate(a.dueDate)}
                                      </span>
                                    ) : <span className="text-ink-muted text-xs">No deadline</span>}
                                  </td>
                                  <td />
                                  <td className="px-3 py-2.5 text-center">
                                    {a.status !== "COMPLETED" && (
                                      <button
                                        onClick={() => handleRemove(a.id)}
                                        disabled={removingId === a.id}
                                        className="p-1.5 rounded-lg text-ink-muted hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-50"
                                        title="Remove assignment"
                                      >
                                        <Trash2 className="h-3.5 w-3.5" />
                                      </button>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}

                            {/* ── Add reviewer row ── */}
                            {isAssigning && (
                              <tr className="bg-brand-50/40 border-t border-brand-200/40">
                                <td />
                                <td colSpan={6} className="px-6 py-3">
                                  <div className="flex items-end gap-3 max-w-2xl">
                                    <Field label="Reviewer" className="flex-1">
                                      <Select value={selectedReviewerId} onChange={(e) => setSelectedReviewerId(e.target.value)}>
                                        <option value="">-- Select Reviewer --</option>
                                        {reviewerUsers
                                          .filter((u) => !assignedReviewerIds.has(u.id))
                                          .map((u) => (
                                            <option key={u.id} value={u.id}>{u.name} ({u.email})</option>
                                          ))}
                                      </Select>
                                    </Field>
                                    <Field label="Due Date" className="w-44">
                                      <Input type="date" value={assignDueDate} onChange={(e) => setAssignDueDate(e.target.value)} />
                                    </Field>
                                    <div className="flex gap-1.5 pb-0.5">
                                      <Button size="sm" onClick={() => handleAssign(g.submissionId)} loading={assignSaving} disabled={!selectedReviewerId}>Assign</Button>
                                      <Button size="sm" variant="ghost" onClick={() => setAssigningSubId(null)}>Cancel</Button>
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
      )}

      {/* Results count */}
      {groups.length > 0 && (
        <p className="text-xs text-ink-muted text-center">
          Showing {groups.length} submission{groups.length !== 1 ? "s" : ""}{searchQuery ? ` matching "${searchQuery}"` : ""}
        </p>
      )}
    </div>
  );
}

/* ── Summary Card ── */
function SummaryCard({ label, value, icon, color }: { label: string; value: number; icon: React.ReactNode; color: string }) {
  const styles: Record<string, { card: string; text: string; icon: string }> = {
    blue:    { card: "from-blue-50 to-indigo-50 border-blue-100", text: "text-blue-700", icon: "text-blue-400" },
    indigo:  { card: "from-indigo-50 to-violet-50 border-indigo-100", text: "text-indigo-700", icon: "text-indigo-400" },
    violet:  { card: "from-violet-50 to-purple-50 border-violet-100", text: "text-violet-700", icon: "text-violet-400" },
    emerald: { card: "from-emerald-50 to-green-50 border-emerald-100", text: "text-emerald-700", icon: "text-emerald-400" },
    red:     { card: "from-red-50 to-rose-50 border-red-100", text: "text-red-700", icon: "text-red-400" },
  };
  const s = styles[color] || styles.blue;
  return (
    <div className={`rounded-xl bg-gradient-to-br ${s.card} border px-4 py-3`}>
      <div className="flex items-center justify-between mb-1">
        <p className={`text-2xl font-bold ${s.text}`}>{value}</p>
        <div className={s.icon}>{icon}</div>
      </div>
      <p className={`text-xs font-medium ${s.text} opacity-70`}>{label}</p>
    </div>
  );
}

/* ── Sortable Table Header ── */
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
