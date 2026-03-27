"use client";

import { useState, useEffect, Fragment } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { SectionTitle } from "@/components/ui/section-title";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Alert } from "@/components/ui/alert";
import { PageLoading } from "@/components/ui/page-loading";
import { SummaryStatCard } from "@/components/ui/summary-stat-card";
import { formatDateTime, toDateTimeLocalValue } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";
import { Image as ImageIcon, Calendar, Plus, Users, ClipboardList, X, Check, MapPin, ChevronDown, ChevronUp, UserPlus, ArrowUpDown, BarChart3, Download } from "lucide-react";
import { TrackFilter } from "@/components/track-filter";
import { displayNameTh } from "@/lib/display-name";

interface PresentationData {
  id: string;
  type: string;
  status: string;
  scheduledAt: string | null;
  room: string | null;
  duration: number | null;
  submissionId: string;
  submission: { id: string; title: string; author: { id: string; name: string }; track: { id: string; name: string } | null };
}

interface CriterionData {
  id: string;
  name: string;
  description: string | null;
  maxScore: number;
  weight: number;
}

interface CommitteeUser {
  id: string;
  name: string;
  email: string;
}

interface ScoringPresentation {
  id: string;
  type: string;
  status: string;
  submission: {
    id: string;
    title: string;
    author: { name: string };
    track: { id: string; name: string } | null;
  };
  evaluations: {
    id: string;
    scores: Record<string, number> | null;
    comments: string | null;
    judge: { id: string; name: string };
  }[];
}

