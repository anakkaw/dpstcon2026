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
import { Select } from "@/components/ui/select";
import { useI18n } from "@/lib/i18n";
import {
  POSTER_REQUIRED_JUDGE_COUNT,
  buildPosterJudgeAssignments,
  createPosterSlotTemplateId,
  getPosterScheduleReadiness,
  getUnavailableJudgeIdsForSlot,
  posterSlotRangesOverlap,
  type PosterJudgeAssignment,
} from "@/lib/poster-planner-rules";
import { isPublishedPresentationStatus } from "@/lib/presentation-status";
import type {
  PosterPlannerSubmission,
  PosterPlannerSessionSettings,
  PosterJudgeBusySlot,
  AuthorPosterSlot,
  CommitteePosterSlot,
} from "@/server/poster-planner-data";
import type { CriterionData } from "@/server/presentation-data";
import {
  ArrowDown,
  ArrowUp,
  CalendarRange,
  ClipboardList,
  Clock,
  FolderKanban,
  LayoutPanelTop,
  LockKeyhole,
  Megaphone,
  Plus,
  Star,
  Trash2,
  UserCheck,
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
  initialJudgeBusySlots?: PosterJudgeBusySlot[];
  authorSlots?: AuthorPosterSlot[];
  committeeSlots?: CommitteePosterSlot[];
  criteria?: CriterionData[];
  canEditCriteria?: boolean;
  canEditSessionSettings?: boolean;
  canPublishSchedule?: boolean;
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
  presentationStatus: string;
  submissionId: string;
  paperCode: string | null;
  title: string;
  authorName: string;
  trackId: string;
  trackName: string;
  judgeAssignments: PosterJudgeAssignment[];
}

type ScheduleSlotTemplate = PosterPlannerSessionSettings["slotTemplates"][number] & {
  isOrphan?: boolean;
};

