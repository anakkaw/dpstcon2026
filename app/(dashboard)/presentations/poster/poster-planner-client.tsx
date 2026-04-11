"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Collapsible } from "@/components/ui/collapsible";
import { EmptyState } from "@/components/ui/empty-state";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { RubricManager } from "@/components/presentations/rubric-manager";
import { SectionTitle } from "@/components/ui/section-title";
import { Select } from "@/components/ui/select";
import { SummaryStatCard } from "@/components/ui/summary-stat-card";
import type {
  PosterPlannerGroup,
  PosterPlannerPaper,
  PosterPlannerSessionSettings,
} from "@/server/poster-planner-data";
import type { CriterionData } from "@/server/presentation-data";
import {
  CalendarRange,
  Check,
  CircleAlert,
  Clock,
  FolderKanban,
  LayoutPanelTop,
  MapPin,
  Plus,
  Presentation,
  Trash2,
  Users,
} from "lucide-react";

type AdminCommitteeUser = {
  id: string;
  name: string;
  trackId: string | null;
};

type AuthorPosterGroup = {
  membershipId: string;
  submissionId: string;
  title: string;
  paperCode: string | null;
  groupId: string;
  groupName: string;
  room: string | null;
  trackName: string;
  judges: string[];
  slots: {
    id: string;
    startsAt: string;
    endsAt: string;
    status: string;
    judgeId: string | null;
  }[];
};

type CommitteePosterGroup = {
  groupId: string;
  groupName: string;
  room: string | null;
  trackName: string;
  judgeOrder: number;
  members: {
    submissionId: string;
    title: string;
    paperCode: string | null;
    authorName: string;
  }[];
  slots: {
    id: string;
    startsAt: string;
    endsAt: string;
    status: string;
  }[];
};

