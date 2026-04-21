"use client";

import { Fragment, useState, useMemo, useCallback, memo } from "react";
import Link from "next/link";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { useDashboardAuth } from "@/components/dashboard-auth-context";
import { Image as ImageIcon, Calendar, Users, ClipboardList, X, Check, MapPin, ChevronDown, ChevronUp, UserPlus, ArrowUpDown, BarChart3, Download, Mic, Star } from "lucide-react";
import { TrackFilter } from "@/components/track-filter";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { RubricManager } from "@/components/presentations/rubric-manager";
import { SectionTitle } from "@/components/ui/section-title";
import { SummaryStatCard } from "@/components/ui/summary-stat-card";
import { displayNameTh } from "@/lib/display-name";
import { useI18n } from "@/lib/i18n";
import { formatDateTime, toDateTimeLocalValue } from "@/lib/utils";
import type {
  CommitteeUser,
  CriterionData,
  PresentationData,
  PresentationType,
} from "@/server/presentation-data";

interface ScoringPresentation {
  id: string;
  type: string;
  status: string;
  submission: {
    id: string;
    paperCode?: string | null;
    title: string;
    author: {
      name: string;
      prefixTh?: string | null;
      firstNameTh?: string | null;
      lastNameTh?: string | null;
    };
    track: { id: string; name: string } | null;
  };
  evaluations: {
    id: string;
    scores: Record<string, number> | null;
    comments: string | null;
    judge: { id: string; name: string };
  }[];
}

interface PresentationsClientProps {
  type: PresentationType;
  initialPresentations: PresentationData[];
  initialCriteria: CriterionData[];
  initialCommitteeUsers: CommitteeUser[];
  canManage: boolean;
  canEditCriteria: boolean;
}

