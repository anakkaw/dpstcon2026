"use client";

import { useMemo, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Collapsible } from "@/components/ui/collapsible";
import { EmptyState } from "@/components/ui/empty-state";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { SectionTitle } from "@/components/ui/section-title";
import { Select } from "@/components/ui/select";
import { SummaryStatCard } from "@/components/ui/summary-stat-card";
import { formatDateTime } from "@/lib/utils";
import type {
  PosterPlannerGroup,
  PosterPlannerPaper,
} from "@/server/poster-planner-data";
import {
  CalendarRange,
  Check,
  CircleAlert,
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
  mode: "admin" | "author" | "committee";
  initialGroups?: PosterPlannerGroup[];
  initialUngroupedPosters?: PosterPlannerPaper[];
  initialCommitteeUsers?: AdminCommitteeUser[];
  authorGroups?: AuthorPosterGroup[];
  committeeGroups?: CommitteePosterGroup[];
}

type MessageTone = "success" | "danger";

export function PosterPlannerClient({
  mode,
  initialGroups = [],
  initialUngroupedPosters = [],
  initialCommitteeUsers = [],
  authorGroups = [],
  committeeGroups = [],
}: PosterPlannerClientProps) {
  const [groups, setGroups] = useState(initialGroups);
  const [ungroupedPosters, setUngroupedPosters] = useState(initialUngroupedPosters);
  const [message, setMessage] = useState("");
  const [messageTone, setMessageTone] = useState<MessageTone>("success");
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [groupDrafts, setGroupDrafts] = useState<Record<string, { name: string; room: string }>>(
    Object.fromEntries(
      initialGroups.map((group) => [group.id, { name: group.name, room: group.room ?? "" }])
    )
  );
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
    Record<string, { startsAt: string; endsAt: string; judgeId: string; status: string }>
  >(
    Object.fromEntries(
      initialGroups.map((group) => [
        group.id,
        { startsAt: "", endsAt: "", judgeId: "", status: "PLANNED" },
      ])
    )
  );

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
    const totalSlots = groups.reduce((sum, group) => sum + group.slots.length, 0);

    return {
      totalGroups: groups.length,
      readyGroups,
      incompleteGroups,
      ungroupedPosters: ungroupedPosters.length,
      totalSlots,
    };
  }, [groups, ungroupedPosters]);

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
    setGroups(data.groups || []);
    setUngroupedPosters(data.ungroupedPosters || []);
    setGroupDrafts(
      Object.fromEntries(
        (data.groups || []).map((group: PosterPlannerGroup) => [
          group.id,
          { name: group.name, room: group.room ?? "" },
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
          { startsAt: "", endsAt: "", judgeId: "", status: "PLANNED" },
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
      if (!draft?.startsAt || !draft?.endsAt) {
        throw new Error("Start and end time are required");
      }

      const response = await fetch(`/api/presentations/poster-groups/${groupId}/slots`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          startsAt: draft.startsAt,
          endsAt: draft.endsAt,
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

  if (mode === "author") {
    return (
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
                  group.slots.map((slot) => (
                    <div key={slot.id} className="rounded-xl border border-border/60 bg-surface-alt p-4">
                      <p className="text-sm font-medium text-ink">
                        {formatDateTime(slot.startsAt)} - {formatDateTime(slot.endsAt)}
                      </p>
                      <p className="mt-1 text-xs text-ink-muted">Status: {slot.status}</p>
                    </div>
                  ))
                )}
              </CardBody>
            </Card>
          ))
        )}
      </div>
    );
  }

  if (mode === "committee") {
    return (
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
                <div className="space-y-2">
                  {group.slots.length === 0 ? (
                    <p className="text-sm text-ink-muted">No slots planned for this group yet.</p>
                  ) : (
                    group.slots.map((slot) => (
                      <div key={slot.id} className="rounded-xl border border-border/60 bg-surface-alt p-3">
                        <p className="text-sm font-medium text-ink">
                          {formatDateTime(slot.startsAt)} - {formatDateTime(slot.endsAt)}
                        </p>
                        <p className="text-xs text-ink-muted">Status: {slot.status}</p>
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

  return (
    <div className="space-y-6">
      <SectionTitle
        title="Poster Group Planner"
        subtitle="Set up poster groups by track, assign three judges per group, and plan flexible time slots without losing track of ungrouped papers."
      />

      {message && <Alert tone={messageTone}>{message}</Alert>}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
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
          label="Planned slots"
          value={plannerStats.totalSlots}
          icon={<CalendarRange className="h-5 w-5" />}
          color="indigo"
        />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(320px,0.9fr)_minmax(0,1.4fr)]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <div className="space-y-1">
                <h3 className="flex items-center gap-2 text-sm font-semibold text-ink">
                  <LayoutPanelTop className="h-4 w-4 text-ink-muted" />
                  Step 1: Group accepted posters
                </h3>
                <p className="text-sm text-ink-muted">
                  Create a group for each track, then move accepted papers into the correct group before assigning judges.
                </p>
              </div>
            </CardHeader>
            <CardBody className="space-y-6">
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
                        <div className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
                          <Input
                            value={newGroupNameByTrack[track.id] || ""}
                            onChange={(event) =>
                              setNewGroupNameByTrack((prev) => ({
                                ...prev,
                                [track.id]: event.target.value,
                              }))
                            }
                            placeholder={`Create a new ${track.name} group`}
                          />
                          <Button
                            size="sm"
                            onClick={() => createGroup(track.id)}
                            loading={savingKey === `create-${track.id}`}
                          >
                            <Plus className="h-3.5 w-3.5" />
                            Create group
                          </Button>
                        </div>

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

                        {trackPosters.length === 0 ? (
                          <p className="text-sm text-ink-muted">All accepted papers in this track are already grouped.</p>
                        ) : (
                          <>
                            <Field label="Move selected papers to">
                              <Select
                                value={selectedGroupByTrack[track.id] || ""}
                                onChange={(event) =>
                                  setSelectedGroupByTrack((prev) => ({
                                    ...prev,
                                    [track.id]: event.target.value,
                                  }))
                                }
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
                                <Check className="h-3.5 w-3.5" />
                                Add selected papers
                              </Button>
                            </div>
                          </>
                        )}
                      </div>
                    </Collapsible>
                  );
                })
              )}
            </CardBody>
          </Card>
        </div>

        <div className="space-y-6">
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
                startsAt: "",
                endsAt: "",
                judgeId: "",
                status: "PLANNED",
              };

              return (
                <Card key={group.id}>
                  <CardHeader>
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge tone="info">{group.track.name}</Badge>
                          <Badge tone={getGroupTone(group)}>{getGroupLabel(group)}</Badge>
                        </div>
                        <h3 className="text-lg font-semibold text-ink">{group.name}</h3>
                        <div className="flex flex-wrap gap-2 text-xs text-ink-muted">
                          <span>{group.members.length} paper(s)</span>
                          <span>{group.judges.length}/3 judges</span>
                          <span>{group.slots.length} slot(s)</span>
                          <span className="inline-flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {group.room || "Room not set"}
                          </span>
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-2 rounded-2xl bg-surface-alt p-3 text-center">
                        <div>
                          <p className="text-[11px] uppercase tracking-wide text-ink-muted">Papers</p>
                          <p className="mt-1 text-sm font-semibold text-ink">{group.members.length}</p>
                        </div>
                        <div>
                          <p className="text-[11px] uppercase tracking-wide text-ink-muted">Judges</p>
                          <p className="mt-1 text-sm font-semibold text-ink">{group.judges.length}</p>
                        </div>
                        <div>
                          <p className="text-[11px] uppercase tracking-wide text-ink-muted">Slots</p>
                          <p className="mt-1 text-sm font-semibold text-ink">{group.slots.length}</p>
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardBody className="space-y-6">
                    <section className="space-y-3 rounded-2xl border border-border/60 p-4">
                      <div className="space-y-1">
                        <h4 className="text-sm font-semibold text-ink">Step 2: Group setup</h4>
                        <p className="text-sm text-ink-muted">Name the group clearly and set the room before assigning judges.</p>
                      </div>
                      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                        <Field label="Group name">
                          <Input
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
                          />
                        </Field>
                        <Field label="Room">
                          <Input
                            value={groupDrafts[group.id]?.room || ""}
                            onChange={(event) =>
                              setGroupDrafts((prev) => ({
                                ...prev,
                                [group.id]: {
                                  ...prev[group.id],
                                  room: event.target.value,
                                },
                              }))
                            }
                            placeholder="e.g. Poster Hall A"
                          />
                        </Field>
                      </div>
                      <div className="flex justify-end">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => saveGroup(group.id)}
                          loading={savingKey === `group-${group.id}`}
                        >
                          Save group details
                        </Button>
                      </div>
                    </section>

                    <section className="space-y-3 rounded-2xl border border-border/60 p-4">
                      <div className="space-y-1">
                        <h4 className="text-sm font-semibold text-ink">Step 3: Review papers in this group</h4>
                        <p className="text-sm text-ink-muted">Quickly confirm that the right accepted papers are grouped together before continuing.</p>
                      </div>
                      {group.members.length === 0 ? (
                        <p className="text-sm text-ink-muted">No papers in this group yet.</p>
                      ) : (
                        <div className="space-y-2">
                          {group.members.map((member) => (
                            <div
                              key={member.id}
                              className="flex items-start justify-between gap-3 rounded-xl border border-border/60 bg-surface-alt p-3"
                            >
                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <Badge>{member.paperCode || "NO-CODE"}</Badge>
                                  <p className="text-sm font-medium text-ink">{member.title}</p>
                                </div>
                                <p className="text-xs text-ink-muted">{member.authorName}</p>
                              </div>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => removeMember(group.id, member.id)}
                                loading={savingKey === `remove-member-${member.id}`}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}
                    </section>

                    <section className="space-y-3 rounded-2xl border border-border/60 p-4">
                      <div className="space-y-1">
                        <h4 className="text-sm font-semibold text-ink">Step 4: Assign three judges</h4>
                        <p className="text-sm text-ink-muted">Each group needs three different judges before slot planning is complete.</p>
                      </div>
                      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                        {[0, 1, 2].map((index) => (
                          <Field key={index} label={`Judge ${index + 1}`}>
                            <Select
                              value={judgeDraft[index] || ""}
                              onChange={(event) =>
                                setJudgeDrafts((prev) => {
                                  const current = [...(prev[group.id] || ["", "", ""])];
                                  current[index] = event.target.value;
                                  return { ...prev, [group.id]: current };
                                })
                              }
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

                    <section className="space-y-3 rounded-2xl border border-border/60 p-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <CalendarRange className="h-4 w-4 text-ink-muted" />
                          <h4 className="text-sm font-semibold text-ink">Step 5: Plan time slots</h4>
                        </div>
                        <p className="text-sm text-ink-muted">Add as many slots as this group needs. You can attach a specific judge per slot or leave it unassigned first.</p>
                      </div>
                      {group.slots.length === 0 ? (
                        <p className="text-sm text-ink-muted">No slots added for this group yet.</p>
                      ) : (
                        <div className="space-y-2">
                          {group.slots.map((slot) => (
                            <div
                              key={slot.id}
                              className="flex items-start justify-between gap-3 rounded-xl border border-border/60 bg-surface-alt p-3"
                            >
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-medium text-ink">
                                  {formatDateTime(slot.startsAt)} - {formatDateTime(slot.endsAt)}
                                </p>
                                <p className="text-xs text-ink-muted">
                                  Judge:{" "}
                                  {slot.judgeId
                                    ? group.judges.find((judge) => judge.judge.id === slot.judgeId)?.judge.name ||
                                      "Assigned"
                                    : "Unassigned"}{" "}
                                  | Status: {slot.status}
                                </p>
                              </div>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => deleteSlot(group.id, slot.id)}
                                loading={savingKey === `delete-slot-${slot.id}`}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}

                      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                        <Field label="Start time">
                          <Input
                            type="datetime-local"
                            value={slotDraft.startsAt}
                            onChange={(event) =>
                              setSlotDrafts((prev) => ({
                                ...prev,
                                [group.id]: { ...slotDraft, startsAt: event.target.value },
                              }))
                            }
                          />
                        </Field>
                        <Field label="End time">
                          <Input
                            type="datetime-local"
                            value={slotDraft.endsAt}
                            onChange={(event) =>
                              setSlotDrafts((prev) => ({
                                ...prev,
                                [group.id]: { ...slotDraft, endsAt: event.target.value },
                              }))
                            }
                          />
                        </Field>
                        <Field label="Judge for this slot">
                          <Select
                            value={slotDraft.judgeId}
                            onChange={(event) =>
                              setSlotDrafts((prev) => ({
                                ...prev,
                                [group.id]: { ...slotDraft, judgeId: event.target.value },
                              }))
                            }
                          >
                            <option value="">Unassigned</option>
                            {group.judges.map((judge) => (
                              <option key={judge.id} value={judge.judge.id}>
                                {judge.judge.name}
                              </option>
                            ))}
                          </Select>
                        </Field>
                        <Field label="Slot status">
                          <Select
                            value={slotDraft.status}
                            onChange={(event) =>
                              setSlotDrafts((prev) => ({
                                ...prev,
                                [group.id]: { ...slotDraft, status: event.target.value },
                              }))
                            }
                          >
                            <option value="PLANNED">Planned</option>
                            <option value="CONFIRMED">Confirmed</option>
                            <option value="COMPLETED">Completed</option>
                          </Select>
                        </Field>
                      </div>
                      <div className="flex justify-end">
                        <Button
                          size="sm"
                          onClick={() => addSlot(group.id)}
                          loading={savingKey === `slot-${group.id}`}
                        >
                          <Plus className="h-3.5 w-3.5" />
                          Add slot
                        </Button>
                      </div>
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
