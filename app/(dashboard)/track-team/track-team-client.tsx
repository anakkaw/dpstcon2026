"use client";

import { useState } from "react";
import { useDashboardAuth } from "@/components/dashboard-auth-context";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Field } from "@/components/ui/field";
import { SectionTitle } from "@/components/ui/section-title";
import { Select } from "@/components/ui/select";
import { SummaryStatCard } from "@/components/ui/summary-stat-card";
import { WorkspaceSection, WorkspaceSurface } from "@/components/ui/workspace-section";
import { useI18n } from "@/lib/i18n";
import { displayNameTh } from "@/lib/display-name";
import type { AvailableUser, MemberData, TrackData } from "@/server/track-team-data";
import { ClipboardCheck, ShieldCheck, Trash2, UserPlus, Users } from "lucide-react";

export function TrackTeamClient({
  initialTracks,
  initialSelectedTrack,
  initialMembers,
  initialAvailable,
}: {
  initialTracks: TrackData[];
  initialSelectedTrack: string;
  initialMembers: MemberData[];
  initialAvailable: AvailableUser[];
}) {
  const { t } = useI18n();
  const { roles } = useDashboardAuth();
  const isChair = roles.includes("PROGRAM_CHAIR");
  const isAdmin = roles.includes("ADMIN");

  const [tracks] = useState(initialTracks);
  const [selectedTrack, setSelectedTrack] = useState(initialSelectedTrack);
  const [members, setMembers] = useState(initialMembers);
  const [available, setAvailable] = useState(initialAvailable);
  const [message, setMessage] = useState("");
  const [memberToRemove, setMemberToRemove] = useState<MemberData | null>(null);
  const [addUserId, setAddUserId] = useState("");
  const [addRole, setAddRole] = useState<"REVIEWER" | "COMMITTEE">("REVIEWER");
  const [adding, setAdding] = useState(false);

  async function loadTrackData(trackId: string) {
    if (!trackId) return;

    const [membersRes, availableRes] = await Promise.all([
      fetch(`/api/track-members/${trackId}`),
      fetch(`/api/track-members/${trackId}/available`),
    ]);

    if (membersRes.ok) {
      const data = await membersRes.json();
      setMembers(data.members || []);
    }

    if (availableRes.ok) {
      const data = await availableRes.json();
      setAvailable(data.users || []);
    }
  }

  async function handleTrackChange(trackId: string) {
    setSelectedTrack(trackId);
    setMembers([]);
    setAvailable([]);
    await loadTrackData(trackId);
  }

  async function handleAdd() {
    if (!addUserId || !selectedTrack) return;
    setAdding(true);
    setMessage("");
    try {
      const res = await fetch(`/api/track-members/${selectedTrack}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: addUserId, role: addRole }),
      });
      if (res.ok) {
        setMessage(t("trackTeam.memberAdded"));
        setAddUserId("");
        await loadTrackData(selectedTrack);
      } else {
        const data = await res.json();
        setMessage(data.error || t("login.genericError"));
      }
    } catch {
      setMessage(t("login.genericError"));
    }
    setAdding(false);
  }

  async function handleRemove(memberId: string) {
    const res = await fetch(`/api/track-members/${selectedTrack}/${memberId}`, { method: "DELETE" });
    if (res.ok) {
      setMessage(t("trackTeam.memberRemoved"));
      await loadTrackData(selectedTrack);
    }
  }

  if (!isChair && !isAdmin) {
    return <EmptyState icon={<Users className="h-12 w-12" />} title={t("trackTeam.noAccess")} body={t("trackTeam.chairOnly")} />;
  }

  if (tracks.length === 0) {
    return (
      <div className="space-y-6">
        <SectionTitle title={t("trackTeam.title")} subtitle={t("trackTeam.subtitle")} />
        <EmptyState icon={<Users className="h-12 w-12" />} title={t("trackTeam.noTracks")} body={t("trackTeam.notAssigned")} />
      </div>
    );
  }

  const reviewers = members.filter((member) => member.role === "REVIEWER");
  const committees = members.filter((member) => member.role === "COMMITTEE");
  const currentTrack = tracks.find((track) => track.id === selectedTrack);

  return (
    <div className="max-w-5xl space-y-8">
      <ConfirmDialog
        open={!!memberToRemove}
        title={t("trackTeam.removeTitle")}
        description={memberToRemove ? t("trackTeam.removeDescription", { name: displayNameTh(memberToRemove.user) }) : ""}
        confirmLabel={t("common.delete")}
        cancelLabel={t("common.cancel")}
        tone="danger"
        onCancel={() => setMemberToRemove(null)}
        onConfirm={async () => {
          if (!memberToRemove) return;
          await handleRemove(memberToRemove.id);
          setMemberToRemove(null);
        }}
      />

      <SectionTitle
        title={t("trackTeam.title")}
        subtitle={currentTrack ? t("trackTeam.trackSummary", { track: currentTrack.name, members: members.length }) : t("trackTeam.subtitle")}
      />

      {message && <Alert tone="info">{message}</Alert>}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <SummaryStatCard label={t("common.total")} value={members.length} color="blue" icon={<Users className="h-5 w-5" />} />
        <SummaryStatCard label={t("trackTeam.reviewersLabel")} value={reviewers.length} color="indigo" icon={<ClipboardCheck className="h-5 w-5" />} />
        <SummaryStatCard label={t("trackTeam.committeesLabel")} value={committees.length} color="emerald" icon={<ShieldCheck className="h-5 w-5" />} />
        <SummaryStatCard label={t("common.available")} value={available.length} color="gray" icon={<UserPlus className="h-5 w-5" />} />
      </div>

      <WorkspaceSection title={t("trackTeam.addMember")}>
        <WorkspaceSurface className="p-5">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,220px)_minmax(0,1fr)_180px_auto]">
            {tracks.length > 1 && (
              <Field label={t("trackTeam.selectTrack")}>
                <Select value={selectedTrack} onChange={(e) => void handleTrackChange(e.target.value)}>
                  {tracks.map((track) => (
                    <option key={track.id} value={track.id}>{track.name}</option>
                  ))}
                </Select>
              </Field>
            )}
            <Field label={currentTrack ? currentTrack.name : t("trackTeam.selectTrack")}>
              <Select value={addUserId} onChange={(e) => setAddUserId(e.target.value)}>
                <option value="">{t("trackTeam.selectUser")}</option>
                {available.map((entry) => (
                  <option key={entry.id} value={entry.id}>
                    {displayNameTh(entry)} ({entry.email}){entry.affiliation ? ` - ${entry.affiliation}` : ""}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={t("common.role")}>
              <Select value={addRole} onChange={(e) => setAddRole(e.target.value as "REVIEWER" | "COMMITTEE")}>
                <option value="REVIEWER">Reviewer</option>
                <option value="COMMITTEE">Committee</option>
              </Select>
            </Field>
            <div className="flex items-end">
              <Button onClick={handleAdd} loading={adding} disabled={!addUserId} size="sm" className="w-full lg:w-auto">
                {t("common.add")}
              </Button>
            </div>
          </div>
        </WorkspaceSurface>
      </WorkspaceSection>

      <WorkspaceSection title={t("trackTeam.reviewers", { n: reviewers.length })}>
        <WorkspaceSurface className="overflow-hidden">
          {reviewers.length === 0 ? (
            <div className="px-5 py-6 text-sm text-ink-muted">{t("trackTeam.noReviewers")}</div>
          ) : (
            <div className="divide-y divide-border-light">
              {reviewers.map((member) => (
                <div key={member.id} className="flex items-center justify-between gap-4 px-5 py-4">
                  <div>
                    <p className="text-sm font-semibold text-ink">{displayNameTh(member.user)}</p>
                    <p className="mt-1 text-xs text-ink-muted">
                      {member.user.email}
                      {member.user.affiliation && ` - ${member.user.affiliation}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge tone="info">Reviewer</Badge>
                    <Button variant="ghost" size="sm" onClick={() => setMemberToRemove(member)}>
                      <Trash2 className="h-3.5 w-3.5 text-red-500" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </WorkspaceSurface>
      </WorkspaceSection>

      <WorkspaceSection title={t("trackTeam.committees", { n: committees.length })}>
        <WorkspaceSurface className="overflow-hidden">
          {committees.length === 0 ? (
            <div className="px-5 py-6 text-sm text-ink-muted">{t("trackTeam.noCommittees")}</div>
          ) : (
            <div className="divide-y divide-border-light">
              {committees.map((member) => (
                <div key={member.id} className="flex items-center justify-between gap-4 px-5 py-4">
                  <div>
                    <p className="text-sm font-semibold text-ink">{displayNameTh(member.user)}</p>
                    <p className="mt-1 text-xs text-ink-muted">
                      {member.user.email}
                      {member.user.affiliation && ` - ${member.user.affiliation}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge tone="success">Committee</Badge>
                    <Button variant="ghost" size="sm" onClick={() => setMemberToRemove(member)}>
                      <Trash2 className="h-3.5 w-3.5 text-red-500" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </WorkspaceSurface>
      </WorkspaceSection>
    </div>
  );
}