export function PosterPlannerClient({
  mode,
  initialSessionSettings = { room: "", slotTemplates: [] },
  initialPosterSubmissions = [],
  initialCommitteeUsers = [],
  initialJudgeBusySlots = [],
  authorSlots = [],
  committeeSlots = [],
  criteria = [],
  canEditCriteria = false,
  canEditSessionSettings = false,
  canPublishSchedule = false,
}: PosterPlannerClientProps) {
  const { t } = useI18n();
  const plannerId = useId();
  const [adminTab, setAdminTab] = useState<"planner" | "criteria">("planner");
  const [posterSubmissions, setPosterSubmissions] = useState(initialPosterSubmissions);
  const [judgeBusySlots, setJudgeBusySlots] = useState(initialJudgeBusySlots);
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
      const judgeAssignments = buildPosterJudgeAssignments(sub.slotJudges);

      return {
        presentationStatus: sub.presentationStatus,
        submissionId: sub.submissionId,
        paperCode: sub.paperCode,
        title: sub.title,
        authorName: sub.author.name,
        trackId: sub.track?.id || "",
        trackName: sub.track?.name || "",
        judgeAssignments,
      };
    });
  }, [posterSubmissions]);

  // ── Filtered rows by selected track ──
  const filteredRows = useMemo(() => {
    if (!selectedTrackId) return scheduleRows;
    return scheduleRows.filter((row) => row.trackId === selectedTrackId);
  }, [scheduleRows, selectedTrackId]);

  const selectedTrackPublishState = useMemo(() => {
    let draftCount = 0;
    let publishableDraftCount = 0;
    let incompleteDraftCount = 0;
    for (const row of filteredRows) {
      const isDraft = !isPublishedPresentationStatus(row.presentationStatus);
      const isReady = getPosterScheduleReadiness(row.judgeAssignments).isReady;
      if (isDraft) draftCount += 1;
      if (isDraft && isReady) publishableDraftCount += 1;
      if (isDraft && !isReady) incompleteDraftCount += 1;
    }
    return { draftCount, publishableDraftCount, incompleteDraftCount };
  }, [filteredRows]);

  // ── Committee users for selected track ──
  const trackCommitteeUsers = useMemo(() => {
    const scopedUsers = selectedTrackId
      ? initialCommitteeUsers.filter((u) => u.trackId === null || u.trackId === selectedTrackId)
      : initialCommitteeUsers;
    const seen = new Set<string>();
    return scopedUsers.filter((u) => {
      if (seen.has(u.id)) return false;
      seen.add(u.id);
      return true;
    });
  }, [initialCommitteeUsers, selectedTrackId]);

  const sessionTemplateIds = useMemo(
    () => new Set(sessionSettings.slotTemplates.map((slot) => slot.id)),
    [sessionSettings.slotTemplates]
  );

  const orphanSlotTemplates = useMemo((): ScheduleSlotTemplate[] => {
    const orphanMap = new Map<string, ScheduleSlotTemplate>();
    for (const sub of posterSubmissions) {
      for (const sj of sub.slotJudges) {
        const id = createPosterSlotTemplateId(sj.startsAt, sj.endsAt);
        if (!sessionTemplateIds.has(id)) {
          orphanMap.set(id, { id, startsAt: sj.startsAt, endsAt: sj.endsAt, isOrphan: true });
        }
      }
    }
    return Array.from(orphanMap.values()).sort(
      (a, b) =>
        new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime() ||
        new Date(a.endsAt).getTime() - new Date(b.endsAt).getTime()
    );
  }, [posterSubmissions, sessionTemplateIds]);

  const visibleSlotTemplates = useMemo(
    (): ScheduleSlotTemplate[] => [...sessionSettings.slotTemplates, ...orphanSlotTemplates],
    [orphanSlotTemplates, sessionSettings.slotTemplates]
  );

  const orphanAssignmentCount = useMemo(() => {
    let count = 0;
    for (const sub of posterSubmissions) {
      for (const sj of sub.slotJudges) {
        if (!sessionTemplateIds.has(createPosterSlotTemplateId(sj.startsAt, sj.endsAt))) {
          count += 1;
        }
      }
    }
    return count;
  }, [posterSubmissions, sessionTemplateIds]);

  const selectedTrackOrphanAssignmentCount = useMemo(() => {
    let count = 0;
    for (const row of filteredRows) {
      for (const assignment of row.judgeAssignments) {
        if (!sessionTemplateIds.has(assignment.slotTemplateId)) {
          count += 1;
        }
      }
    }
    return count;
  }, [filteredRows, sessionTemplateIds]);

  const slotLoadSummary = useMemo(() => {
    const counts = new Map<string, number>();
    for (const slot of visibleSlotTemplates) {
      counts.set(slot.id, 0);
    }
    for (const row of filteredRows) {
      for (const assignment of row.judgeAssignments) {
        counts.set(assignment.slotTemplateId, (counts.get(assignment.slotTemplateId) ?? 0) + 1);
      }
    }
    return counts;
  }, [filteredRows, visibleSlotTemplates]);

  const judgeWorkloadGrid = useMemo(() => {
    const rows = trackCommitteeUsers.map((judge) => ({
      id: judge.id,
      name: judge.name,
      count: 0,
      slots: new Map<string, string>(),
    }));
    const byJudgeId = new Map(rows.map((row) => [row.id, row]));

    for (const row of filteredRows) {
      const label = row.paperCode || row.title;
      for (const assignment of row.judgeAssignments) {
        const judge = byJudgeId.get(assignment.judgeId);
        if (!judge) continue;
        judge.count += 1;
        judge.slots.set(assignment.slotTemplateId, label);
      }
    }

    return rows.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  }, [filteredRows, trackCommitteeUsers]);

  // ── API helpers ──
  const refreshPlanner = useCallback(async () => {
    const response = await fetch("/api/presentations/poster-planner");
    const data = await response.json();
    setSessionSettings(data.sessionSettings || { room: "", slotTemplates: [] });
    setSessionDraft(data.sessionSettings || { room: "", slotTemplates: [] });
    setPosterSubmissions(data.posterSubmissions || []);
    setJudgeBusySlots(data.judgeBusySlots || []);
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

  async function publishCurrentTrack() {
    if (!selectedTrackId) return;

    await runAction(`publish-${selectedTrackId}`, async () => {
      const response = await fetch("/api/presentations/poster-publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trackId: selectedTrackId }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(data?.error || t("poster.publishError"));
      }
      await refreshPlanner();
      setMessage(t("poster.publishSuccess", { n: data?.publishedCount ?? 0 }));
    });
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

  const readPosterSlotError = useCallback(async (response: Response) => {
    const data = await response.json().catch(() => null);
    return data?.message || data?.error || t("poster.unableToSaveJudge");
  }, [t]);

  const deletePosterSlot = useCallback(async (slotId: string) => {
    const response = await fetch(`/api/presentations/poster-slots/${slotId}`, {
      method: "DELETE",
    });
    if (!response.ok) {
      throw new Error(await readPosterSlotError(response));
    }
  }, [readPosterSlotError]);

  const patchPosterSlot = useCallback(async (
    slotId: string,
    body: { judgeId?: string; startsAt?: string; endsAt?: string }
  ) => {
    const response = await fetch(`/api/presentations/poster-slots/${slotId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      throw new Error(await readPosterSlotError(response));
    }
  }, [readPosterSlotError]);

  const createPosterSlot = useCallback(async (input: {
    submissionId: string;
    judgeId: string;
    startsAt: string;
    endsAt: string;
  }) => {
    const response = await fetch("/api/presentations/poster-slots", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    if (!response.ok) {
      throw new Error(await readPosterSlotError(response));
    }
  }, [readPosterSlotError]);

  const movePosterRow = useCallback(
    async (row: ScheduleRow, direction: "up" | "down") => {
      const actionKey = `move-${row.submissionId}-${direction}`;
      await runAction(actionKey, async () => {
        const response = await fetch("/api/presentations/poster-order", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            trackId: row.trackId,
            submissionId: row.submissionId,
            direction,
          }),
        });
        const data = await response.json().catch(() => null);
        if (!response.ok) {
          throw new Error(data?.error || t("poster.unableToReorder"));
        }
        await refreshPlanner();
        setMessage(t("poster.orderSaved"));
      });
    },
    [refreshPlanner, runAction, t]
  );

  const handleMatrixJudgeChange = useCallback(
    async (row: ScheduleRow, slot: ScheduleSlotTemplate, newJudgeId: string) => {
      const existing = row.judgeAssignments.find((assignment) => assignment.slotTemplateId === slot.id);

      if (slot.isOrphan && newJudgeId) {
        setMessageTone("danger");
        setMessage(t("poster.orphanSlotCannotCreate"));
        return;
      }

      const duplicateJudge = newJudgeId
        ? row.judgeAssignments.some(
            (assignment) => assignment.slotId !== existing?.slotId && assignment.judgeId === newJudgeId
          )
        : false;
      if (duplicateJudge) {
        setMessageTone("danger");
        setMessage(t("poster.judgesMustBeUnique"));
        return;
      }

      const isCreatingFourthAssignment =
        !existing && newJudgeId && row.judgeAssignments.length >= POSTER_REQUIRED_JUDGE_COUNT;
      if (isCreatingFourthAssignment) {
        setMessageTone("danger");
        setMessage(t("poster.posterAlreadyComplete"));
        return;
      }

      const unavailable = getUnavailableJudgeIdsForSlot({
        slot,
        currentSubmissionId: row.submissionId,
        busySlots: judgeBusySlots,
      });
      if (newJudgeId && unavailable.has(newJudgeId) && existing?.judgeId !== newJudgeId) {
        setMessageTone("danger");
        setMessage(t("poster.judgeTimeConflict"));
        return;
      }

      const actionKey = `assign-${row.submissionId}-${slot.id}`;
      await runAction(actionKey, async () => {
        if (existing && newJudgeId === "") {
          await deletePosterSlot(existing.slotId);
        } else if (existing && newJudgeId) {
          await patchPosterSlot(existing.slotId, {
            judgeId: newJudgeId,
          });
        } else if (!existing && newJudgeId) {
          await createPosterSlot({
            submissionId: row.submissionId,
            judgeId: newJudgeId,
            startsAt: slot.startsAt,
            endsAt: slot.endsAt,
          });
        }
        await refreshPlanner();
        setMessage(t("poster.judgeSaved"));
      });
    },
    [createPosterSlot, deletePosterSlot, judgeBusySlots, patchPosterSlot, refreshPlanner, runAction, t]
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
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="flex items-center gap-2 text-sm font-semibold text-ink">
                    <Clock className="h-4 w-4 text-ink-muted" />
                    {t("poster.sessionSettings")}
                  </h3>
                  <p className="mt-1 text-sm text-ink-muted">
                    {t("poster.sessionSettingsDesc", { n: SLOT_DURATION_MINUTES })}
                  </p>
                </div>
                {!canEditSessionSettings && (
                  <Badge tone="info" icon={LockKeyhole}>
                    {t("poster.adminManagedSettings")}
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardBody className="space-y-4">
              {!canEditSessionSettings && (
                <Alert tone="info">
                  {t("poster.adminManagedSettingsDesc")}
                </Alert>
              )}
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_2fr]">
                <Field label={t("poster.roomLabel")} htmlFor={sessionRoomId}>
                  <Input
                    id={sessionRoomId}
                    value={sessionDraft.room}
                    onChange={(event) => setSessionDraft((prev) => ({ ...prev, room: event.target.value }))}
                    placeholder="e.g. Poster Hall A"
                    name="sharedRoom"
                    autoComplete="off"
                    disabled={!canEditSessionSettings}
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
                          {canEditSessionSettings && (
                            <button
                              type="button"
                              onClick={() => removeSessionSlotTemplate(slot.id)}
                              className="ml-1 rounded p-0.5 text-ink-muted opacity-0 transition-opacity hover:text-red-500 group-hover:opacity-100"
                              aria-label={`Remove slot ${formatSlotCode(index)}`}
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                  {canEditSessionSettings && (
                    <div className="flex items-end gap-2">
                      <Field label={t("poster.addSlotTime")} htmlFor={`${plannerId}-new-slot-time`}>
                        <Input id={`${plannerId}-new-slot-time`} type="time" value={newSlotTime} onChange={(event) => setNewSlotTime(event.target.value)} name="newSlotTime" />
                      </Field>
                      <Button size="sm" variant="outline" onClick={addSessionSlotTemplate}>
                        <Plus className="h-3.5 w-3.5" />
                        {t("poster.add")}
                      </Button>
                    </div>
                  )}
                </div>
              </div>
              {canEditSessionSettings && (
                <div className="flex justify-end border-t border-border/40 pt-3">
                  <Button size="sm" onClick={saveSessionSettings} loading={savingKey === "session-settings"}>
                    {t("poster.saveSessionSettings")}
                  </Button>
                </div>
              )}
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

          {canPublishSchedule && selectedTrackId && (
            <Card>
              <CardBody className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-ink">{t("poster.publishPanelTitle")}</p>
                  <p className="mt-1 text-sm text-ink-muted">
                    {t("poster.publishPanelDesc", {
                      draft: selectedTrackPublishState.draftCount,
                      ready: selectedTrackPublishState.publishableDraftCount,
                      incomplete: selectedTrackPublishState.incompleteDraftCount,
                    })}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="primary"
                  onClick={publishCurrentTrack}
                  loading={savingKey === `publish-${selectedTrackId}`}
                  disabled={selectedTrackPublishState.publishableDraftCount === 0}
                >
                  <Megaphone className="h-3.5 w-3.5" />
                  {t("poster.publishTrack")}
                </Button>
              </CardBody>
            </Card>
          )}

          {/* ── Schedule Table ── */}
          {orphanAssignmentCount > 0 && (
            <Alert tone="warning">
              {t("poster.orphanSlotsWarning", {
                n: orphanAssignmentCount,
                trackN: selectedTrackOrphanAssignmentCount,
              })}
            </Alert>
          )}

          {visibleSlotTemplates.length === 0 ? (
            <Alert tone="danger">
              <CalendarRange className="inline h-4 w-4 mr-1" />
              {canEditSessionSettings ? t("poster.addSlotsFirst") : t("poster.noAdminSlotsYet")}
            </Alert>
          ) : filteredRows.length === 0 ? (
            <EmptyState icon={<FolderKanban className="h-12 w-12" />} title={t("poster.noPapersInTrack")} body={t("poster.noRecordsDesc")} />
          ) : (
            <Card>
              <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="flex items-center gap-2 text-sm font-semibold text-ink">
                      <UserCheck className="h-4 w-4 text-ink-muted" />
                      {t("poster.assignmentBoardTitle")}
                    </h3>
                    <p className="mt-1 text-sm text-ink-muted">
                      {t("poster.assignmentBoardDesc", { n: POSTER_REQUIRED_JUDGE_COUNT })}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge tone="success">{t("poster.readyCount", { n: selectedTrackPublishState.publishableDraftCount })}</Badge>
                    <Badge tone="warning">{t("poster.incompleteCount", { n: selectedTrackPublishState.incompleteDraftCount })}</Badge>
                  </div>
                </div>
              </CardHeader>
              <CardBody className="overflow-x-auto p-0">
                <table className="w-full min-w-[1620px] text-sm">
                  <thead>
                    <tr className="border-b border-border/60 bg-gray-50/80">
                      <th className="sticky left-0 z-10 min-w-[300px] bg-gray-50/80 px-4 py-3 text-left font-semibold text-ink">
                        {t("poster.paperColumn")}
                      </th>
                      <th className="min-w-[120px] px-3 py-3 text-left font-semibold text-ink">
                        {t("poster.authorColumn")}
                      </th>
                      {visibleSlotTemplates.map((slot, index) => (
                        <th key={slot.id} className="min-w-[165px] px-3 py-3 text-left font-semibold text-ink">
                          <div className="space-y-1">
                            <div className="flex items-center gap-1.5">
                              <span className={`rounded px-1.5 py-0.5 text-xs font-bold ${slot.isOrphan ? "bg-amber-100 text-amber-800" : "bg-brand-100 text-brand-700"}`}>
                                {formatSlotCode(index)}
                              </span>
                              {slot.isOrphan && (
                                <span className="text-[11px] font-semibold text-amber-700">{t("poster.removedSlot")}</span>
                              )}
                            </div>
                            <div className="text-xs text-ink-muted">{formatTime(slot.startsAt)} - {formatTime(slot.endsAt)}</div>
                            <div className="text-[11px] font-medium text-ink-muted">
                              {t("poster.slotLoad", { n: slotLoadSummary.get(slot.id) ?? 0 })}
                            </div>
                          </div>
                        </th>
                      ))}
                      <th className="min-w-[150px] px-3 py-3 text-left font-semibold text-ink">
                        {t("poster.readinessColumn")}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRows.map((row, rowIndex) => {
                      const readiness = getPosterScheduleReadiness(row.judgeAssignments);
                      const assignmentsBySlot = new Map<string, PosterJudgeAssignment[]>();
                      for (const assignment of row.judgeAssignments) {
                        const assignments = assignmentsBySlot.get(assignment.slotTemplateId) ?? [];
                        assignments.push(assignment);
                        assignmentsBySlot.set(assignment.slotTemplateId, assignments);
                      }
                      const assignedJudgeIds = row.judgeAssignments.map((assignment) => assignment.judgeId);
                      const isPublished = isPublishedPresentationStatus(row.presentationStatus);
                      const hasDuplicateSlots = readiness.duplicateSlotCount > 0;
                      const readinessTone = readiness.isReady ? "success" : hasDuplicateSlots || readiness.duplicateJudgeCount > 0 ? "danger" : "warning";
                      const readinessLabel = readiness.isReady
                        ? t("poster.ready")
                        : hasDuplicateSlots
                          ? t("poster.duplicateSlots")
                          : readiness.duplicateJudgeCount > 0
                            ? t("poster.duplicateJudges")
                          : t("poster.needJudges", { n: readiness.missingJudgeCount });

                      return (
                        <tr key={row.submissionId} className="border-b border-border/40 align-top transition-colors hover:bg-gray-50/50">
                          <td className="sticky left-0 z-10 bg-white px-4 py-3">
                            <div className="flex gap-3">
                              <div className="flex shrink-0 flex-col gap-1 pt-0.5">
                                <button
                                  type="button"
                                  onClick={() => movePosterRow(row, "up")}
                                  disabled={rowIndex === 0 || savingKey === `move-${row.submissionId}-up`}
                                  title={t("poster.moveUp")}
                                  className="inline-flex h-6 w-6 items-center justify-center rounded-md border border-border/60 bg-white text-ink-muted transition-colors hover:border-brand-300 hover:text-brand-600 disabled:cursor-not-allowed disabled:opacity-35"
                                >
                                  <ArrowUp className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => movePosterRow(row, "down")}
                                  disabled={rowIndex === filteredRows.length - 1 || savingKey === `move-${row.submissionId}-down`}
                                  title={t("poster.moveDown")}
                                  className="inline-flex h-6 w-6 items-center justify-center rounded-md border border-border/60 bg-white text-ink-muted transition-colors hover:border-brand-300 hover:text-brand-600 disabled:cursor-not-allowed disabled:opacity-35"
                                >
                                  <ArrowDown className="h-3.5 w-3.5" />
                                </button>
                              </div>
                              <div className="space-y-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <Badge>{row.paperCode || "NO-CODE"}</Badge>
                                  <Badge tone={isPublished ? "success" : "warning"}>
                                    {isPublished ? t("presentations.statusScheduled") : t("presentations.statusPending")}
                                  </Badge>
                                </div>
                                <p className="max-w-[240px] font-medium leading-snug text-ink" title={row.title}>
                                  {row.title}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="whitespace-nowrap px-3 py-3 text-ink-muted">{row.authorName}</td>
                          {visibleSlotTemplates.map((slot) => {
                            const slotAssignments = assignmentsBySlot.get(slot.id) ?? [];
                            const assignment = slotAssignments[0];
                            const duplicateSlotAssignments = slotAssignments.slice(1);
                            const currentJudgeId = assignment?.judgeId ?? "";
                            const isSaving = savingKey === `assign-${row.submissionId}-${slot.id}`;
                            const isEmptyLocked = !assignment && row.judgeAssignments.length >= POSTER_REQUIRED_JUDGE_COUNT;
                            const unavailableJudges = getUnavailableJudgeIdsForSlot({
                              slot,
                              currentSubmissionId: row.submissionId,
                              busySlots: judgeBusySlots,
                            });
                            const currentBusySlot = currentJudgeId
                              ? judgeBusySlots.find((busySlot) =>
                                  busySlot.judgeId === currentJudgeId &&
                                  busySlot.submissionId !== row.submissionId &&
                                  posterSlotRangesOverlap(
                                    slot.startsAt,
                                    slot.endsAt,
                                    busySlot.startsAt,
                                    busySlot.endsAt
                                  )
                                )
                              : null;

                            return (
                              <td key={slot.id} className="px-3 py-3">
                                <Select
                                  value={currentJudgeId}
                                  onChange={(event) => handleMatrixJudgeChange(row, slot, event.target.value)}
                                  disabled={isSaving || Boolean(slot.isOrphan) || isEmptyLocked}
                                  className={`w-full rounded-lg border px-2.5 py-2 text-xs transition-colors ${
                                    currentBusySlot
                                      ? "border-red-300 bg-red-50/70 text-red-900"
                                      : currentJudgeId
                                        ? "border-brand-200 bg-brand-50/40 text-ink"
                                        : isEmptyLocked
                                          ? "border-gray-100 bg-gray-50 text-gray-400"
                                        : "border-border/60 bg-white text-ink-muted"
                                  } ${isSaving ? "cursor-wait opacity-50" : "hover:border-brand-300 focus:border-brand-400 focus:ring-1 focus:ring-brand-200"} focus:outline-none`}
                                >
                                  <option value="">
                                    {isEmptyLocked ? t("poster.posterAlreadyComplete") : t("poster.selectJudgeOption")}
                                  </option>
                                  {trackCommitteeUsers.map((cu) => {
                                    const duplicateSelected = assignedJudgeIds.some(
                                      (judgeId) => judgeId === cu.id && currentJudgeId !== cu.id
                                    );
                                    const isBusy = unavailableJudges.has(cu.id) && currentJudgeId !== cu.id;
                                    const busySlot = isBusy
                                      ? judgeBusySlots.find((candidate) =>
                                          candidate.judgeId === cu.id &&
                                          candidate.submissionId !== row.submissionId &&
                                          posterSlotRangesOverlap(
                                            slot.startsAt,
                                            slot.endsAt,
                                            candidate.startsAt,
                                            candidate.endsAt
                                          )
                                        )
                                      : null;
                                    const disabled = duplicateSelected || isBusy;
                                    return (
                                      <option key={cu.id} value={cu.id} disabled={disabled}>
                                        {isBusy
                                          ? t("poster.judgeBusyOption", {
                                              name: cu.name,
                                              paper: busySlot?.label ?? t("poster.anotherTrackConflict"),
                                            })
                                          : duplicateSelected
                                            ? t("poster.judgeDuplicateOption", { name: cu.name })
                                            : cu.name}
                                      </option>
                                    );
                                  })}
                                </Select>
                                {currentBusySlot && (
                                  <p className="mt-1 text-[11px] font-semibold leading-tight text-red-700">
                                    {t("poster.existingConflictWarning", {
                                      paper: currentBusySlot.label ?? t("poster.anotherTrackConflict"),
                                    })}
                                  </p>
                                )}
                                {duplicateSlotAssignments.length > 0 && (
                                  <div className="mt-1 space-y-1">
                                    {duplicateSlotAssignments.map((duplicate) => (
                                      <button
                                        key={duplicate.slotId}
                                        type="button"
                                        onClick={() =>
                                          runAction(`delete-duplicate-${duplicate.slotId}`, async () => {
                                            await deletePosterSlot(duplicate.slotId);
                                            await refreshPlanner();
                                            setMessage(t("poster.duplicateSlotRemoved"));
                                          })
                                        }
                                        disabled={savingKey === `delete-duplicate-${duplicate.slotId}`}
                                        className="inline-flex items-center gap-1 rounded-md border border-red-200 bg-red-50 px-1.5 py-0.5 text-[11px] font-semibold text-red-700 hover:bg-red-100 disabled:cursor-wait disabled:opacity-50"
                                      >
                                        <Trash2 className="h-3 w-3" />
                                        {t("poster.removeDuplicateSlot")}
                                      </button>
                                    ))}
                                  </div>
                                )}
                              </td>
                            );
                          })}
                          <td className="px-3 py-3">
                            <div className="space-y-1.5">
                              <Badge tone={readinessTone}>{readinessLabel}</Badge>
                              {readiness.extraJudgeCount > 0 && (
                                <p className="text-[11px] font-semibold text-red-700">
                                  {t("poster.extraJudges", { n: readiness.extraJudgeCount })}
                                </p>
                              )}
                              {readiness.duplicateJudgeCount > 0 && (
                                <p className="text-[11px] font-semibold text-red-700">
                                  {t("poster.duplicateJudges")}
                                </p>
                              )}
                              {readiness.duplicateSlotCount > 0 && (
                                <p className="text-[11px] font-semibold text-red-700">
                                  {t("poster.duplicateSlots")}
                                </p>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </CardBody>
            </Card>
          )}

          {/* ── Judge Workload Summary ── */}
          {judgeWorkloadGrid.length > 0 && visibleSlotTemplates.length > 0 && (
            <Card>
              <CardHeader>
                <div>
                  <h3 className="flex items-center gap-2 text-sm font-semibold text-ink">
                    <Users className="h-4 w-4 text-ink-muted" />
                    {t("poster.workloadSummary")}
                  </h3>
                  <p className="mt-1 text-sm text-ink-muted">{t("poster.workloadSummaryDesc")}</p>
                </div>
              </CardHeader>
              <CardBody className="overflow-x-auto p-0">
                <table className="w-full min-w-[980px] text-sm">
                  <thead>
                    <tr className="border-b border-border/60 bg-gray-50/80">
                      <th className="sticky left-0 z-10 min-w-[220px] bg-gray-50/80 px-4 py-2.5 text-left font-semibold text-ink">{t("poster.judgeName")}</th>
                      {visibleSlotTemplates.map((slot, index) => (
                        <th key={slot.id} className="min-w-[110px] px-3 py-2.5 text-center font-semibold text-ink">
                          <div className="flex flex-col items-center gap-0.5">
                            <span>{formatSlotCode(index)}</span>
                            <span className="text-[11px] font-normal text-ink-muted">{formatTime(slot.startsAt)}</span>
                          </div>
                        </th>
                      ))}
                      <th className="w-[120px] px-4 py-2.5 text-center font-semibold text-ink">{t("poster.assignedSlots")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {judgeWorkloadGrid.map((judge) => (
                      <tr key={judge.id} className="border-b border-border/40 hover:bg-gray-50/50 transition-colors">
                        <td className="sticky left-0 z-10 bg-white px-4 py-2 text-ink">{judge.name}</td>
                        {visibleSlotTemplates.map((slot) => {
                          const label = judge.slots.get(slot.id);
                          return (
                            <td key={slot.id} className="px-2 py-2 text-center">
                              <span className={`inline-flex min-h-6 min-w-16 items-center justify-center rounded-md border px-2 py-1 text-[11px] font-semibold ${
                                label
                                  ? "border-brand-200 bg-brand-50 text-brand-700"
                                  : "border-gray-100 bg-gray-50 text-gray-300"
                              }`}>
                                {label || "-"}
                              </span>
                            </td>
                          );
                        })}
                        <td className="px-4 py-2 text-center">
                          <span className={`inline-flex min-w-[2rem] items-center justify-center rounded-full px-2 py-0.5 text-xs font-bold ${
                            judge.count === 0
                              ? "bg-gray-100 text-gray-400"
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