export default function PosterPresentationPage() {
  const { t } = useI18n();
  const [presentations, setPresentations] = useState<PresentationData[]>([]);
  const [criteria, setCriteria] = useState<CriterionData[]>([]);
  const [committeeUsers, setCommitteeUsers] = useState<CommitteeUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [messageTone, setMessageTone] = useState<"success" | "danger">("success");
  const [activeTab, setActiveTab] = useState<"schedule" | "criteria" | "committee" | "scoring">("schedule");
  const [scoringData, setScoringData] = useState<ScoringPresentation[]>([]);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ scheduledAt: "", room: "", duration: "" });
  const [saving, setSaving] = useState(false);

  const [showAddCriteria, setShowAddCriteria] = useState(false);
  const [criteriaForm, setCriteriaForm] = useState({ name: "", description: "", maxScore: "10", weight: "1" });
  const [addingCriteria, setAddingCriteria] = useState(false);

  const [trackFilter, setTrackFilter] = useState("");

  const [scoringLoaded, setScoringLoaded] = useState(false);

  const [assignPresId, setAssignPresId] = useState<string | null>(null);
  const [selectedJudges, setSelectedJudges] = useState<string[]>([]);
  const [assigningSaving, setAssigningSaving] = useState(false);

  type SortKey = "title" | "author" | "track" | "scheduledAt" | "room" | "duration" | "status";
  const [sortKey, setSortKey] = useState<SortKey>("title");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("asc"); }
  }

  async function reload() {
    const data = await fetch("/api/presentations?type=POSTER").then((r) => r.json());
    setPresentations(data.presentations || []);
  }

  // Load essential data first (3 light queries), defer heavy scoring data
  useEffect(() => {
    Promise.all([
      fetch("/api/presentations?type=POSTER").then((r) => r.json()),
      fetch("/api/presentations/criteria").then((r) => r.json()),
      fetch("/api/users?role=COMMITTEE").then((r) => r.json()).catch(() => ({ users: [] })),
    ]).then(([presData, critData, userData]) => {
      setPresentations(presData.presentations || []);
      setCriteria(critData.criteria || []);
      setCommitteeUsers(userData.users || []);
      setLoading(false);
    });
  }, []);

  const filteredPresentations = presentations.filter((p) => {
    if (trackFilter && p.submission.track?.id !== trackFilter) return false;
    return true;
  });

  const trackCounts: Record<string, number> = {};
  for (const presentation of presentations) {
    if (presentation.submission.track?.id) {
      trackCounts[presentation.submission.track.id] = (trackCounts[presentation.submission.track.id] || 0) + 1;
    }
  }

  const sortedPresentations = [...filteredPresentations].sort((a, b) => {
    const dir = sortDir === "asc" ? 1 : -1;
    switch (sortKey) {
      case "title": return dir * a.submission.title.localeCompare(b.submission.title);
      case "author": return dir * displayNameTh(a.submission.author).localeCompare(displayNameTh(b.submission.author));
      case "track": return dir * (a.submission.track?.name || "").localeCompare(b.submission.track?.name || "");
      case "scheduledAt": return dir * ((a.scheduledAt || "").localeCompare(b.scheduledAt || ""));
      case "room": return dir * ((a.room || "").localeCompare(b.room || ""));
      case "duration": return dir * ((a.duration || 0) - (b.duration || 0));
      case "status": return dir * a.status.localeCompare(b.status);
      default: return 0;
    }
  });

  const scheduledCount = filteredPresentations.filter((p) => p.status === "SCHEDULED").length;
  const pendingCount = filteredPresentations.filter((p) => p.status !== "SCHEDULED").length;

  async function handleSchedule(presId: string) {
    setSaving(true);
    try {
      const payload = {
        scheduledAt: editForm.scheduledAt.trim() || null,
        room: editForm.room.trim() || null,
        duration: editForm.duration.trim() ? Number(editForm.duration) : null,
      };

      const res = await fetch(`/api/presentations/${presId}/schedule`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => null);

      if (res.ok) {
        setMessageTone("success");
        setMessage(t("presentations.scheduleSaved"));
        setEditingId(null);
        await reload();
      } else {
        setMessageTone("danger");
        setMessage(data?.error || t("presentations.scheduleSaveError"));
      }
    } catch {
      setMessageTone("danger");
      setMessage(t("presentations.scheduleSaveError"));
    }
    setSaving(false);
  }

  async function handleAddCriteria() {
    if (!criteriaForm.name.trim()) return;
    setAddingCriteria(true);
    try {
      const res = await fetch("/api/presentations/criteria", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: criteriaForm.name,
          description: criteriaForm.description || undefined,
          maxScore: Number(criteriaForm.maxScore),
          weight: Number(criteriaForm.weight),
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setCriteria([...criteria, data.criterion]);
        setCriteriaForm({ name: "", description: "", maxScore: "10", weight: "1" });
        setShowAddCriteria(false);
        setMessageTone("success");
        setMessage(t("presentations.criteriaSaved"));
      } else {
        setMessageTone("danger");
        setMessage(t("presentations.criteriaSaveError"));
      }
    } catch {
      setMessageTone("danger");
      setMessage(t("presentations.criteriaSaveError"));
    }
    setAddingCriteria(false);
  }

  async function handleAssignCommittee(presId: string) {
    setAssigningSaving(true);
    try {
      const res = await fetch(`/api/presentations/${presId}/committee`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ judgeIds: selectedJudges }),
      });
      if (res.ok) {
        setMessageTone("success");
        setMessage(t("presentations.committeeAssigned"));
        setAssignPresId(null);
        setSelectedJudges([]);
      } else {
        setMessageTone("danger");
        setMessage(t("presentations.committeeAssignError"));
      }
    } catch {
      setMessageTone("danger");
      setMessage(t("presentations.committeeAssignError"));
    }
    setAssigningSaving(false);
  }

  if (loading) {
    return <PageLoading label={t("presentations.loading")} />;
  }

  // Lazy-load scoring data when tab is first activated
  function handleTabChange(tab: typeof activeTab) {
    setActiveTab(tab);
    setMessage("");
    if (tab === "scoring" && !scoringLoaded) {
      setScoringLoaded(true);
      fetch("/api/presentations/scoring-dashboard")
        .then((r) => r.json())
        .then((res) => {
          const all: ScoringPresentation[] = res.presentations || [];
          setScoringData(all.filter((p) => p.type === "POSTER"));
        })
        .catch(() => {});
    }
  }

  const tabs = [
    { key: "schedule" as const, label: t("presentations.schedule"), icon: <Calendar className="h-3.5 w-3.5" /> },
    { key: "criteria" as const, label: t("presentations.criteria"), icon: <ClipboardList className="h-3.5 w-3.5" /> },
    { key: "committee" as const, label: t("presentations.committee"), icon: <Users className="h-3.5 w-3.5" /> },
    { key: "scoring" as const, label: t("presentations.scoring"), icon: <BarChart3 className="h-3.5 w-3.5" /> },
  ];

  const filteredScoring = scoringData.filter((p) => !trackFilter || p.submission.track?.id === trackFilter);

  function avgScore(evaluations: ScoringPresentation["evaluations"]) {
    if (evaluations.length === 0) return null;
    const total = evaluations.reduce((sum, ev) => {
      const scores = ev.scores || {};
      const vals = Object.values(scores);
      if (vals.length === 0) return sum;
      return sum + vals.reduce((s, v) => s + v, 0) / vals.length;
    }, 0);
    return (total / evaluations.length).toFixed(1);
  }

  return (
    <div className="space-y-6">
      <SectionTitle
        title={t("presentations.poster")}
        subtitle={t("presentations.managementSubtitle", { n: filteredPresentations.length })}
      />

      {/* Summary cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <SummaryStatCard label={t("presentations.total")} value={filteredPresentations.length} icon={<ImageIcon className="h-5 w-5" />} color="blue" />
        <SummaryStatCard label={t("presentations.scheduled")} value={scheduledCount} icon={<Check className="h-5 w-5" />} color="emerald" />
        <SummaryStatCard label={t("presentations.pendingSchedule")} value={pendingCount} icon={<Calendar className="h-5 w-5" />} color="amber" />
      </div>

      <TrackFilter value={trackFilter} onChange={setTrackFilter} counts={trackCounts} />

      {message && <Alert tone={messageTone}>{message}</Alert>}

      {/* Tabs */}
      <div className="flex gap-0.5 overflow-x-auto border-b border-border/60">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => handleTabChange(tab.key)}
            className={`flex items-center gap-2 whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium transition-colors duration-150 ${
              activeTab === tab.key
                ? "border-brand-500 text-brand-600"
                : "border-transparent text-ink-muted hover:text-ink hover:border-gray-200"
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* ══════════════════════════════════════════════════════════════
          Tab: Schedule — Table-based view
         ══════════════════════════════════════════════════════════════ */}
      {activeTab === "schedule" && (
        filteredPresentations.length === 0 ? (
          <EmptyState icon={<ImageIcon className="h-12 w-12" />} title={t("presentations.noPresentations")} body={t("presentations.autoCreated")} />
        ) : (
          <>
            <div className="space-y-3 lg:hidden">
              {sortedPresentations.map((p) => (
                <Card key={p.id}>
                  <CardBody className="space-y-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-base font-semibold text-ink">{p.submission.title}</p>
                        <p className="mt-1 text-sm text-ink-muted">{displayNameTh(p.submission.author)}</p>
                      </div>
                      <Badge tone={p.status === "SCHEDULED" ? "success" : "warning"} dot>
                        {p.status === "SCHEDULED" ? t("presentations.statusScheduled") : t("presentations.statusPending")}
                      </Badge>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {p.submission.track && <Badge tone="info">{p.submission.track.name}</Badge>}
                    </div>

                    <div className="grid grid-cols-1 gap-3 rounded-xl bg-surface-alt p-4 text-sm sm:grid-cols-3">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wider text-ink-muted">{t("presentations.dateTime")}</p>
                        <p className="mt-1 text-ink">{p.scheduledAt ? formatDateTime(p.scheduledAt) : "—"}</p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wider text-ink-muted">{t("presentations.room")}</p>
                        <p className="mt-1 text-ink">{p.room || "—"}</p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wider text-ink-muted">{t("presentations.minutes")}</p>
                        <p className="mt-1 text-ink">{p.duration || "—"}</p>
                      </div>
                    </div>

                    {editingId === p.id ? (
                      <div className="space-y-3 rounded-xl border border-brand-200/50 bg-brand-50/40 p-4">
                        <Field label={t("presentations.dateTime")}>
                          <Input type="datetime-local" value={editForm.scheduledAt} onChange={(e) => setEditForm({ ...editForm, scheduledAt: e.target.value })} />
                        </Field>
                        <Field label={t("presentations.room")}>
                          <Input value={editForm.room} onChange={(e) => setEditForm({ ...editForm, room: e.target.value })} placeholder={t("presentations.roomPlaceholder")} />
                        </Field>
                        <Field label={t("presentations.durationMinutes")}>
                          <Input type="number" value={editForm.duration} onChange={(e) => setEditForm({ ...editForm, duration: e.target.value })} placeholder="15" />
                        </Field>
                        <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                          <Button size="sm" onClick={() => handleSchedule(p.id)} loading={saving}><Check className="h-3.5 w-3.5" />{t("common.save")}</Button>
                          <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>{t("common.cancel")}</Button>
                        </div>
                      </div>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setEditingId(p.id);
                          setEditForm({
                            scheduledAt: toDateTimeLocalValue(p.scheduledAt),
                            room: p.room || "",
                            duration: p.duration?.toString() || "",
                          });
                        }}
                      >
                        {p.scheduledAt ? t("presentations.editSchedule") : t("presentations.setSchedule")}
                      </Button>
                    )}
                  </CardBody>
                </Card>
              ))}
            </div>

            <Card className="hidden lg:block">
            <CardBody className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-surface-alt/80 border-b border-border/60">
                      <SortTh label={t("presentations.paper")} sortKey_="title" currentKey={sortKey} dir={sortDir} onSort={toggleSort} className="w-[35%] px-5" />
                      <SortTh label={t("submissions.track")} sortKey_="track" currentKey={sortKey} dir={sortDir} onSort={toggleSort} />
                      <SortTh label={t("presentations.dateTime")} sortKey_="scheduledAt" currentKey={sortKey} dir={sortDir} onSort={toggleSort} />
                      <SortTh label={t("presentations.room")} sortKey_="room" currentKey={sortKey} dir={sortDir} onSort={toggleSort} />
                      <SortTh label={t("presentations.minutes")} sortKey_="duration" currentKey={sortKey} dir={sortDir} onSort={toggleSort} align="center" />
                      <SortTh label={t("presentations.statusCol")} sortKey_="status" currentKey={sortKey} dir={sortDir} onSort={toggleSort} align="center" />
                      <th className="text-right px-5 py-3 text-xs font-semibold text-ink-muted uppercase tracking-wider" />
                    </tr>
                  </thead>
                  <tbody>
                    {sortedPresentations.map((p) => (
                      <Fragment key={p.id}>
                        <tr className="border-t border-border/40 hover:bg-surface-hover/50 transition-colors group">
                          <td className="px-5 py-3.5">
                            <p className="font-medium text-ink leading-snug">{p.submission.title}</p>
                            <p className="text-xs text-ink-muted mt-0.5">{displayNameTh(p.submission.author)}</p>
                          </td>
                          <td className="px-4 py-3.5">
                            {p.submission.track ? <Badge tone="info">{p.submission.track.name}</Badge> : <span className="text-ink-muted text-xs">—</span>}
                          </td>
                          <td className="px-4 py-3.5">
                            {p.scheduledAt ? (
                              <span className="text-ink-light text-xs">{formatDateTime(p.scheduledAt)}</span>
                            ) : (
                              <span className="text-ink-muted text-xs">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3.5">
                            {p.room ? (
                              <span className="inline-flex items-center gap-1 text-xs text-ink-light"><MapPin className="h-3 w-3" />{p.room}</span>
                            ) : (
                              <span className="text-ink-muted text-xs">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3.5 text-center">
                            {p.duration ? <span className="text-xs text-ink-light">{p.duration}</span> : <span className="text-ink-muted text-xs">—</span>}
                          </td>
                          <td className="px-4 py-3.5 text-center">
                            <Badge tone={p.status === "SCHEDULED" ? "success" : "warning"} dot>
                              {p.status === "SCHEDULED" ? t("presentations.statusScheduled") : t("presentations.statusPending")}
                            </Badge>
                          </td>
                          <td className="px-5 py-3.5 text-right">
                            {editingId === p.id ? (
                              <div className="flex gap-1 justify-end">
                                <Button size="sm" onClick={() => handleSchedule(p.id)} loading={saving}><Check className="h-3.5 w-3.5" />{t("common.save")}</Button>
                                <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}><X className="h-3.5 w-3.5" /></Button>
                              </div>
                            ) : (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="opacity-100 transition-opacity lg:opacity-0 lg:group-hover:opacity-100"
                                onClick={() => {
                                  setEditingId(p.id);
                                  setEditForm({
                                    scheduledAt: toDateTimeLocalValue(p.scheduledAt),
                                    room: p.room || "",
                                    duration: p.duration?.toString() || "",
                                  });
                                }}
                              >
                                {p.scheduledAt ? t("presentations.editSchedule") : t("presentations.setSchedule")}
                              </Button>
                            )}
                          </td>
                        </tr>
                        {editingId === p.id && (
                          <tr className="bg-brand-50/40">
                            <td colSpan={7} className="px-5 py-4">
                              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-2xl">
                                <Field label={t("presentations.dateTime")}>
                                  <Input type="datetime-local" value={editForm.scheduledAt} onChange={(e) => setEditForm({ ...editForm, scheduledAt: e.target.value })} />
                                </Field>
                                <Field label={t("presentations.room")}>
                                  <Input value={editForm.room} onChange={(e) => setEditForm({ ...editForm, room: e.target.value })} placeholder={t("presentations.roomPlaceholder")} />
                                </Field>
                                <Field label={t("presentations.durationMinutes")}>
                                  <Input type="number" value={editForm.duration} onChange={(e) => setEditForm({ ...editForm, duration: e.target.value })} placeholder="15" />
                                </Field>
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardBody>
            </Card>
          </>
        )
      )}

      {/* ══════════════════════════════════════════════════════════════
          Tab: Criteria
         ══════════════════════════════════════════════════════════════ */}
      {activeTab === "criteria" && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-ink">{t("presentations.criteriaCount", { n: criteria.length })}</h3>
              <Button size="sm" onClick={() => setShowAddCriteria(!showAddCriteria)}>
                <Plus className="h-3.5 w-3.5" />{showAddCriteria ? t("presentations.hide") : t("presentations.addCriteria")}
              </Button>
            </div>
          </CardHeader>
          <CardBody className="space-y-3">
            {showAddCriteria && (
              <div className="rounded-xl border border-brand-200/60 bg-brand-50/30 p-4 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Field label={t("presentations.criteriaName")} required>
                    <Input value={criteriaForm.name} onChange={(e) => setCriteriaForm({ ...criteriaForm, name: e.target.value })} placeholder={t("presentations.criteriaNamePlaceholder")} />
                  </Field>
                  <Field label={t("presentations.criteriaDesc")}>
                    <Input value={criteriaForm.description} onChange={(e) => setCriteriaForm({ ...criteriaForm, description: e.target.value })} placeholder={t("presentations.criteriaDescPlaceholder")} />
                  </Field>
                  <Field label={t("presentations.maxScore")} hint={t("presentations.defaultMaxScore")}>
                    <Input type="number" value={criteriaForm.maxScore} onChange={(e) => setCriteriaForm({ ...criteriaForm, maxScore: e.target.value })} />
                  </Field>
                  <Field label={t("presentations.weight")} hint={t("presentations.weightDesc")}>
                    <Input type="number" value={criteriaForm.weight} onChange={(e) => setCriteriaForm({ ...criteriaForm, weight: e.target.value })} />
                  </Field>
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="secondary" size="sm" onClick={() => setShowAddCriteria(false)}>{t("common.cancel")}</Button>
                  <Button size="sm" onClick={handleAddCriteria} loading={addingCriteria} disabled={!criteriaForm.name.trim()}>{t("presentations.saveCriteria")}</Button>
                </div>
              </div>
            )}

            {criteria.length === 0 ? (
              <EmptyState icon={<ClipboardList className="h-10 w-10" />} title={t("presentations.noCriteria")} body={t("presentations.noCriteriaDesc")} />
            ) : (
              <>
                <div className="space-y-3 lg:hidden">
                  {criteria.map((c, i) => (
                    <div key={c.id} className="rounded-xl border border-border/60 bg-surface-alt p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
                            {t("presentations.order")} #{i + 1}
                          </p>
                          <p className="mt-1 text-base font-semibold text-ink">{c.name}</p>
                        </div>
                        <Badge tone="info">x{c.weight}</Badge>
                      </div>
                      {c.description && (
                        <p className="mt-3 text-sm leading-relaxed text-ink-muted">{c.description}</p>
                      )}
                      <p className="mt-3 text-sm text-ink">
                        {t("presentations.maxScore")}: <span className="font-semibold">{c.maxScore}</span>
                      </p>
                    </div>
                  ))}
                </div>

                <div className="hidden overflow-x-auto rounded-lg border border-border/60 lg:block">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-surface-alt/80">
                      <th className="text-left px-4 py-2.5 text-xs font-semibold text-ink-muted uppercase tracking-wider">{t("presentations.order")}</th>
                      <th className="text-left px-4 py-2.5 text-xs font-semibold text-ink-muted uppercase tracking-wider">{t("presentations.criteriaName")}</th>
                      <th className="text-left px-4 py-2.5 text-xs font-semibold text-ink-muted uppercase tracking-wider">{t("presentations.criteriaDesc")}</th>
                      <th className="text-center px-4 py-2.5 text-xs font-semibold text-ink-muted uppercase tracking-wider">{t("presentations.maxScore")}</th>
                      <th className="text-center px-4 py-2.5 text-xs font-semibold text-ink-muted uppercase tracking-wider">{t("presentations.weight")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {criteria.map((c, i) => (
                      <tr key={c.id} className="border-t border-border/40 hover:bg-surface-hover/50 transition-colors">
                        <td className="px-4 py-2.5 text-ink-muted">{i + 1}</td>
                        <td className="px-4 py-2.5 font-medium text-ink">{c.name}</td>
                        <td className="px-4 py-2.5 text-ink-light">{c.description || "—"}</td>
                        <td className="px-4 py-2.5 text-center"><Badge>{c.maxScore}</Badge></td>
                        <td className="px-4 py-2.5 text-center"><Badge tone="info">x{c.weight}</Badge></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>
              </>
            )}
          </CardBody>
        </Card>
      )}

      {/* ══════════════════════════════════════════════════════════════
          Tab: Committee — Table with inline assign
         ══════════════════════════════════════════════════════════════ */}
      {activeTab === "committee" && (
        filteredPresentations.length === 0 ? (
          <EmptyState icon={<Users className="h-12 w-12" />} title={t("presentations.noPresentations")} />
        ) : (
          <>
            <div className="space-y-3 lg:hidden">
              {filteredPresentations.map((p) => (
                <Card key={p.id}>
                  <CardBody className="space-y-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-base font-semibold text-ink">{p.submission.title}</p>
                        <p className="mt-1 text-sm text-ink-muted">{displayNameTh(p.submission.author)}</p>
                      </div>
                      {p.submission.track && <Badge tone="info">{p.submission.track.name}</Badge>}
                    </div>

                    <Button
                      size="sm"
                      variant={assignPresId === p.id ? "secondary" : "outline"}
                      onClick={() => {
                        if (assignPresId === p.id) {
                          setAssignPresId(null);
                          setSelectedJudges([]);
                        } else {
                          setAssignPresId(p.id);
                          setSelectedJudges([]);
                        }
                      }}
                    >
                      <UserPlus className="h-3.5 w-3.5" />
                      {assignPresId === p.id ? t("common.cancel") : t("presentations.committee")}
                    </Button>

                    {assignPresId === p.id && (
                      <div className="space-y-3 rounded-xl border border-blue-200/60 bg-blue-50/40 p-4">
                        {committeeUsers.length === 0 ? (
                          <p className="text-xs text-danger">{t("presentations.noCommittee")}</p>
                        ) : (
                          <>
                            <p className="text-xs font-medium text-ink-light">{t("presentations.selectCommittee")}</p>
                            <div className="grid grid-cols-1 gap-2">
                              {committeeUsers.map((u) => {
                                const isSelected = selectedJudges.includes(u.id);
                                return (
                                  <label
                                    key={u.id}
                                    className={`flex items-center gap-2.5 rounded-lg border px-3 py-2.5 transition-all ${
                                      isSelected
                                        ? "border-blue-300 bg-blue-50 shadow-sm"
                                        : "border-transparent bg-white hover:bg-surface-hover"
                                    }`}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={isSelected}
                                      onChange={(e) => {
                                        if (e.target.checked) setSelectedJudges([...selectedJudges, u.id]);
                                        else setSelectedJudges(selectedJudges.filter((id) => id !== u.id));
                                      }}
                                      className="rounded border-border text-brand-500 focus:ring-brand-500"
                                    />
                                    <div className="min-w-0">
                                      <p className="text-sm font-medium text-ink">{displayNameTh(u)}</p>
                                      <p className="text-xs text-ink-muted">{u.email}</p>
                                    </div>
                                  </label>
                                );
                              })}
                            </div>
                            {selectedJudges.length > 0 && (
                              <div className="flex flex-col gap-2 border-t border-blue-200/60 pt-3 sm:flex-row sm:items-center sm:justify-between">
                                <p className="text-xs text-ink-muted">{t("presentations.selectedCount", { n: selectedJudges.length })}</p>
                                <Button size="sm" onClick={() => handleAssignCommittee(p.id)} loading={assigningSaving}>
                                  <Check className="h-3.5 w-3.5" />{t("presentations.appoint")}
                                </Button>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    )}
                  </CardBody>
                </Card>
              ))}
            </div>

            <Card className="hidden lg:block">
            <CardBody className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-surface-alt/80 border-b border-border/60">
                      <th className="text-left px-5 py-3 text-xs font-semibold text-ink-muted uppercase tracking-wider w-[50%]">{t("presentations.paper")}</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-ink-muted uppercase tracking-wider">{t("submissions.track")}</th>
                      <th className="text-right px-5 py-3 text-xs font-semibold text-ink-muted uppercase tracking-wider" />
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPresentations.map((p) => (
                      <Fragment key={p.id}>
                        <tr className="border-t border-border/40 hover:bg-surface-hover/50 transition-colors group">
                          <td className="px-5 py-3.5">
                            <p className="font-medium text-ink leading-snug">{p.submission.title}</p>
                            <p className="text-xs text-ink-muted mt-0.5">{displayNameTh(p.submission.author)}</p>
                          </td>
                          <td className="px-4 py-3.5">
                            {p.submission.track ? <Badge tone="info">{p.submission.track.name}</Badge> : <span className="text-ink-muted text-xs">—</span>}
                          </td>
                          <td className="px-5 py-3.5 text-right">
                            <Button
                              size="sm"
                              variant={assignPresId === p.id ? "secondary" : "outline"}
                              onClick={() => {
                                if (assignPresId === p.id) { setAssignPresId(null); setSelectedJudges([]); }
                                else { setAssignPresId(p.id); setSelectedJudges([]); }
                              }}
                            >
                              <UserPlus className="h-3.5 w-3.5" />
                              {assignPresId === p.id ? t("common.cancel") : t("presentations.committee")}
                            </Button>
                          </td>
                        </tr>
                        {assignPresId === p.id && (
                          <tr className="bg-blue-50/40">
                            <td colSpan={3} className="px-5 py-4">
                              {committeeUsers.length === 0 ? (
                                <p className="text-xs text-danger">{t("presentations.noCommittee")}</p>
                              ) : (
                                <div className="space-y-3">
                                  <p className="text-xs font-medium text-ink-light">{t("presentations.selectCommittee")}</p>
                                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1.5">
                                    {committeeUsers.map((u) => {
                                      const isSelected = selectedJudges.includes(u.id);
                                      return (
                                        <label
                                          key={u.id}
                                          className={`flex items-center gap-2.5 rounded-lg px-3 py-2.5 cursor-pointer transition-all border ${
                                            isSelected
                                              ? "bg-blue-50 border-blue-300 shadow-sm"
                                              : "bg-white border-transparent hover:bg-surface-hover"
                                          }`}
                                        >
                                          <input
                                            type="checkbox"
                                            checked={isSelected}
                                            onChange={(e) => {
                                              if (e.target.checked) setSelectedJudges([...selectedJudges, u.id]);
                                              else setSelectedJudges(selectedJudges.filter((id) => id !== u.id));
                                            }}
                                            className="rounded border-border text-brand-500 focus:ring-brand-500"
                                          />
                                          <div className="min-w-0">
                                            <p className="text-sm font-medium text-ink truncate">{displayNameTh(u)}</p>
                                            <p className="text-xs text-ink-muted truncate">{u.email}</p>
                                          </div>
                                        </label>
                                      );
                                    })}
                                  </div>
                                  {selectedJudges.length > 0 && (
                                    <div className="flex items-center justify-between pt-2 border-t border-blue-200/60">
                                      <p className="text-xs text-ink-muted">{t("presentations.selectedCount", { n: selectedJudges.length })}</p>
                                      <Button size="sm" onClick={() => handleAssignCommittee(p.id)} loading={assigningSaving}>
                                        <Check className="h-3.5 w-3.5" />{t("presentations.appoint")}
                                      </Button>
                                    </div>
                                  )}
                                </div>
                              )}
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardBody>
            </Card>
          </>
        )
      )}
      {/* ══════════════════════════════════════════════════════════════
          Tab: Scoring
         ══════════════════════════════════════════════════════════════ */}
      {activeTab === "scoring" && (
        filteredScoring.length === 0 ? (
          <EmptyState icon={<BarChart3 className="h-12 w-12" />} title={t("presentations.noScoringData")} body={t("presentations.noScoringDataDesc")} />
        ) : (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-ink">{t("presentations.scoringResults", { n: filteredScoring.length })}</h3>
                <a href="/api/exports/proceedings?format=csv" download>
                  <Button variant="outline" size="sm"><Download className="h-3.5 w-3.5" />Export CSV</Button>
                </a>
              </div>
            </CardHeader>
            <CardBody className="p-0">
              <div className="space-y-3 p-5 lg:hidden">
                {filteredScoring.map((p) => {
                  const avg = avgScore(p.evaluations);
                  return (
                    <div key={p.id} className="rounded-xl border border-border/60 bg-surface-alt p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-base font-semibold text-ink">{p.submission.title}</p>
                          <p className="mt-1 text-sm text-ink-muted">{displayNameTh(p.submission.author)}</p>
                        </div>
                        {p.submission.track && <Badge tone="info">{p.submission.track.name}</Badge>}
                      </div>
                      <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wider text-ink-muted">Committee</p>
                          <p className="mt-1 text-ink">{p.evaluations.length}</p>
                        </div>
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wider text-ink-muted">{t("presentations.avgScore")}</p>
                          <p className={`mt-1 font-semibold ${avg ? Number(avg) >= 7 ? "text-green-600" : Number(avg) >= 5 ? "text-yellow-600" : "text-red-600" : "text-ink-muted"}`}>
                            {avg || "—"}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="hidden overflow-x-auto lg:block">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-surface-alt/80 border-b border-border/60">
                      <th className="text-left px-5 py-3 text-xs font-semibold text-ink-muted uppercase tracking-wider w-[35%]">{t("presentations.paper")}</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-ink-muted uppercase tracking-wider">{t("reviews.author")}</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-ink-muted uppercase tracking-wider">{t("submissions.track")}</th>
                      <th className="text-center px-4 py-3 text-xs font-semibold text-ink-muted uppercase tracking-wider">Committee</th>
                      <th className="text-center px-4 py-3 text-xs font-semibold text-ink-muted uppercase tracking-wider">{t("presentations.avgScore")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredScoring.map((p) => {
                      const avg = avgScore(p.evaluations);
                      return (
                        <tr key={p.id} className="border-t border-border/40 hover:bg-surface-hover/50 transition-colors">
                          <td className="px-5 py-3.5 font-medium text-ink">{p.submission.title}</td>
                          <td className="px-4 py-3.5 text-ink-light">{displayNameTh(p.submission.author)}</td>
                          <td className="px-4 py-3.5">
                            {p.submission.track ? <Badge tone="info">{p.submission.track.name}</Badge> : <span className="text-ink-muted">—</span>}
                          </td>
                          <td className="px-4 py-3.5 text-center"><Badge>{p.evaluations.length}</Badge></td>
                          <td className="px-4 py-3.5 text-center">
                            {avg ? (
                              <span className={`font-bold ${Number(avg) >= 7 ? "text-green-600" : Number(avg) >= 5 ? "text-yellow-600" : "text-red-600"}`}>{avg}</span>
                            ) : (
                              <span className="text-ink-muted">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardBody>
          </Card>
        )
      )}
    </div>
  );
}

/* ── Sortable Table Header ── */
function SortTh({ label, sortKey_, currentKey, dir, onSort, align, className }: {
  label: string;
  sortKey_: string;
  currentKey: string;
  dir: "asc" | "desc";
  onSort: (k: never) => void;
  align?: "center" | "left";
  className?: string;
}) {
  const active = currentKey === sortKey_;
  return (
    <th
      className={`${align === "center" ? "text-center" : "text-left"} px-4 py-3 text-xs font-semibold text-ink-muted uppercase tracking-wider cursor-pointer select-none hover:text-ink transition-colors ${className || ""}`}
      onClick={() => onSort(sortKey_ as never)}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {active ? (
          dir === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />
        ) : (
          <ArrowUpDown className="h-3 w-3 opacity-30" />
        )}
      </span>
    </th>
  );
}