interface PosterPlannerClientProps {
  mode: "admin" | "author" | "committee" | "hybrid";
  initialSessionSettings?: PosterPlannerSessionSettings;
  initialGroups?: PosterPlannerGroup[];
  initialUngroupedPosters?: PosterPlannerPaper[];
  initialCommitteeUsers?: AdminCommitteeUser[];
  authorGroups?: AuthorPosterGroup[];
  committeeGroups?: CommitteePosterGroup[];
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

export function PosterPlannerClient({
  mode,
  initialSessionSettings = { room: "", slotTemplates: [] },
  initialGroups = [],
  initialUngroupedPosters = [],
  initialCommitteeUsers = [],
  authorGroups = [],
  committeeGroups = [],
  criteria = [],
  canEditCriteria = false,
}: PosterPlannerClientProps) {
  const plannerId = useId();
  const [groups, setGroups] = useState(initialGroups);
  const [sessionSettings, setSessionSettings] = useState(initialSessionSettings);
  const [ungroupedPosters, setUngroupedPosters] = useState(initialUngroupedPosters);
  const [message, setMessage] = useState("");
  const [messageTone, setMessageTone] = useState<MessageTone>("success");
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [rubricCriteria, setRubricCriteria] = useState(criteria);
  const [groupDrafts, setGroupDrafts] = useState<Record<string, { name: string }>>(
    Object.fromEntries(
      initialGroups.map((group) => [group.id, { name: group.name }])
    )
  );
  const [sessionDraft, setSessionDraft] = useState<PosterPlannerSessionSettings>(initialSessionSettings);
  const [newSlotTime, setNewSlotTime] = useState("");
  const [newGroupNameByTrack, setNewGroupNameByTrack] = useState<Record<string, string>>({});
  const [selectedGroupByTrack, setSelectedGroupByTrack] = useState<Record<string, string>>({});
  const [selectedPosterIdsByTrack, setSelectedPosterIdsByTrack] = useState<Record<string, string[]>>(
    {}
  );
  const [judgeDrafts, setJudgeDrafts] = useState<Record<string, string[]>>(
    Object.fromEntries(
      initialGroups.map((group) => [
        group.id,
        [0, 1, 2].map((index) => group.judges.find((judge) => judge.judgeOrder === index + 1)?.judge.id || ""),
      ])
    )
  );
  const [slotDrafts, setSlotDrafts] = useState<
    Record<string, { templateId: string; judgeId: string; status: string }>
  >(
    Object.fromEntries(
      initialGroups.map((group) => [
        group.id,
        { templateId: "", judgeId: "", status: "PLANNED" },
      ])
    )
  );

  useEffect(() => {
    setRubricCriteria(criteria);
  }, [criteria]);

  async function handleSaveCriteria(nextCriteria: CriterionData[]) {
    const response = await fetch("/api/presentations/criteria", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "POSTER",
        criteria: nextCriteria,
      }),
    });

    const data = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(data?.error || "Unable to save poster rubric");
    }

    setRubricCriteria(data?.criteria || nextCriteria);
    setMessageTone("success");
    setMessage("Poster rubric updated");
  }

  const trackSections = useMemo(() => {
    const trackMap = new Map<string, { id: string; name: string }>();

    for (const group of groups) {
      trackMap.set(group.track.id, group.track);
    }
    for (const paper of ungroupedPosters) {
      if (paper.track) {
        trackMap.set(paper.track.id, paper.track);
      }
    }

    return Array.from(trackMap.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [groups, ungroupedPosters]);

  const plannerStats = useMemo(() => {
    const readyGroups = groups.filter((group) => group.members.length > 0 && group.judges.length === 3 && group.slots.length > 0).length;
    const incompleteGroups = groups.length - readyGroups;

    return {
      totalGroups: groups.length,
      readyGroups,
      incompleteGroups,
      ungroupedPosters: ungroupedPosters.length,
      sharedSlots: sessionSettings.slotTemplates.length,
    };
  }, [groups, sessionSettings.slotTemplates.length, ungroupedPosters]);

  function getGroupTone(group: PosterPlannerGroup) {
    if (group.members.length === 0) return "neutral";
    if (group.judges.length < 3 || group.slots.length === 0) return "warning";
    return "success";
  }

  function getGroupLabel(group: PosterPlannerGroup) {
    if (group.members.length === 0) return "No papers yet";
    if (group.judges.length < 3) return "Missing judges";
    if (group.slots.length === 0) return "Need slots";
    return "Ready";
  }

  async function refreshPlanner() {
    const response = await fetch("/api/presentations/poster-planner");
    const data = await response.json();
    setSessionSettings(data.sessionSettings || { room: "", slotTemplates: [] });
    setSessionDraft(data.sessionSettings || { room: "", slotTemplates: [] });
    setGroups(data.groups || []);
    setUngroupedPosters(data.ungroupedPosters || []);
    setGroupDrafts(
      Object.fromEntries(
        (data.groups || []).map((group: PosterPlannerGroup) => [
          group.id,
          { name: group.name },
        ])
      )
    );
    setJudgeDrafts(
      Object.fromEntries(
        (data.groups || []).map((group: PosterPlannerGroup) => [
          group.id,
          [0, 1, 2].map(
            (index) => group.judges.find((judge) => judge.judgeOrder === index + 1)?.judge.id || ""
          ),
        ])
      )
    );
    setSlotDrafts(
      Object.fromEntries(
        (data.groups || []).map((group: PosterPlannerGroup) => [
          group.id,
          { templateId: "", judgeId: "", status: "PLANNED" },
        ])
      )
    );
  }

  async function runAction(key: string, action: () => Promise<void>) {
    setSavingKey(key);
    setMessage("");
    try {
      await action();
      setMessageTone("success");
    } catch (error) {
      setMessageTone("danger");
      setMessage(error instanceof Error ? error.message : "Something went wrong");
    } finally {
      setSavingKey(null);
    }
  }

  async function saveGroup(groupId: string) {
    await runAction(`group-${groupId}`, async () => {
      const response = await fetch(`/api/presentations/poster-groups/${groupId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(groupDrafts[groupId]),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error || "Unable to save group");
      }

      await refreshPlanner();
      setMessage("Poster group updated");
    });
  }

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
        throw new Error(data?.error || "Unable to save poster session");
      }

      await refreshPlanner();
      setNewSlotTime("");
      setMessage("Poster session settings updated");
    });
  }

  function addSessionSlotTemplate() {
    if (!newSlotTime) {
      setMessageTone("danger");
      setMessage("Please enter a start time for the slot");
      return;
    }

    const startsAtIso = timeToIso(newSlotTime);
    const endsAtIso = addMinutes(startsAtIso, SLOT_DURATION_MINUTES);

    const startsAt = new Date(startsAtIso);
    const endsAt = new Date(endsAtIso);
    if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) {
      setMessageTone("danger");
      setMessage("Invalid time format");
      return;
    }

    const id = `${startsAtIso}__${endsAtIso}`;
    const duplicate = sessionDraft.slotTemplates.some((slot) => slot.id === id);
    if (duplicate) {
      setMessageTone("danger");
      setMessage("This slot already exists");
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
    setMessage("Slot added. Save session to publish.");
  }

  function removeSessionSlotTemplate(slotId: string) {
    setSessionDraft((prev) => ({
      ...prev,
      slotTemplates: prev.slotTemplates.filter((slot) => slot.id !== slotId),
    }));
    setMessageTone("success");
    setMessage("Slot removed. Save session to publish.");
  }

  async function createGroup(trackId: string) {
    await runAction(`create-${trackId}`, async () => {
      const name = newGroupNameByTrack[trackId]?.trim();
      if (!name) {
        throw new Error("Group name is required");
      }

      const response = await fetch("/api/presentations/poster-groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trackId, name }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error || "Unable to create group");
      }

      setNewGroupNameByTrack((prev) => ({ ...prev, [trackId]: "" }));
      await refreshPlanner();
      setMessage("Poster group created");
    });
  }

  async function addSelectedPosters(trackId: string) {
    await runAction(`members-${trackId}`, async () => {
      const groupId = selectedGroupByTrack[trackId];
      const submissionIds = selectedPosterIdsByTrack[trackId] || [];

      if (!groupId || submissionIds.length === 0) {
        throw new Error("Select a group and at least one paper");
      }

      const response = await fetch(`/api/presentations/poster-groups/${groupId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ submissionIds }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error || "Unable to add papers");
      }

      setSelectedPosterIdsByTrack((prev) => ({ ...prev, [trackId]: [] }));
      await refreshPlanner();
      setMessage("Papers added to the group");
    });
  }

  async function removeMember(groupId: string, memberId: string) {
    await runAction(`remove-member-${memberId}`, async () => {
      const response = await fetch(
        `/api/presentations/poster-groups/${groupId}/members/${memberId}`,
        { method: "DELETE" }
      );

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error || "Unable to remove paper");
      }

      await refreshPlanner();
      setMessage("Paper removed from the group");
    });
  }

  async function saveJudges(groupId: string) {
    await runAction(`judges-${groupId}`, async () => {
      const judgeIds = (judgeDrafts[groupId] || []).filter(Boolean);
      if (new Set(judgeIds).size !== judgeIds.length) {
        throw new Error("Judges must be unique");
      }

      const response = await fetch(`/api/presentations/poster-groups/${groupId}/judges`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ judgeIds }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error || "Unable to save judges");
      }

      await refreshPlanner();
      setMessage("Group judges updated");
    });
  }

  async function addSlot(groupId: string) {
    await runAction(`slot-${groupId}`, async () => {
      const draft = slotDrafts[groupId];
      const template = sessionSettings.slotTemplates.find((slot) => slot.id === draft?.templateId);
      if (!template) {
        throw new Error("Select one slot");
      }

      const response = await fetch(`/api/presentations/poster-groups/${groupId}/slots`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          startsAt: template.startsAt,
          endsAt: template.endsAt,
          judgeId: draft.judgeId || null,
          status: draft.status,
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error || "Unable to add slot");
      }

      await refreshPlanner();
      setMessage("Slot added");
    });
  }

  async function deleteSlot(groupId: string, slotId: string) {
    await runAction(`delete-slot-${slotId}`, async () => {
      const response = await fetch(`/api/presentations/poster-groups/${groupId}/slots/${slotId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error || "Unable to delete slot");
      }

      await refreshPlanner();
      setMessage("Slot deleted");
    });
  }

  const sessionRoomId = `${plannerId}-session-room`;
  const showAuthorView = mode === "author" || mode === "hybrid";
  const showCommitteeView = mode === "committee" || mode === "hybrid";

  // ──────────────── AUTHOR VIEW ────────────────
  if (mode === "author") {
    return (
      <div className="space-y-6">
        <SectionTitle
          title="Poster Presentation"
          subtitle="Your poster group, judges, and planned presentation slots"
        />
        <RubricManager criteria={rubricCriteria} />
        {authorGroups.length === 0 ? (
          <EmptyState
            icon={<FolderKanban className="h-12 w-12" />}
            title="No poster group yet"
            body="You will see your poster group here once the organizers finish planning."
          />
        ) : (
          authorGroups.map((group) => (
            <Card key={group.membershipId}>
              <CardHeader>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge>{group.paperCode || "NO-CODE"}</Badge>
                  <Badge tone="info">{group.trackName}</Badge>
                  <Badge tone="success">{group.groupName}</Badge>
                </div>
                <h3 className="text-lg font-semibold text-ink">{group.title}</h3>
                <p className="text-sm text-ink-muted">
                  Room: {group.room || "TBA"} | Judges: {group.judges.join(", ") || "TBA"}
                </p>
              </CardHeader>
              <CardBody className="space-y-3">
                {group.slots.length === 0 ? (
                  <p className="text-sm text-ink-muted">Your presentation slots have not been scheduled yet.</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {group.slots.map((slot, i) => (
                      <div key={slot.id} className="flex items-center gap-2 rounded-xl border border-border/60 bg-surface-alt px-3 py-2">
                        <Badge tone="info">{formatSlotCode(i)}</Badge>
                        <span className="text-sm font-medium text-ink">
                          {formatTime(slot.startsAt)} - {formatTime(slot.endsAt)}
                        </span>
                        <Badge tone={slot.status === "COMPLETED" ? "success" : slot.status === "CONFIRMED" ? "info" : "neutral"}>
                          {slot.status}
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
        <SectionTitle
          title="Poster Review Queue"
          subtitle="Groups and slots assigned to you for poster review"
        />
        <RubricManager criteria={rubricCriteria} />
        {committeeGroups.length === 0 ? (
          <EmptyState
            icon={<Users className="h-12 w-12" />}
            title="No poster groups assigned"
            body="Your assigned poster groups will appear here once scheduling is ready."
          />
        ) : (
          committeeGroups.map((group) => (
            <Card key={`${group.groupId}-${group.judgeOrder}`}>
              <CardHeader>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone="info">{group.trackName}</Badge>
                  <Badge tone="success">{group.groupName}</Badge>
                  <Badge>Judge {group.judgeOrder}</Badge>
                </div>
                <p className="text-sm text-ink-muted">Room: {group.room || "TBA"}</p>
              </CardHeader>
              <CardBody className="space-y-4">
                <div className="space-y-2">
                  {group.members.map((member) => (
                    <div key={member.submissionId} className="rounded-xl border border-border/60 bg-surface-alt p-3">
                      <p className="text-sm font-medium text-ink">
                        {member.paperCode || "NO-CODE"} · {member.title}
                      </p>
                      <p className="text-xs text-ink-muted">{member.authorName}</p>
                    </div>
                  ))}
                </div>
                <div className="flex flex-wrap gap-2">
                  {group.slots.length === 0 ? (
                    <p className="text-sm text-ink-muted">No slots planned for this group yet.</p>
                  ) : (
                    group.slots.map((slot, i) => (
                      <div key={slot.id} className="flex items-center gap-2 rounded-xl border border-border/60 bg-surface-alt px-3 py-2">
                        <Badge tone="info">{formatSlotCode(i)}</Badge>
                        <span className="text-sm font-medium text-ink">
                          {formatTime(slot.startsAt)} - {formatTime(slot.endsAt)}
                        </span>
                        <Badge tone={slot.status === "COMPLETED" ? "success" : slot.status === "CONFIRMED" ? "info" : "neutral"}>
                          {slot.status}
                        </Badge>
                      </div>
                    ))
                  )}
                </div>
              </CardBody>
            </Card>
          ))
        )}
      </div>
    );
  }

  if (mode === "hybrid") {
    return (
      <div className="space-y-8">
        <RubricManager criteria={rubricCriteria} />
        {showAuthorView && (
          <div className="space-y-6">
            <SectionTitle
              title="Poster Presentation"
              subtitle="Your poster group, judges, and planned presentation slots"
            />
            {authorGroups.length === 0 ? (
              <EmptyState
                icon={<FolderKanban className="h-12 w-12" />}
                title="No poster group yet"
                body="You will see your poster group here once the organizers finish planning."
              />
            ) : (
              authorGroups.map((group) => (
                <Card key={group.membershipId}>
                  <CardHeader>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge>{group.paperCode || "NO-CODE"}</Badge>
                      <Badge tone="info">{group.trackName}</Badge>
                      <Badge tone="success">{group.groupName}</Badge>
                    </div>
                    <h3 className="text-lg font-semibold text-ink">{group.title}</h3>
                    <p className="text-sm text-ink-muted">
                      Room: {group.room || "TBA"} | Judges: {group.judges.join(", ") || "TBA"}
                    </p>
                  </CardHeader>
                  <CardBody className="space-y-3">
                    {group.slots.length === 0 ? (
                      <p className="text-sm text-ink-muted">Your presentation slots have not been scheduled yet.</p>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {group.slots.map((slot, i) => (
                          <div key={slot.id} className="flex items-center gap-2 rounded-xl border border-border/60 bg-surface-alt px-3 py-2">
                            <Badge tone="info">{formatSlotCode(i)}</Badge>
                            <span className="text-sm font-medium text-ink">
                              {formatTime(slot.startsAt)} - {formatTime(slot.endsAt)}
                            </span>
                            <Badge tone={slot.status === "COMPLETED" ? "success" : slot.status === "CONFIRMED" ? "info" : "neutral"}>
                              {slot.status}
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
        )}

        {showCommitteeView && (
          <div className="space-y-6">
            <SectionTitle
              title="Poster Review Queue"
              subtitle="Groups and slots assigned to you for poster review"
            />
            {committeeGroups.length === 0 ? (
              <EmptyState
                icon={<Users className="h-12 w-12" />}
                title="No poster groups assigned"
                body="Your assigned poster groups will appear here once scheduling is ready."
              />
            ) : (
              committeeGroups.map((group) => (
                <Card key={`${group.groupId}-${group.judgeOrder}`}>
                  <CardHeader>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone="info">{group.trackName}</Badge>
                      <Badge tone="success">{group.groupName}</Badge>
                      <Badge>Judge {group.judgeOrder}</Badge>
                    </div>
                    <p className="text-sm text-ink-muted">Room: {group.room || "TBA"}</p>
                  </CardHeader>
                  <CardBody className="space-y-4">
                    <div className="space-y-2">
                      {group.members.map((member) => (
                        <div key={member.submissionId} className="rounded-xl border border-border/60 bg-surface-alt p-3">
                          <p className="text-sm font-medium text-ink">
                            {member.paperCode || "NO-CODE"} · {member.title}
                          </p>
                          <p className="text-xs text-ink-muted">{member.authorName}</p>
                        </div>
                      ))}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {group.slots.length === 0 ? (
                        <p className="text-sm text-ink-muted">No slots planned for this group yet.</p>
                      ) : (
                        group.slots.map((slot, i) => (
                          <div key={slot.id} className="flex items-center gap-2 rounded-xl border border-border/60 bg-surface-alt px-3 py-2">
                            <Badge tone="info">{formatSlotCode(i)}</Badge>
                            <span className="text-sm font-medium text-ink">
                              {formatTime(slot.startsAt)} - {formatTime(slot.endsAt)}
                            </span>
                            <Badge tone={slot.status === "COMPLETED" ? "success" : slot.status === "CONFIRMED" ? "info" : "neutral"}>
                              {slot.status}
                            </Badge>
                          </div>
                        ))
                      )}
                    </div>
                  </CardBody>
                </Card>
              ))
            )}
          </div>
        )}
      </div>
    );
  }

  // ──────────────── ADMIN VIEW ────────────────
  return (
    <div className="space-y-6">
      <SectionTitle
        title="Poster Group Planner"
        subtitle="Set up shared slots, group papers by track, assign judges, and schedule presentations."
      />

      {message && <Alert tone={messageTone}>{message}</Alert>}

      <RubricManager
        criteria={rubricCriteria}
        canEdit={canEditCriteria}
        onSave={handleSaveCriteria}
      />

      {/* ── Summary Stats ── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
        <SummaryStatCard
          label="Poster groups"
          value={plannerStats.totalGroups}
          icon={<FolderKanban className="h-5 w-5" />}
          color="blue"
        />
        <SummaryStatCard
          label="Ready groups"
          value={plannerStats.readyGroups}
          icon={<Check className="h-5 w-5" />}
          color="emerald"
        />
        <SummaryStatCard
          label="Need follow-up"
          value={plannerStats.incompleteGroups}
          icon={<CircleAlert className="h-5 w-5" />}
          color="amber"
        />
        <SummaryStatCard
          label="Ungrouped papers"
          value={plannerStats.ungroupedPosters}
          icon={<Presentation className="h-5 w-5" />}
          color="red"
        />
        <SummaryStatCard
          label="Shared slots"
          value={plannerStats.sharedSlots}
          icon={<CalendarRange className="h-5 w-5" />}
          color="indigo"
        />
      </div>

      {/* ── Session Settings: Room + Slots (compact top section) ── */}
      <Card>
        <CardHeader>
          <h3 className="flex items-center gap-2 text-sm font-semibold text-ink">
            <MapPin className="h-4 w-4 text-ink-muted" />
            Session Settings
          </h3>
          <p className="text-sm text-ink-muted">
            Shared room and time slots (each slot = {SLOT_DURATION_MINUTES} min). All groups share these settings.
          </p>
        </CardHeader>
        <CardBody className="space-y-4">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_2fr]">
            {/* Room */}
            <Field label="Room" htmlFor={sessionRoomId}>
              <Input
                id={sessionRoomId}
                value={sessionDraft.room}
                onChange={(event) =>
                  setSessionDraft((prev) => ({
                    ...prev,
                    room: event.target.value,
                  }))
                }
                placeholder="e.g. Poster Hall A"
                name="sharedRoom"
                autoComplete="off"
              />
            </Field>

            {/* Slot grid */}
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
                Time Slots ({SLOT_DURATION_MINUTES} min each)
              </p>

              {sessionDraft.slotTemplates.length === 0 ? (
                <p className="text-sm text-ink-muted">No slots yet. Add a start time below.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {sessionDraft.slotTemplates.map((slot, index) => (
                    <div
                      key={slot.id}
                      className="group flex items-center gap-1.5 rounded-lg border border-border/60 bg-surface-alt px-2.5 py-1.5"
                    >
                      <span className="rounded bg-brand-100 px-1.5 py-0.5 text-xs font-bold text-brand-700">
                        {formatSlotCode(index)}
                      </span>
                      <span className="text-sm font-medium text-ink">
                        {formatTime(slot.startsAt)} - {formatTime(slot.endsAt)}
                      </span>
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
                <Field label="Add slot (start time)" htmlFor={`${plannerId}-new-slot-time`}>
                  <Input
                    id={`${plannerId}-new-slot-time`}
                    type="time"
                    value={newSlotTime}
                    onChange={(event) => setNewSlotTime(event.target.value)}
                    name="newSlotTime"
                  />
                </Field>
                <Button size="sm" variant="outline" onClick={addSessionSlotTemplate}>
                  <Plus className="h-3.5 w-3.5" />
                  Add
                </Button>
              </div>
            </div>
          </div>

          <div className="flex justify-end border-t border-border/40 pt-3">
            <Button
              size="sm"
              onClick={saveSessionSettings}
              loading={savingKey === "session-settings"}
            >
              Save session settings
            </Button>
          </div>
        </CardBody>
      </Card>

      {/* ── Two-column layout: left = grouping, right = group details ── */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(320px,0.9fr)_minmax(0,1.4fr)]">
        {/* ── LEFT: Group papers by track ── */}
        <div className="space-y-4">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-ink">
            <LayoutPanelTop className="h-4 w-4 text-ink-muted" />
            Group Accepted Posters
          </h3>

          {trackSections.length === 0 ? (
            <EmptyState
              icon={<FolderKanban className="h-10 w-10" />}
              title="No poster records yet"
              body="Accepted poster papers will appear here."
            />
          ) : (
            trackSections.map((track) => {
              const trackGroups = groups.filter((group) => group.track.id === track.id);
              const trackPosters = ungroupedPosters.filter((paper) => paper.track?.id === track.id);

              return (
                <Collapsible
                  key={track.id}
                  title={`${track.name} · ${trackPosters.length} ungrouped`}
                  defaultOpen={trackPosters.length > 0}
                >
                  <div className="space-y-4 rounded-2xl border border-border/60 p-4">
                    {/* Create group */}
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
                      <Input
                        id={`${plannerId}-new-group-${track.id}`}
                        value={newGroupNameByTrack[track.id] || ""}
                        onChange={(event) =>
                          setNewGroupNameByTrack((prev) => ({
                            ...prev,
                            [track.id]: event.target.value,
                          }))
                        }
                        placeholder={`New ${track.name} group name`}
                        aria-label={`Create a new group for ${track.name}`}
                        name={`newGroup-${track.id}`}
                        autoComplete="off"
                      />
                      <Button
                        size="sm"
                        onClick={() => createGroup(track.id)}
                        loading={savingKey === `create-${track.id}`}
                      >
                        <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                        Create
                      </Button>
                    </div>

                    {/* Group badges */}
                    <div className="flex flex-wrap gap-2">
                      {trackGroups.length === 0 ? (
                        <Badge tone="warning">No groups yet</Badge>
                      ) : (
                        trackGroups.map((group) => (
                          <Badge key={group.id} tone={getGroupTone(group)}>
                            {group.name} · {getGroupLabel(group)}
                          </Badge>
                        ))
                      )}
                    </div>

                    {/* Ungrouped papers */}
                    {trackPosters.length === 0 ? (
                      <p className="text-sm text-ink-muted">All papers in this track are grouped.</p>
                    ) : (
                      <>
                        <Field label="Move to group" htmlFor={`${plannerId}-target-group-${track.id}`}>
                          <Select
                            id={`${plannerId}-target-group-${track.id}`}
                            value={selectedGroupByTrack[track.id] || ""}
                            onChange={(event) =>
                              setSelectedGroupByTrack((prev) => ({
                                ...prev,
                                [track.id]: event.target.value,
                              }))
                            }
                            name={`targetGroup-${track.id}`}
                          >
                            <option value="">Select a group</option>
                            {trackGroups.map((group) => (
                              <option key={group.id} value={group.id}>
                                {group.name}
                              </option>
                            ))}
                          </Select>
                        </Field>

                        <div className="space-y-2">
                          {trackPosters.map((paper) => {
                            const selected = (selectedPosterIdsByTrack[track.id] || []).includes(
                              paper.submissionId
                            );

                            return (
                              <label
                                key={paper.submissionId}
                                className={`flex items-start gap-3 rounded-xl border px-3 py-3 transition-colors ${
                                  selected ? "border-brand-300 bg-brand-50/40" : "border-border/60 bg-white"
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={selected}
                                  onChange={(event) => {
                                    setSelectedPosterIdsByTrack((prev) => {
                                      const current = prev[track.id] || [];
                                      return {
                                        ...prev,
                                        [track.id]: event.target.checked
                                          ? [...current, paper.submissionId]
                                          : current.filter((id) => id !== paper.submissionId),
                                      };
                                    });
                                  }}
                                />
                                <div className="min-w-0 flex-1">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <Badge>{paper.paperCode || "NO-CODE"}</Badge>
                                    <p className="text-sm font-medium text-ink">{paper.title}</p>
                                  </div>
                                  <p className="mt-1 text-xs text-ink-muted">{paper.author.name}</p>
                                </div>
                              </label>
                            );
                          })}
                        </div>

                        <div className="flex justify-end">
                          <Button
                            size="sm"
                            onClick={() => addSelectedPosters(track.id)}
                            loading={savingKey === `members-${track.id}`}
                          >
                            <Check className="h-3.5 w-3.5" aria-hidden="true" />
                            Add selected
                          </Button>
                        </div>
                      </>
                    )}
                  </div>
                </Collapsible>
              );
            })
          )}
        </div>

        {/* ── RIGHT: Group detail cards ── */}
        <div className="space-y-5">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-ink">
            <Users className="h-4 w-4 text-ink-muted" />
            Group Details
          </h3>

          {groups.length === 0 ? (
            <EmptyState
              icon={<FolderKanban className="h-12 w-12" />}
              title="No poster groups yet"
              body="Create your first track-based poster group from the left panel."
            />
          ) : (
            groups.map((group) => {
              const availableCommitteeUsers = initialCommitteeUsers.filter(
                (committeeUser) =>
                  committeeUser.trackId === null || committeeUser.trackId === group.track.id
              );
              const judgeDraft = judgeDrafts[group.id] || ["", "", ""];
              const slotDraft = slotDrafts[group.id] || {
                templateId: "",
                judgeId: "",
                status: "PLANNED",
              };

              return (
                <Card key={group.id}>
                  {/* ── Group Header with inline stats ── */}
                  <CardHeader>
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge tone="info">{group.track.name}</Badge>
                          <Badge tone={getGroupTone(group)}>{getGroupLabel(group)}</Badge>
                        </div>
                        <h3 className="text-lg font-semibold text-ink">{group.name}</h3>
                      </div>
                      <div className="flex gap-4 rounded-xl bg-surface-alt px-4 py-2 text-center">
                        <div>
                          <p className="text-[11px] uppercase tracking-wide text-ink-muted">Papers</p>
                          <p className="text-sm font-bold text-ink">{group.members.length}</p>
                        </div>
                        <div>
                          <p className="text-[11px] uppercase tracking-wide text-ink-muted">Judges</p>
                          <p className="text-sm font-bold text-ink">{group.judges.length}/3</p>
                        </div>
                        <div>
                          <p className="text-[11px] uppercase tracking-wide text-ink-muted">Slots</p>
                          <p className="text-sm font-bold text-ink">{group.slots.length}</p>
                        </div>
                        <div>
                          <p className="text-[11px] uppercase tracking-wide text-ink-muted">Room</p>
                          <p className="text-sm font-bold text-ink">{sessionSettings.room || "—"}</p>
                        </div>
                      </div>
                    </div>
                  </CardHeader>

                  <CardBody className="space-y-5">
                    {/* ── Group name edit ── */}
                    <div className="flex items-end gap-3">
                      <Field label="Group name" htmlFor={`${plannerId}-group-name-${group.id}`} className="flex-1">
                        <Input
                          id={`${plannerId}-group-name-${group.id}`}
                          value={groupDrafts[group.id]?.name || ""}
                          onChange={(event) =>
                            setGroupDrafts((prev) => ({
                              ...prev,
                              [group.id]: {
                                ...prev[group.id],
                                name: event.target.value,
                              },
                            }))
                          }
                          name={`groupName-${group.id}`}
                          autoComplete="off"
                        />
                      </Field>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => saveGroup(group.id)}
                        loading={savingKey === `group-${group.id}`}
                      >
                        Rename
                      </Button>
                    </div>

                    {/* ── Papers in group ── */}
                    <section className="space-y-2 rounded-2xl border border-border/60 p-4">
                      <h4 className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
                        Papers ({group.members.length})
                      </h4>
                      {group.members.length === 0 ? (
                        <p className="text-sm text-ink-muted">No papers in this group yet.</p>
                      ) : (
                        <div className="space-y-1.5">
                          {group.members.map((member) => (
                            <div
                              key={member.id}
                              className="flex items-center justify-between gap-3 rounded-lg border border-border/40 bg-surface-alt px-3 py-2"
                            >
                              <div className="flex min-w-0 flex-1 items-center gap-2">
                                <Badge>{member.paperCode || "NO-CODE"}</Badge>
                                <span className="truncate text-sm text-ink">{member.title}</span>
                                <span className="shrink-0 text-xs text-ink-muted">({member.authorName})</span>
                              </div>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => removeMember(group.id, member.id)}
                                loading={savingKey === `remove-member-${member.id}`}
                                aria-label={`Remove ${member.paperCode || member.title}`}
                              >
                                <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}
                    </section>

                    {/* ── Judges ── */}
                    <section className="space-y-3 rounded-2xl border border-border/60 p-4">
                      <h4 className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
                        Judges ({group.judges.length}/3)
                      </h4>
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                        {[0, 1, 2].map((index) => (
                          <Field
                            key={index}
                            label={`Judge ${index + 1}`}
                            htmlFor={`${plannerId}-judge-${group.id}-${index + 1}`}
                          >
                            <Select
                              id={`${plannerId}-judge-${group.id}-${index + 1}`}
                              value={judgeDraft[index] || ""}
                              onChange={(event) =>
                                setJudgeDrafts((prev) => {
                                  const current = [...(prev[group.id] || ["", "", ""])];
                                  current[index] = event.target.value;
                                  return { ...prev, [group.id]: current };
                                })
                              }
                              name={`judge-${group.id}-${index + 1}`}
                            >
                              <option value="">Select judge</option>
                              {availableCommitteeUsers.map((committeeUser) => (
                                <option key={committeeUser.id} value={committeeUser.id}>
                                  {committeeUser.name}
                                </option>
                              ))}
                            </Select>
                          </Field>
                        ))}
                      </div>
                      <div className="flex justify-end">
                        <Button
                          size="sm"
                          onClick={() => saveJudges(group.id)}
                          loading={savingKey === `judges-${group.id}`}
                        >
                          Save judges
                        </Button>
                      </div>
                    </section>

                    {/* ── Slots ── */}
                    <section className="space-y-3 rounded-2xl border border-border/60 p-4">
                      <div className="flex items-center justify-between">
                        <h4 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-ink-muted">
                          <Clock className="h-3.5 w-3.5" />
                          Slots ({group.slots.length})
                        </h4>
                      </div>

                      {sessionSettings.slotTemplates.length === 0 && (
                        <Alert tone="danger">
                          Add shared slots in Session Settings first.
                        </Alert>
                      )}

                      {group.slots.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {group.slots.map((slot) => {
                            const templateIndex = sessionSettings.slotTemplates.findIndex(
                              (t) => t.startsAt === slot.startsAt && t.endsAt === slot.endsAt
                            );
                            const slotCode = templateIndex >= 0 ? formatSlotCode(templateIndex) : "??";
                            const judgeName = slot.judgeId
                              ? group.judges.find((j) => j.judge.id === slot.judgeId)?.judge.name || "Assigned"
                              : "Unassigned";

                            return (
                              <div
                                key={slot.id}
                                className="group flex items-center gap-2 rounded-lg border border-border/60 bg-surface-alt px-3 py-2"
                              >
                                <span className="rounded bg-brand-100 px-1.5 py-0.5 text-xs font-bold text-brand-700">
                                  {slotCode}
                                </span>
                                <span className="text-sm font-medium text-ink">
                                  {formatTime(slot.startsAt)} - {formatTime(slot.endsAt)}
                                </span>
                                <Badge tone={slot.status === "COMPLETED" ? "success" : slot.status === "CONFIRMED" ? "info" : "neutral"}>
                                  {slot.status}
                                </Badge>
                                <span className="text-xs text-ink-muted">{judgeName}</span>
                                <button
                                  type="button"
                                  onClick={() => deleteSlot(group.id, slot.id)}
                                  className="ml-1 rounded p-0.5 text-ink-muted opacity-0 transition-opacity hover:text-red-500 group-hover:opacity-100"
                                  aria-label={`Delete slot ${slotCode}`}
                                  disabled={savingKey === `delete-slot-${slot.id}`}
                                >
                                  <Trash2 className="h-3 w-3" />
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {sessionSettings.slotTemplates.length > 0 && (
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                          <Field label="Slot" htmlFor={`${plannerId}-slot-template-${group.id}`}>
                            <Select
                              id={`${plannerId}-slot-template-${group.id}`}
                              value={slotDraft.templateId}
                              onChange={(event) =>
                                setSlotDrafts((prev) => ({
                                  ...prev,
                                  [group.id]: { ...slotDraft, templateId: event.target.value },
                                }))
                              }
                              name={`slotTemplate-${group.id}`}
                            >
                              <option value="">Select slot</option>
                              {sessionSettings.slotTemplates.map((slot, index) => {
                                const alreadyUsed = group.slots.some(
                                  (groupSlot) =>
                                    groupSlot.startsAt === slot.startsAt &&
                                    groupSlot.endsAt === slot.endsAt
                                );

                                return (
                                  <option key={slot.id} value={slot.id} disabled={alreadyUsed}>
                                    [{formatSlotCode(index)}] {formatTime(slot.startsAt)} - {formatTime(slot.endsAt)}
                                    {alreadyUsed ? " (used)" : ""}
                                  </option>
                                );
                              })}
                            </Select>
                          </Field>
                          <Field label="Judge" htmlFor={`${plannerId}-slot-judge-${group.id}`}>
                            <Select
                              id={`${plannerId}-slot-judge-${group.id}`}
                              value={slotDraft.judgeId}
                              onChange={(event) =>
                                setSlotDrafts((prev) => ({
                                  ...prev,
                                  [group.id]: { ...slotDraft, judgeId: event.target.value },
                                }))
                              }
                              name={`slotJudge-${group.id}`}
                            >
                              <option value="">Unassigned</option>
                              {group.judges.map((judge) => (
                                <option key={judge.id} value={judge.judge.id}>
                                  {judge.judge.name}
                                </option>
                              ))}
                            </Select>
                          </Field>
                          <Field label="Status" htmlFor={`${plannerId}-slot-status-${group.id}`}>
                            <Select
                              id={`${plannerId}-slot-status-${group.id}`}
                              value={slotDraft.status}
                              onChange={(event) =>
                                setSlotDrafts((prev) => ({
                                  ...prev,
                                  [group.id]: { ...slotDraft, status: event.target.value },
                                }))
                              }
                              name={`slotStatus-${group.id}`}
                            >
                              <option value="PLANNED">Planned</option>
                              <option value="CONFIRMED">Confirmed</option>
                              <option value="COMPLETED">Completed</option>
                            </Select>
                          </Field>
                        </div>
                      )}

                      {sessionSettings.slotTemplates.length > 0 && (
                        <div className="flex justify-end">
                          <Button
                            size="sm"
                            onClick={() => addSlot(group.id)}
                            loading={savingKey === `slot-${group.id}`}
                          >
                            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                            Add slot
                          </Button>
                        </div>
                      )}
                    </section>
                  </CardBody>
                </Card>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
