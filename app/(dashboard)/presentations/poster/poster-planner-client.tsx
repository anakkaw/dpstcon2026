"use client";

import { useCallback, useEffect, useId, useMemo, useState } from "react";
import Link from "next/link";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { RubricManager } from "@/components/presentations/rubric-manager";
import { SectionTitle } from "@/components/ui/section-title";
import { useI18n } from "@/lib/i18n";
import type {
  PosterPlannerSubmission,
  PosterPlannerSessionSettings,
  AuthorPosterSlot,
  CommitteePosterSlot,
} from "@/server/poster-planner-data";
import type { CriterionData } from "@/server/presentation-data";
import {
  CalendarRange,
  ClipboardList,
  Clock,
  FolderKanban,
  LayoutPanelTop,
  Plus,
  Star,
  Trash2,
  Users,
} from "lucide-react";

type AdminCommitteeUser = {
  id: string;
  name: string;
  trackId: string | null;
};

interface PosterPlannerClientProps {
  mode: "admin" | "author" | "committee" | "hybrid";
  initialSessionSettings?: PosterPlannerSessionSettings;
  initialPosterSubmissions?: PosterPlannerSubmission[];
  initialCommitteeUsers?: AdminCommitteeUser[];
  authorSlots?: AuthorPosterSlot[];
  committeeSlots?: CommitteePosterSlot[];
  criteria?: CriterionData[];
  canEditCriteria?: boolean;
}

type MessageTone = "success" | "danger";

const SLOT_DURATION_MINUTES = 15;

function formatSlotCode(index: number): string {
  return String(index + 1).padStart(2, "0");
}