export function PresentationsClient({
  type,
  initialPresentations,
  initialCriteria,
  initialCommitteeUsers,
  canManage,
  canEditCriteria,
}: PresentationsClientProps) {
  const { t } = useI18n();
  const { roles } = useDashboardAuth();
  const isCommittee = roles.includes("COMMITTEE");
  const [presentations, setPresentations] = useState(initialPresentations);
  const [criteria, setCriteria] = useState(initialCriteria);
  const [committeeUsers] = useState(initialCommitteeUsers);
  const [message, setMessage] = useState("");
  const [messageTone, setMessageTone] = useState<"success" | "danger">("success");
  const [activeTab, setActiveTab] = useState<"schedule" | "criteria" | "committee" | "scoring">("schedule");
  const [scoringData, setScoringData] = useState<ScoringPresentation[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ scheduledAt: "", room: "", duration: "" });
  const [saving, setSaving] = useState(false);
  const [trackFilter, setTrackFilter] = useState("");
  const [scoringLoaded, setScoringLoaded] = useState(false);
  const [assignPresId, setAssignPresId] = useState<string | null>(null);
  const [selectedJudges, setSelectedJudges] = useState<string[]>([]);
  const [assigningSaving, setAssigningSaving] = useState(false);

  type SortKey = "title" | "author" | "track" | "scheduledAt" | "room" | "duration" | "status";
  const [sortKey, setSortKey] = useState<SortKey>("title");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const title = type === "ORAL" ? t("presentations.oral") : t("presentations.poster");
  const TitleIcon = type === "ORAL" ? Mic : ImageIcon;
  const presentationLabel = (presentation: PresentationData | ScoringPresentation) =>
    `${presentation.submission.paperCode || "NO-CODE"} · ${presentation.submission.title}`;

  const toggleSort = useCallback((key: SortKey) => {
    setSortKey((prev) => {
      if (prev === key) {
        setSortDir((d) => (d === "asc" ? "desc" : "asc"));
        return prev;
      }
      setSortDir("asc");
      return key;
    });
  }, []);

  async function reload() {
    const data = await fetch(`/api/presentations?type=${type}`).then((r) => r.json());
    setPresentations(data.presentations || []);
  }

  const filteredPresentations = useMemo(() =>
    presentations.filter((presentation) => !trackFilter || presentation.submission.track?.id === trackFilter),
    [presentations, trackFilter]);

  const trackCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const presentation of presentations) {
      if (presentation.submission.track?.id) {
        counts[presentation.submission.track.id] = (counts[presentation.submission.track.id] || 0) + 1;
      }
    }
    return counts;
  }, [presentations]);

  const sortedPresentations = useMemo(() =>
    [...filteredPresentations].sort((a, b) => {
      const direction = sortDir === "asc" ? 1 : -1;

      switch (sortKey) {
        case "title":
          return direction * a.submission.title.localeCompare(b.submission.title);
        case "author":
          return direction * displayNameTh(a.submission.author).localeCompare(displayNameTh(b.submission.author));
        case "track":
          return direction * (a.submission.track?.name || "").localeCompare(b.submission.track?.name || "");
        case "scheduledAt":
          return direction * (a.scheduledAt || "").localeCompare(b.scheduledAt || "");
        case "room":
          return direction * (a.room || "").localeCompare(b.room || "");
        case "duration":
          return direction * ((a.duration || 0) - (b.duration || 0));
        case "status":
          return direction * a.status.localeCompare(b.status);
        default:
          return 0;
      }
    }),
    [filteredPresentations, sortKey, sortDir]);

  const { scheduledCount, pendingCount } = useMemo(() => {
    let scheduled = 0;
    let pending = 0;
    for (const p of filteredPresentations) {
      if (p.status === "SCHEDULED") scheduled++;
      else pending++;
    }
    return { scheduledCount: scheduled, pendingCount: pending };
  }, [filteredPresentations]);

  async function handleSchedule(presentationId: string) {
    setSaving(true);

    try {
      const payload = {
        scheduledAt: editForm.scheduledAt.trim() || null,
        room: editForm.room.trim() || null,
        duration: editForm.duration.trim() ? Number(editForm.duration) : null,
      };

      const res = await fetch(`/api/presentations/${presentationId}/schedule`, {
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

  async function handleSaveCriteria(nextCriteria: CriterionData[]) {
    try {
      const res = await fetch("/api/presentations/criteria", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          criteria: nextCriteria,
        }),
      });

      const data = await res.json().catch(() => null);

      if (res.ok) {
        setCriteria(data?.criteria || nextCriteria);
        setMessageTone("success");
        setMessage(t("presentations.criteriaSaved"));
        return;
      }

      setMessageTone("danger");
      setMessage(data?.error || t("presentations.criteriaSaveError"));
    } catch {
      setMessageTone("danger");
      setMessage(t("presentations.criteriaSaveError"));
    }
  }

  async function handleAssignCommittee(presentationId: string) {
    setAssigningSaving(true);

    try {
      const res = await fetch(`/api/presentations/${presentationId}/committee`, {
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

  function handleTabChange(tab: typeof activeTab) {
    setActiveTab(tab);
    setMessage("");

    if (tab === "scoring" && !scoringLoaded) {
      setScoringLoaded(true);
      fetch("/api/presentations/scoring-dashboard")
        .then(async (r) => {
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          return r.json();
        })
        .then((res) => {
          const all: ScoringPresentation[] = res.presentations || [];
          setScoringData(all.filter((presentation) => presentation.type === type));
        })
        .catch(() => {
          // Let the user retry via the tab button; reset scoringLoaded so a
          // click on "Scoring" again re-issues the fetch instead of silently
          // showing an empty board.
          setScoringLoaded(false);
          setMessageTone("danger");
          setMessage(t("presentations.scoringLoadError"));
        });
    }
  }

  const tabs = canManage
    ? [
        { key: "schedule" as const, label: t("presentations.schedule"), icon: <Calendar className="h-3.5 w-3.5" /> },
        { key: "criteria" as const, label: t("presentations.criteria"), icon: <ClipboardList className="h-3.5 w-3.5" /> },
        { key: "committee" as const, label: t("presentations.committee"), icon: <Users className="h-3.5 w-3.5" /> },
        { key: "scoring" as const, label: t("presentations.scoring"), icon: <BarChart3 className="h-3.5 w-3.5" /> },
      ]
    : [
        { key: "schedule" as const, label: t("presentations.schedule"), icon: <Calendar className="h-3.5 w-3.5" /> },
      ];

  const filteredScoring = useMemo(() =>
    scoringData.filter((presentation) => !trackFilter || presentation.submission.track?.id === trackFilter),
    [scoringData, trackFilter]);

  function avgScore(evaluations: ScoringPresentation["evaluations"]) {
    if (evaluations.length === 0) return null;

    const total = evaluations.reduce((sum, evaluation) => {
      const scores = evaluation.scores || {};
      const values = Object.values(scores);
      if (values.length === 0) return sum;
      return sum + values.reduce((scoreSum, value) => scoreSum + value, 0) / values.length;
    }, 0);

    return (total / evaluations.length).toFixed(1);
  }

  return (
    <div className="space-y-6">
      <Breadcrumb items={[{ label: t("nav.dashboard"), href: "/dashboard" }, { label: title }]} />
      <SectionTitle
        title={title}
        subtitle={canManage ? t("presentations.managementSubtitle", { n: filteredPresentations.length }) : t("presentations.itemsCount", { n: filteredPresentations.length })}
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <SummaryStatCard label={t("presentations.total")} value={filteredPresentations.length} icon={<TitleIcon className="h-5 w-5" />} color="blue" />
        <SummaryStatCard label={t("presentations.scheduled")} value={scheduledCount} icon={<Check className="h-5 w-5" />} color="emerald" />
        <SummaryStatCard label={t("presentations.pendingSchedule")} value={pendingCount} icon={<Calendar className="h-5 w-5" />} color="amber" />
      </div>

      <TrackFilter value={trackFilter} onChange={setTrackFilter} counts={trackCounts} />

      {message && <Alert tone={messageTone}>{message}</Alert>}

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

      {activeTab === "schedule" && (
        <>
          {!canManage && <RubricManager criteria={criteria} defaultExpanded={false} />}
          {filteredPresentations.length === 0 ? (
            <EmptyState icon={<TitleIcon className="h-12 w-12" />} title={t("presentations.noPresentations")} body={t("presentations.autoCreated")} />
          ) : (
          <>
            <div className="space-y-3 lg:hidden">
              {sortedPresentations.map((presentation) => (
                <Card key={presentation.id}>
                  <CardBody className="space-y-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-base font-semibold text-ink">{presentationLabel(presentation)}</p>
                        <p className="mt-1 text-sm text-ink-muted">{displayNameTh(presentation.submission.author)}</p>
                      </div>
                      <Badge tone={presentation.status === "SCHEDULED" ? "success" : "warning"} dot>
                        {presentation.status === "SCHEDULED" ? t("presentations.statusScheduled") : t("presentations.statusPending")}
                      </Badge>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {presentation.submission.track && <Badge tone="info">{presentation.submission.track.name}</Badge>}
                    </div>

                    <div className="grid grid-cols-1 gap-3 rounded-xl bg-surface-alt p-4 text-sm sm:grid-cols-3">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wider text-ink-muted">{t("presentations.dateTime")}</p>
                        <p className="mt-1 text-ink">{presentation.scheduledAt ? formatDateTime(presentation.scheduledAt) : "—"}</p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wider text-ink-muted">{t("presentations.room")}</p>
                        <p className="mt-1 text-ink">{presentation.room || "—"}</p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wider text-ink-muted">{t("presentations.minutes")}</p>
                        <p className="mt-1 text-ink">{presentation.duration || "—"}</p>
                      </div>
                    </div>

                    {canManage && editingId === presentation.id ? (
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
                          <Button size="sm" onClick={() => handleSchedule(presentation.id)} loading={saving}><Check className="h-3.5 w-3.5" />{t("common.save")}</Button>
                          <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>{t("common.cancel")}</Button>
                        </div>
                      </div>
                    ) : canManage ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setEditingId(presentation.id);
                          setEditForm({
                            scheduledAt: toDateTimeLocalValue(presentation.scheduledAt),
                            room: presentation.room || "",
                            duration: presentation.duration?.toString() || "",
                          });
                        }}
                      >
                        {presentation.scheduledAt ? t("presentations.editSchedule") : t("presentations.setSchedule")}
                      </Button>
                    ) : null}
                    {isCommittee && (
                      <Link href={`/presentations/${presentation.id}/score`}>
                        <Button size="sm" variant="primary">
                          <Star className="h-3.5 w-3.5" />
                          {t("scoring.giveScore")}
                        </Button>
                      </Link>
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
                      <tr className="border-b border-border/60 bg-surface-alt/80">
                        <SortTh label={t("presentations.paper")} sortKey_="title" currentKey={sortKey} dir={sortDir} onSort={toggleSort} className="w-[35%] px-5" />
                        <SortTh label={t("submissions.track")} sortKey_="track" currentKey={sortKey} dir={sortDir} onSort={toggleSort} />
                        <SortTh label={t("presentations.dateTime")} sortKey_="scheduledAt" currentKey={sortKey} dir={sortDir} onSort={toggleSort} />
                        <SortTh label={t("presentations.room")} sortKey_="room" currentKey={sortKey} dir={sortDir} onSort={toggleSort} />
                        <SortTh label={t("presentations.minutes")} sortKey_="duration" currentKey={sortKey} dir={sortDir} onSort={toggleSort} align="center" />
                        <SortTh label={t("presentations.statusCol")} sortKey_="status" currentKey={sortKey} dir={sortDir} onSort={toggleSort} align="center" />
                        <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wider text-ink-muted" />
                      </tr>
                    </thead>
                    <tbody>
                      {sortedPresentations.map((presentation) => (
                        <Fragment key={presentation.id}>
                          <tr className="group border-t border-border/40 transition-colors hover:bg-surface-hover/50">
                            <td className="px-5 py-3.5">
                              <p className="leading-snug font-medium text-ink">{presentationLabel(presentation)}</p>
                              <p className="mt-0.5 text-xs text-ink-muted">{displayNameTh(presentation.submission.author)}</p>
                            </td>
                            <td className="px-4 py-3.5">
                              {presentation.submission.track ? <Badge tone="info">{presentation.submission.track.name}</Badge> : <span className="text-xs text-ink-muted">—</span>}
                            </td>
                            <td className="px-4 py-3.5">
                              {presentation.scheduledAt ? (
                                <span className="text-xs text-ink-light">{formatDateTime(presentation.scheduledAt)}</span>
                              ) : (
                                <span className="text-xs text-ink-muted">—</span>
                              )}
                            </td>
                            <td className="px-4 py-3.5">
                              {presentation.room ? (
                                <span className="inline-flex items-center gap-1 text-xs text-ink-light"><MapPin className="h-3 w-3" />{presentation.room}</span>
                              ) : (
                                <span className="text-xs text-ink-muted">—</span>
                              )}
                            </td>
                            <td className="px-4 py-3.5 text-center">
                              {presentation.duration ? <span className="text-xs text-ink-light">{presentation.duration}</span> : <span className="text-xs text-ink-muted">—</span>}
                            </td>
                            <td className="px-4 py-3.5 text-center">
                              <Badge tone={presentation.status === "SCHEDULED" ? "success" : "warning"} dot>
                                {presentation.status === "SCHEDULED" ? t("presentations.statusScheduled") : t("presentations.statusPending")}
                              </Badge>
                            </td>
                            <td className="px-5 py-3.5 text-right">
                              <div className="flex items-center justify-end gap-1">
                                {canManage && editingId === presentation.id ? (
                                  <>
                                    <Button size="sm" onClick={() => handleSchedule(presentation.id)} loading={saving}><Check className="h-3.5 w-3.5" />{t("common.save")}</Button>
                                    <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}><X className="h-3.5 w-3.5" /></Button>
                                  </>
                                ) : canManage ? (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="opacity-100 transition-opacity lg:opacity-0 lg:group-hover:opacity-100 lg:group-focus-within:opacity-100"
                                    onClick={() => {
                                      setEditingId(presentation.id);
                                      setEditForm({
                                        scheduledAt: toDateTimeLocalValue(presentation.scheduledAt),
                                        room: presentation.room || "",
                                        duration: presentation.duration?.toString() || "",
                                      });
                                    }}
                                  >
                                    {presentation.scheduledAt ? t("presentations.editSchedule") : t("presentations.setSchedule")}
                                  </Button>
                                ) : null}
                                {isCommittee && (
                                  <Link href={`/presentations/${presentation.id}/score`}>
                                    <Button size="sm" variant="primary">
                                      <Star className="h-3.5 w-3.5" />
                                      {t("scoring.giveScore")}
                                    </Button>
                                  </Link>
                                )}
                              </div>
                            </td>
                          </tr>
                          {canManage && editingId === presentation.id && (
                            <tr className="bg-brand-50/40">
                              <td colSpan={7} className="px-5 py-4">
                                <div className="grid max-w-2xl grid-cols-1 gap-3 sm:grid-cols-3">
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
        }
        </>
      )}

      {activeTab === "criteria" && (
        <RubricManager
          criteria={criteria}
          canEdit={canEditCriteria}
          onSave={handleSaveCriteria}
        />
      )}

      {activeTab === "committee" && (
        filteredPresentations.length === 0 ? (
          <EmptyState icon={<Users className="h-12 w-12" />} title={t("presentations.noPresentations")} />
        ) : (
          <>
            <div className="space-y-3 lg:hidden">
              {filteredPresentations.map((presentation) => (
                <Card key={presentation.id}>
                  <CardBody className="space-y-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-base font-semibold text-ink">{presentationLabel(presentation)}</p>
                        <p className="mt-1 text-sm text-ink-muted">{displayNameTh(presentation.submission.author)}</p>
                      </div>
                      {presentation.submission.track && <Badge tone="info">{presentation.submission.track.name}</Badge>}
                    </div>

                    <Button
                      size="sm"
                      variant={assignPresId === presentation.id ? "secondary" : "outline"}
                      onClick={() => {
                        if (assignPresId === presentation.id) {
                          setAssignPresId(null);
                          setSelectedJudges([]);
                        } else {
                          setAssignPresId(presentation.id);
                          setSelectedJudges([]);
                        }
                      }}
                    >
                      <UserPlus className="h-3.5 w-3.5" />
                      {assignPresId === presentation.id ? t("common.cancel") : t("presentations.committee")}
                    </Button>

                    {assignPresId === presentation.id && (
                      <div className="space-y-3 rounded-xl border border-blue-200/60 bg-blue-50/40 p-4">
                        {committeeUsers.length === 0 ? (
                          <p className="text-xs text-danger">{t("presentations.noCommittee")}</p>
                        ) : (
                          <>
                            <p className="text-xs font-medium text-ink-light">{t("presentations.selectCommittee")}</p>
                            <div className="grid grid-cols-1 gap-2">
                              {committeeUsers.map((committeeUser) => {
                                const isSelected = selectedJudges.includes(committeeUser.id);
                                return (
                                  <label
                                    key={committeeUser.id}
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
                                        if (e.target.checked) setSelectedJudges([...selectedJudges, committeeUser.id]);
                                        else setSelectedJudges(selectedJudges.filter((id) => id !== committeeUser.id));
                                      }}
                                      className="rounded border-border text-brand-500 focus:ring-brand-500"
                                    />
                                    <div className="min-w-0">
                                      <p className="text-sm font-medium text-ink">{displayNameTh(committeeUser)}</p>
                                      <p className="text-xs text-ink-muted">{committeeUser.email}</p>
                                    </div>
                                  </label>
                                );
                              })}
                            </div>
                            {selectedJudges.length > 0 && (
                              <div className="flex flex-col gap-2 border-t border-blue-200/60 pt-3 sm:flex-row sm:items-center sm:justify-between">
                                <p className="text-xs text-ink-muted">{t("presentations.selectedCount", { n: selectedJudges.length })}</p>
                                <Button size="sm" onClick={() => handleAssignCommittee(presentation.id)} loading={assigningSaving}>
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
                      <tr className="border-b border-border/60 bg-surface-alt/80">
                        <th className="w-[50%] px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-ink-muted">{t("presentations.paper")}</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-ink-muted">{t("submissions.track")}</th>
                        <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wider text-ink-muted" />
                      </tr>
                    </thead>
                    <tbody>
                      {filteredPresentations.map((presentation) => (
                        <Fragment key={presentation.id}>
                          <tr className="group border-t border-border/40 transition-colors hover:bg-surface-hover/50">
                            <td className="px-5 py-3.5">
                              <p className="leading-snug font-medium text-ink">{presentationLabel(presentation)}</p>
                              <p className="mt-0.5 text-xs text-ink-muted">{displayNameTh(presentation.submission.author)}</p>
                            </td>
                            <td className="px-4 py-3.5">
                              {presentation.submission.track ? <Badge tone="info">{presentation.submission.track.name}</Badge> : <span className="text-xs text-ink-muted">—</span>}
                            </td>
                            <td className="px-5 py-3.5 text-right">
                              <Button
                                size="sm"
                                variant={assignPresId === presentation.id ? "secondary" : "outline"}
                                onClick={() => {
                                  if (assignPresId === presentation.id) {
                                    setAssignPresId(null);
                                    setSelectedJudges([]);
                                  } else {
                                    setAssignPresId(presentation.id);
                                    setSelectedJudges([]);
                                  }
                                }}
                              >
                                <UserPlus className="h-3.5 w-3.5" />
                                {assignPresId === presentation.id ? t("common.cancel") : t("presentations.committee")}
                              </Button>
                            </td>
                          </tr>
                          {assignPresId === presentation.id && (
                            <tr className="bg-blue-50/40">
                              <td colSpan={3} className="px-5 py-4">
                                {committeeUsers.length === 0 ? (
                                  <p className="text-xs text-danger">{t("presentations.noCommittee")}</p>
                                ) : (
                                  <div className="space-y-3">
                                    <p className="text-xs font-medium text-ink-light">{t("presentations.selectCommittee")}</p>
                                    <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
                                      {committeeUsers.map((committeeUser) => {
                                        const isSelected = selectedJudges.includes(committeeUser.id);
                                        return (
                                          <label
                                            key={committeeUser.id}
                                            className={`flex cursor-pointer items-center gap-2.5 rounded-lg border px-3 py-2.5 transition-all ${
                                              isSelected
                                                ? "border-blue-300 bg-blue-50 shadow-sm"
                                                : "border-transparent bg-white hover:bg-surface-hover"
                                            }`}
                                          >
                                            <input
                                              type="checkbox"
                                              checked={isSelected}
                                              onChange={(e) => {
                                                if (e.target.checked) setSelectedJudges([...selectedJudges, committeeUser.id]);
                                                else setSelectedJudges(selectedJudges.filter((id) => id !== committeeUser.id));
                                              }}
                                              className="rounded border-border text-brand-500 focus:ring-brand-500"
                                            />
                                            <div className="min-w-0">
                                              <p className="truncate text-sm font-medium text-ink">{displayNameTh(committeeUser)}</p>
                                              <p className="truncate text-xs text-ink-muted">{committeeUser.email}</p>
                                            </div>
                                          </label>
                                        );
                                      })}
                                    </div>
                                    {selectedJudges.length > 0 && (
                                      <div className="flex items-center justify-between border-t border-blue-200/60 pt-2">
                                        <p className="text-xs text-ink-muted">{t("presentations.selectedCount", { n: selectedJudges.length })}</p>
                                        <Button size="sm" onClick={() => handleAssignCommittee(presentation.id)} loading={assigningSaving}>
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

      {activeTab === "scoring" && (
        filteredScoring.length === 0 ? (
          <EmptyState icon={<BarChart3 className="h-12 w-12" />} title={t("presentations.noScoringData")} body={t("presentations.noScoringDataDesc")} />
        ) : (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-ink">{t("presentations.scoringResults", { n: filteredScoring.length })}</h3>
                <a href="/api/exports/proceedings?format=csv" download>
                  <Button variant="outline" size="sm"><Download className="h-3.5 w-3.5" />{t("presentations.exportCSV")}</Button>
                </a>
              </div>
            </CardHeader>
            <CardBody className="p-0">
              <div className="space-y-3 p-5 lg:hidden">
                {filteredScoring.map((presentation) => {
                  const average = avgScore(presentation.evaluations);
                  return (
                    <div key={presentation.id} className="rounded-xl border border-border/60 bg-surface-alt p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-base font-semibold text-ink">{presentationLabel(presentation)}</p>
                          <p className="mt-1 text-sm text-ink-muted">{displayNameTh(presentation.submission.author)}</p>
                        </div>
                        {presentation.submission.track && <Badge tone="info">{presentation.submission.track.name}</Badge>}
                      </div>
                      <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wider text-ink-muted">{t("presentations.committeeLabel")}</p>
                          <p className="mt-1 text-ink">{presentation.evaluations.length}</p>
                        </div>
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wider text-ink-muted">{t("presentations.avgScore")}</p>
                          <p className={`mt-1 font-semibold ${average ? Number(average) >= 7 ? "text-green-600" : Number(average) >= 5 ? "text-yellow-600" : "text-red-600" : "text-ink-muted"}`}>
                            {average || "—"}
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
                    <tr className="border-b border-border/60 bg-surface-alt/80">
                      <th className="w-[35%] px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-ink-muted">{t("presentations.paper")}</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-ink-muted">{t("reviews.author")}</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-ink-muted">{t("submissions.track")}</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-ink-muted">{t("presentations.committeeLabel")}</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-ink-muted">{t("presentations.avgScore")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredScoring.map((presentation) => {
                      const average = avgScore(presentation.evaluations);
                      return (
                        <tr key={presentation.id} className="border-t border-border/40 transition-colors hover:bg-surface-hover/50">
                          <td className="px-5 py-3.5 font-medium text-ink">{presentationLabel(presentation)}</td>
                          <td className="px-4 py-3.5 text-ink-light">{displayNameTh(presentation.submission.author)}</td>
                          <td className="px-4 py-3.5">
                            {presentation.submission.track ? <Badge tone="info">{presentation.submission.track.name}</Badge> : <span className="text-ink-muted">—</span>}
                          </td>
                          <td className="px-4 py-3.5 text-center"><Badge>{presentation.evaluations.length}</Badge></td>
                          <td className="px-4 py-3.5 text-center">
                            {average ? (
                              <span className={`font-bold ${Number(average) >= 7 ? "text-green-600" : Number(average) >= 5 ? "text-yellow-600" : "text-red-600"}`}>{average}</span>
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

const SortTh = memo(function SortTh({
  label,
  sortKey_,
  currentKey,
  dir,
  onSort,
  align,
  className,
}: {
  label: string;
  sortKey_: string;
  currentKey: string;
  dir: "asc" | "desc";
  onSort: (key: never) => void;
  align?: "center" | "left";
  className?: string;
}) {
  const active = currentKey === sortKey_;

  return (
    <th
      className={`${align === "center" ? "text-center" : "text-left"} cursor-pointer select-none px-4 py-3 text-xs font-semibold uppercase tracking-wider text-ink-muted transition-colors hover:text-ink ${className || ""}`}
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
});