function formatTime(isoString: string): string {
  const d = new Date(isoString);
  return d.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function timeToIso(time: string): string {
  const baseDate = "2026-01-01";
  return new Date(`${baseDate}T${time}:00`).toISOString();
}

function addMinutes(isoString: string, minutes: number): string {
  const d = new Date(isoString);
  d.setMinutes(d.getMinutes() + minutes);
  return d.toISOString();
}

// ── Schedule row for the table ──
interface ScheduleRow {
  submissionId: string;
  paperCode: string | null;
  title: string;
  authorName: string;
  trackId: string;
  trackName: string;
  /** Map from slot template id → { slotId, judgeId } */
  slotAssignments: Record<string, { slotId: string; judgeId: string }>;
}

export function PosterPlannerClient({
  mode,
  initialSessionSettings = { room: "", slotTemplates: [] },
  initialPosterSubmissions = [],
  initialCommitteeUsers = [],
  authorSlots = [],
  committeeSlots = [],
  criteria = [],
  canEditCriteria = false,
}: PosterPlannerClientProps) {
  const { t } = useI18n();
  const plannerId = useId();
  const [adminTab, setAdminTab] = useState<"planner" | "criteria">("planner");
  const [posterSubmissions, setPosterSubmissions] = useState(initialPosterSubmissions);
  const [sessionSettings, setSessionSettings] = useState(initialSessionSettings);
  const [message, setMessage] = useState("");
  const [messageTone, setMessageTone] = useState<MessageTone>("success");
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [rubricCriteria, setRubricCriteria] = useState(criteria);
  const [sessionDraft, setSessionDraft] = useState<PosterPlannerSessionSettings>(initialSessionSettings);
  const [newSlotTime, setNewSlotTime] = useState("");
  const [selectedTrackId, setSelectedTrackId] = useState<string | null>(null);

  useEffect(() => {
    setRubricCriteria(criteria);
  }, [criteria]);

  // ── Track list ──
  const trackSections = useMemo(() => {
    const trackMap = new Map<string, { id: string; name: string }>();
    for (const sub of posterSubmissions) {
      if (sub.track) {
        trackMap.set(sub.track.id, sub.track);
      }
    }
    return Array.from(trackMap.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [posterSubmissions]);

  // Auto-select first track
  useEffect(() => {
    if (selectedTrackId === null && trackSections.length > 0) {
      setSelectedTrackId(trackSections[0].id);
    }
  }, [trackSections, selectedTrackId]);

  // ── Build schedule rows ──
  const scheduleRows = useMemo((): ScheduleRow[] => {
    return posterSubmissions.map((sub) => {
      const slotAssignments: Record<string, { slotId: string; judgeId: string }> = {};
      for (const sj of sub.slotJudges) {
        const templateId = `${sj.startsAt}__${sj.endsAt}`;
        slotAssignments[templateId] = { slotId: sj.id, judgeId: sj.judgeId };
      }

      return {
        submissionId: sub.submissionId,
        paperCode: sub.paperCode,
        title: sub.title,
        authorName: sub.author.name,
        trackId: sub.track?.id || "",
        trackName: sub.track?.name || "",
        slotAssignments,
      };
    });
  }, [posterSubmissions]);

  // ── Filtered rows by selected track ──
  const filteredRows = useMemo(() => {
    if (!selectedTrackId) return scheduleRows;
    return scheduleRows.filter((row) => row.trackId === selectedTrackId);
  }, [scheduleRows, selectedTrackId]);

  // ── Committee users for selected track ──
  const trackCommitteeUsers = useMemo(() => {
    if (!selectedTrackId) return initialCommitteeUsers;
    return initialCommitteeUsers.filter(
      (u) => u.trackId === null || u.trackId === selectedTrackId
    );
  }, [initialCommitteeUsers, selectedTrackId]);

  // ── Judge workload across all tracks ──
  const judgeWorkload = useMemo(() => {
    const counts = new Map<string, { name: string; count: number }>();
    for (const cu of initialCommitteeUsers) {
      counts.set(cu.id, { name: cu.name, count: 0 });
    }
    for (const sub of posterSubmissions) {
      for (const sj of sub.slotJudges) {
        const entry = counts.get(sj.judgeId);
        if (entry) {
          entry.count += 1;
        } else {
          counts.set(sj.judgeId, { name: sj.judgeName, count: 1 });
        }
      }
    }
    return Array.from(counts.entries())
      .map(([id, { name, count }]) => ({ id, name, count }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  }, [initialCommitteeUsers, posterSubmissions]);

  // ── API helpers ──
  const refreshPlanner = useCallback(async () => {
    const response = await fetch("/api/presentations/poster-planner");
    const data = await response.json();
    setSessionSettings(data.sessionSettings || { room: "", slotTemplates: [] });
    setSessionDraft(data.sessionSettings || { room: "", slotTemplates: [] });
    setPosterSubmissions(data.posterSubmissions || []);
  }, []);

  const runAction = useCallback(async (key: string, action: () => Promise<void>) => {
    setSavingKey(key);
    setMessage("");
    try {
      await action();
      setMessageTone("success");
    } catch (error) {
      setMessageTone("danger");
      setMessage(error instanceof Error ? error.message : t("poster.somethingWentWrong"));
    } finally {
      setSavingKey(null);
    }
  }, [t]);

  async function handleSaveCriteria(nextCriteria: CriterionData[]) {
    const response = await fetch("/api/presentations/criteria", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "POSTER", criteria: nextCriteria }),
    });
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(data?.error || t("poster.unableToSaveRubric"));
    }
    setRubricCriteria(data?.criteria || nextCriteria);
    setMessageTone("success");
    setMessage(t("poster.rubricUpdated"));
  }

  // ── Session settings ──
  async function saveSessionSettings() {
    await runAction("session-settings", async () => {
      const response = await fetch("/api/presentations/poster-session", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          room: sessionDraft.room.trim(),
          slotTemplates: sessionDraft.slotTemplates.map((slot) => ({
            startsAt: slot.startsAt,
            endsAt: slot.endsAt,
          })),
        }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error || t("poster.unableToSaveSession"));
      }
      await refreshPlanner();
      setNewSlotTime("");
      setMessage(t("poster.sessionUpdated"));
    });
  }

  function addSessionSlotTemplate() {
    if (!newSlotTime) {
      setMessageTone("danger");
      setMessage(t("poster.enterStartTime"));
      return;
    }
    const startsAtIso = timeToIso(newSlotTime);
    const endsAtIso = addMinutes(startsAtIso, SLOT_DURATION_MINUTES);
    const startsAt = new Date(startsAtIso);
    const endsAt = new Date(endsAtIso);
    if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) {
      setMessageTone("danger");
      setMessage(t("poster.invalidTimeFormat"));
      return;
    }
    const id = `${startsAtIso}__${endsAtIso}`;
    if (sessionDraft.slotTemplates.some((slot) => slot.id === id)) {
      setMessageTone("danger");
      setMessage(t("poster.slotAlreadyExists"));
      return;
    }
    setSessionDraft((prev) => ({
      ...prev,
      slotTemplates: [...prev.slotTemplates, { id, startsAt: startsAtIso, endsAt: endsAtIso }].sort(
        (a, b) =>
          new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime() ||
          new Date(a.endsAt).getTime() - new Date(b.endsAt).getTime()
      ),
    }));
    setNewSlotTime("");
    setMessageTone("success");
    setMessage(t("poster.slotAddedSave"));
  }

  function removeSessionSlotTemplate(slotId: string) {
    setSessionDraft((prev) => ({
      ...prev,
      slotTemplates: prev.slotTemplates.filter((slot) => slot.id !== slotId),
    }));
    setMessageTone("success");
    setMessage(t("poster.slotRemovedSave"));
  }

  // ── Judge assignment handler ──
  const handleJudgeChange = useCallback(
    async (row: ScheduleRow, templateId: string, newJudgeId: string) => {
      const existing = row.slotAssignments[templateId];
      const template = sessionSettings.slotTemplates.find((s) => s.id === templateId);
      if (!template) return;

      const actionKey = `assign-${row.submissionId}-${templateId}`;
      await runAction(actionKey, async () => {
        if (existing && newJudgeId === "") {
          // Remove slot
          const response = await fetch(`/api/presentations/poster-slots/${existing.slotId}`, {
            method: "DELETE",
          });
          if (!response.ok) {
            const data = await response.json().catch(() => null);
            throw new Error(data?.error || t("poster.unableToSaveJudge"));
          }
        } else if (existing && newJudgeId) {
          // Update slot
          const response = await fetch(`/api/presentations/poster-slots/${existing.slotId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ judgeId: newJudgeId }),
          });
          if (!response.ok) {
            const data = await response.json().catch(() => null);
            throw new Error(data?.error || t("poster.unableToSaveJudge"));
          }
        } else if (!existing && newJudgeId) {
          // Create slot
          const response = await fetch("/api/presentations/poster-slots", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              submissionId: row.submissionId,
              judgeId: newJudgeId,
              startsAt: template.startsAt,
              endsAt: template.endsAt,
            }),
          });
          if (!response.ok) {
            const data = await response.json().catch(() => null);
            throw new Error(data?.error || t("poster.unableToSaveJudge"));
          }
        }
        await refreshPlanner();
        setMessage(t("poster.judgeSaved"));
      });
    },
    [refreshPlanner, runAction, sessionSettings.slotTemplates, t]
  );

  const sessionRoomId = `${plannerId}-session-room`;

  // ──────────────── AUTHOR VIEW ────────────────
  if (mode === "author") {
    return (
      <div className="space-y-6">
        <SectionTitle title={t("poster.presentationTitle")} subtitle={t("poster.presentationSubtitle")} />
        <RubricManager criteria={rubricCriteria} defaultExpanded={false} />
        {authorSlots.length === 0 ? (
          <EmptyState icon={<FolderKanban className="h-12 w-12" />} title={t("poster.noGroup")} body={t("poster.noGroupDesc")} />
        ) : (
          authorSlots.map((slot) => (
            <Card key={slot.submissionId}>
              <CardHeader>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge>{slot.paperCode || "NO-CODE"}</Badge>
                  <Badge tone="info">{slot.trackName}</Badge>
                </div>
                <h3 className="text-lg font-semibold text-ink">{slot.title}</h3>
                <p className="text-sm text-ink-muted">
                  {t("poster.roomLabel")}: {slot.room || t("poster.tba")}
                </p>
              </CardHeader>
              <CardBody className="space-y-3">
                {slot.slotJudges.length === 0 ? (
                  <p className="text-sm text-ink-muted">{t("poster.noSlots")}</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {slot.slotJudges.map((sj) => (
                      <div key={`${sj.startsAt}-${sj.judgeName}`} className="flex items-center gap-2 rounded-xl border border-border/60 bg-surface-alt px-3 py-2">
                        <span className="text-sm font-medium text-ink">
                          {formatTime(sj.startsAt)} - {formatTime(sj.endsAt)}
                        </span>
                        <Badge tone="info">{sj.judgeName}</Badge>
                        <Badge tone={sj.status === "COMPLETED" ? "success" : sj.status === "CONFIRMED" ? "info" : "neutral"}>
                          {sj.status}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardBody>
            </Card>
          ))
        )}
      </div>
    );
  }

  // ──────────────── COMMITTEE VIEW ────────────────
  if (mode === "committee") {
    return (
      <div className="space-y-6">
        <SectionTitle title={t("poster.reviewTitle")} subtitle={t("poster.reviewSubtitle")} />
        <RubricManager criteria={rubricCriteria} defaultExpanded={false} />
        {committeeSlots.length === 0 ? (
          <EmptyState icon={<Users className="h-12 w-12" />} title={t("poster.noAssigned")} body={t("poster.noAssignedDesc")} />
        ) : (
          committeeSlots.map((slot) => (
            <Card key={slot.slotId}>
              <CardHeader>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone="info">{slot.trackName}</Badge>
                  <Badge>{slot.paperCode || "NO-CODE"}</Badge>
                </div>
                <h3 className="text-lg font-semibold text-ink">{slot.title}</h3>
                <p className="text-sm text-ink-muted">
                  {t("poster.roomLabel")}: {slot.room || t("poster.tba")} | {slot.authorName}
                </p>
              </CardHeader>
              <CardBody className="space-y-3">
                <div className="flex items-center gap-2 rounded-xl border border-border/60 bg-surface-alt px-3 py-2">
                  <span className="text-sm font-medium text-ink">
                    {formatTime(slot.startsAt)} - {formatTime(slot.endsAt)}
                  </span>
                  <Badge tone={slot.status === "COMPLETED" ? "success" : slot.status === "CONFIRMED" ? "info" : "neutral"}>
                    {slot.status}
                  </Badge>
                </div>
                {slot.presentationId && (
                  <div className="flex justify-end">
                    <Link href={`/presentations/${slot.presentationId}/score`}>
                      <Button size="sm" variant="primary">
                        <Star className="h-3.5 w-3.5" />
                        {t("scoring.giveScore")}
                      </Button>
                    </Link>
                  </div>
                )}
              </CardBody>
            </Card>
          ))
        )}
      </div>
    );
  }

  // ──────────────── HYBRID VIEW ────────────────
  if (mode === "hybrid") {
    return (
      <div className="space-y-8">
        <RubricManager criteria={rubricCriteria} defaultExpanded={false} />
        <div className="space-y-6">
          <SectionTitle title={t("poster.presentationTitle")} subtitle={t("poster.presentationSubtitle")} />
          {authorSlots.length === 0 ? (
            <EmptyState icon={<FolderKanban className="h-12 w-12" />} title={t("poster.noGroup")} body={t("poster.noGroupDesc")} />
          ) : (
            authorSlots.map((slot) => (
              <Card key={slot.submissionId}>
                <CardHeader>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge>{slot.paperCode || "NO-CODE"}</Badge>
                    <Badge tone="info">{slot.trackName}</Badge>
                  </div>
                  <h3 className="text-lg font-semibold text-ink">{slot.title}</h3>
                  <p className="text-sm text-ink-muted">{t("poster.roomLabel")}: {slot.room || t("poster.tba")}</p>
                </CardHeader>
                <CardBody className="space-y-3">
                  {slot.slotJudges.length === 0 ? (
                    <p className="text-sm text-ink-muted">{t("poster.noSlots")}</p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {slot.slotJudges.map((sj) => (
                        <div key={`${sj.startsAt}-${sj.judgeName}`} className="flex items-center gap-2 rounded-xl border border-border/60 bg-surface-alt px-3 py-2">
                          <span className="text-sm font-medium text-ink">{formatTime(sj.startsAt)} - {formatTime(sj.endsAt)}</span>
                          <Badge tone="info">{sj.judgeName}</Badge>
                          <Badge tone={sj.status === "COMPLETED" ? "success" : sj.status === "CONFIRMED" ? "info" : "neutral"}>{sj.status}</Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </CardBody>
              </Card>
            ))
          )}
        </div>
        <div className="space-y-6">
          <SectionTitle title={t("poster.reviewTitle")} subtitle={t("poster.reviewSubtitle")} />
          {committeeSlots.length === 0 ? (
            <EmptyState icon={<Users className="h-12 w-12" />} title={t("poster.noAssigned")} body={t("poster.noAssignedDesc")} />
          ) : (
            committeeSlots.map((slot) => (
              <Card key={slot.slotId}>
                <CardHeader>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone="info">{slot.trackName}</Badge>
                    <Badge>{slot.paperCode || "NO-CODE"}</Badge>
                  </div>
                  <h3 className="text-lg font-semibold text-ink">{slot.title}</h3>
                  <p className="text-sm text-ink-muted">{t("poster.roomLabel")}: {slot.room || t("poster.tba")} | {slot.authorName}</p>
                </CardHeader>
                <CardBody className="space-y-3">
                  <div className="flex items-center gap-2 rounded-xl border border-border/60 bg-surface-alt px-3 py-2">
                    <span className="text-sm font-medium text-ink">{formatTime(slot.startsAt)} - {formatTime(slot.endsAt)}</span>
                    <Badge tone={slot.status === "COMPLETED" ? "success" : slot.status === "CONFIRMED" ? "info" : "neutral"}>{slot.status}</Badge>
                  </div>
                  {slot.presentationId && (
                    <div className="flex justify-end">
                      <Link href={`/presentations/${slot.presentationId}/score`}>
                        <Button size="sm" variant="primary">
                          <Star className="h-3.5 w-3.5" />
                          {t("scoring.giveScore")}
                        </Button>
                      </Link>
                    </div>
                  )}
                </CardBody>
              </Card>
            ))
          )}
        </div>
      </div>
    );
  }

  // ──────────────── ADMIN VIEW ────────────────
  return (
    <div className="space-y-6">
      <SectionTitle title={t("poster.scheduleTitle")} subtitle={t("poster.scheduleSubtitle")} />

      {message && <Alert tone={messageTone}>{message}</Alert>}

      {/* ── Admin Tabs ── */}
      <div className="flex gap-0.5 overflow-x-auto border-b border-border/60">
        {([
          { key: "planner" as const, label: t("presentations.schedule"), icon: <LayoutPanelTop className="h-3.5 w-3.5" /> },
          { key: "criteria" as const, label: t("presentations.criteria"), icon: <ClipboardList className="h-3.5 w-3.5" /> },
        ]).map((tab) => (
          <button
            key={tab.key}
            onClick={() => setAdminTab(tab.key)}
            className={`flex items-center gap-2 whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium transition-colors duration-150 ${
              adminTab === tab.key
                ? "border-brand-500 text-brand-600"
                : "border-transparent text-ink-muted hover:text-ink hover:border-gray-200"
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {adminTab === "criteria" && (
        <RubricManager criteria={rubricCriteria} canEdit={canEditCriteria} onSave={handleSaveCriteria} />
      )}

      {adminTab === "planner" && (
        <>
          {/* ── Session Settings ── */}
          <Card>
            <CardHeader>
              <h3 className="flex items-center gap-2 text-sm font-semibold text-ink">
                <Clock className="h-4 w-4 text-ink-muted" />
                {t("poster.sessionSettings")}
              </h3>
              <p className="text-sm text-ink-muted">
                {t("poster.sessionSettingsDesc", { n: SLOT_DURATION_MINUTES })}
              </p>
            </CardHeader>
            <CardBody className="space-y-4">
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_2fr]">
                <Field label={t("poster.roomLabel")} htmlFor={sessionRoomId}>
                  <Input
                    id={sessionRoomId}
                    value={sessionDraft.room}
                    onChange={(event) => setSessionDraft((prev) => ({ ...prev, room: event.target.value }))}
                    placeholder="e.g. Poster Hall A"
                    name="sharedRoom"
                    autoComplete="off"
                  />
                </Field>
                <div className="space-y-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
                    {t("poster.timeSlots", { n: SLOT_DURATION_MINUTES })}
                  </p>
                  {sessionDraft.slotTemplates.length === 0 ? (
                    <p className="text-sm text-ink-muted">{t("poster.noSlotsYet")}</p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {sessionDraft.slotTemplates.map((slot, index) => (
                        <div key={slot.id} className="group flex items-center gap-1.5 rounded-lg border border-border/60 bg-surface-alt px-2.5 py-1.5">
                          <span className="rounded bg-brand-100 px-1.5 py-0.5 text-xs font-bold text-brand-700">{formatSlotCode(index)}</span>
                          <span className="text-sm font-medium text-ink">{formatTime(slot.startsAt)} - {formatTime(slot.endsAt)}</span>
                          <button
                            type="button"
                            onClick={() => removeSessionSlotTemplate(slot.id)}
                            className="ml-1 rounded p-0.5 text-ink-muted opacity-0 transition-opacity hover:text-red-500 group-hover:opacity-100"
                            aria-label={`Remove slot ${formatSlotCode(index)}`}
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="flex items-end gap-2">
                    <Field label={t("poster.addSlotTime")} htmlFor={`${plannerId}-new-slot-time`}>
                      <Input id={`${plannerId}-new-slot-time`} type="time" value={newSlotTime} onChange={(event) => setNewSlotTime(event.target.value)} name="newSlotTime" />
                    </Field>
                    <Button size="sm" variant="outline" onClick={addSessionSlotTemplate}>
                      <Plus className="h-3.5 w-3.5" />
                      {t("poster.add")}
                    </Button>
                  </div>
                </div>
              </div>
              <div className="flex justify-end border-t border-border/40 pt-3">
                <Button size="sm" onClick={saveSessionSettings} loading={savingKey === "session-settings"}>
                  {t("poster.saveSessionSettings")}
                </Button>
              </div>
            </CardBody>
          </Card>

          {/* ── Track Tabs ── */}
          {trackSections.length > 0 && (
            <div className="flex gap-1 overflow-x-auto rounded-xl border border-border/60 bg-surface-alt p-1">
              {trackSections.map((track) => {
                const isActive = selectedTrackId === track.id;
                const trackPaperCount = scheduleRows.filter((r) => r.trackId === track.id).length;
                return (
                  <button
                    key={track.id}
                    onClick={() => setSelectedTrackId(track.id)}
                    className={`flex items-center gap-2 whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                      isActive ? "bg-white text-brand-600 shadow-sm" : "text-ink-muted hover:text-ink hover:bg-white/60"
                    }`}
                  >
                    {track.name}
                    <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${isActive ? "bg-brand-100 text-brand-700" : "bg-gray-100 text-gray-500"}`}>
                      {trackPaperCount}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {/* ── Schedule Table ── */}
          {sessionSettings.slotTemplates.length === 0 ? (
            <Alert tone="danger">
              <CalendarRange className="inline h-4 w-4 mr-1" />
              {t("poster.addSlotsFirst")}
            </Alert>
          ) : filteredRows.length === 0 ? (
            <EmptyState icon={<FolderKanban className="h-12 w-12" />} title={t("poster.noPapersInTrack")} body={t("poster.noRecordsDesc")} />
          ) : (
            <Card>
              <CardBody className="overflow-x-auto p-0">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border/60 bg-gray-50/80">
                      <th className="sticky left-0 z-10 bg-gray-50/80 px-4 py-3 text-left font-semibold text-ink min-w-[280px]">
                        {t("poster.paperColumn")}
                      </th>
                      <th className="px-3 py-3 text-left font-semibold text-ink min-w-[120px]">
                        {t("poster.authorColumn")}
                      </th>
                      {sessionSettings.slotTemplates.map((slot, index) => (
                        <th key={slot.id} className="px-3 py-3 text-center font-semibold text-ink min-w-[160px]">
                          <div className="flex flex-col items-center gap-0.5">
                            <span className="rounded bg-brand-100 px-1.5 py-0.5 text-xs font-bold text-brand-700">{formatSlotCode(index)}</span>
                            <span className="text-xs text-ink-muted">{formatTime(slot.startsAt)} - {formatTime(slot.endsAt)}</span>
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRows.map((row) => (
                      <tr key={row.submissionId} className="border-b border-border/40 hover:bg-gray-50/50 transition-colors">
                        <td className="sticky left-0 z-10 bg-white px-4 py-2.5">
                          <div className="flex items-center gap-2">
                            <Badge>{row.paperCode || "NO-CODE"}</Badge>
                            <span className="truncate font-medium text-ink max-w-[200px]" title={row.title}>{row.title}</span>
                          </div>
                        </td>
                        <td className="px-3 py-2.5 text-ink-muted whitespace-nowrap">{row.authorName}</td>
                        {sessionSettings.slotTemplates.map((slot) => {
                          const assignment = row.slotAssignments[slot.id];
                          const currentJudgeId = assignment?.judgeId || "";
                          const isSaving = savingKey === `assign-${row.submissionId}-${slot.id}`;

                          return (
                            <td key={slot.id} className="px-2 py-2">
                              <select
                                value={currentJudgeId}
                                onChange={(e) => handleJudgeChange(row, slot.id, e.target.value)}
                                disabled={isSaving}
                                className={`w-full rounded-lg border px-2 py-1.5 text-xs transition-colors ${
                                  currentJudgeId
                                    ? "border-brand-200 bg-brand-50/40 text-ink"
                                    : "border-border/60 bg-white text-ink-muted"
                                } ${isSaving ? "opacity-50 cursor-wait" : "hover:border-brand-300 focus:border-brand-400 focus:ring-1 focus:ring-brand-200"} focus:outline-none`}
                              >
                                <option value="">{t("poster.selectJudgeOption")}</option>
                                {trackCommitteeUsers.map((cu) => (
                                  <option key={cu.id} value={cu.id}>{cu.name}</option>
                                ))}
                              </select>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardBody>
            </Card>
          )}

          {/* ── Judge Workload Summary ── */}
          {judgeWorkload.length > 0 && (
            <Card>
              <CardHeader>
                <h3 className="flex items-center gap-2 text-sm font-semibold text-ink">
                  <Users className="h-4 w-4 text-ink-muted" />
                  {t("poster.workloadSummary")}
                </h3>
              </CardHeader>
              <CardBody className="p-0">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border/60 bg-gray-50/80">
                      <th className="px-4 py-2.5 text-left font-semibold text-ink">{t("poster.judgeName")}</th>
                      <th className="px-4 py-2.5 text-center font-semibold text-ink w-[160px]">{t("poster.assignedSlots")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {judgeWorkload.map((judge) => (
                      <tr key={judge.id} className="border-b border-border/40 hover:bg-gray-50/50 transition-colors">
                        <td className="px-4 py-2 text-ink">{judge.name}</td>
                        <td className="px-4 py-2 text-center">
                          <span className={`inline-flex min-w-[2rem] items-center justify-center rounded-full px-2 py-0.5 text-xs font-bold ${
                            judge.count === 0
                              ? "bg-gray-100 text-gray-400"
                              : judge.count >= 6
                                ? "bg-red-100 text-red-700"
                                : "bg-brand-100 text-brand-700"
                          }`}>
                            {judge.count}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardBody>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
