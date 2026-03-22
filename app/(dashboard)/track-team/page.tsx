"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "@/lib/auth-client";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Field } from "@/components/ui/field";
import { SectionTitle } from "@/components/ui/section-title";
import { EmptyState } from "@/components/ui/empty-state";
import { Alert } from "@/components/ui/alert";
import { ROLE_LABELS } from "@/lib/labels";
import { Users, UserPlus, Trash2, ShieldCheck, ClipboardCheck } from "lucide-react";

interface TrackData {
  id: string;
  name: string;
}

interface MemberData {
  id: string;
  role: string;
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
    affiliation: string | null;
  };
}

interface AvailableUser {
  id: string;
  name: string;
  email: string;
  role: string;
  affiliation: string | null;
}

export default function TrackTeamPage() {
  const { data: session } = useSession();
  const role = (session?.user as Record<string, unknown>)?.role as string;
  const isChair = role === "PROGRAM_CHAIR";
  const isAdmin = role === "ADMIN";

  const [tracks, setTracks] = useState<TrackData[]>([]);
  const [selectedTrack, setSelectedTrack] = useState("");
  const [members, setMembers] = useState<MemberData[]>([]);
  const [available, setAvailable] = useState<AvailableUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const [addUserId, setAddUserId] = useState("");
  const [addRole, setAddRole] = useState<"REVIEWER" | "COMMITTEE">("REVIEWER");
  const [adding, setAdding] = useState(false);

  // Load tracks the user heads
  useEffect(() => {
    fetch("/api/submissions/tracks")
      .then((r) => r.json())
      .then(async (data) => {
        const allTracks: TrackData[] = data.tracks || [];
        // For chair: filter to own tracks by trying to access each
        // For admin: show all
        if (isAdmin) {
          setTracks(allTracks);
          if (allTracks.length > 0) setSelectedTrack(allTracks[0].id);
        } else {
          // Try to load members for each track — Forbidden = not my track
          const myTracks: TrackData[] = [];
          for (const t of allTracks) {
            const res = await fetch(`/api/track-members/${t.id}`);
            if (res.ok) myTracks.push(t);
          }
          setTracks(myTracks);
          if (myTracks.length > 0) setSelectedTrack(myTracks[0].id);
        }
      })
      .finally(() => setLoading(false));
  }, [isAdmin]);

  // Load members + available users when track changes
  const loadTrackData = useCallback(async (trackId: string) => {
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
  }, []);

  useEffect(() => {
    if (selectedTrack) loadTrackData(selectedTrack);
  }, [selectedTrack, loadTrackData]);

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
        setMessage("เพิ่มสมาชิกสำเร็จ");
        setAddUserId("");
        await loadTrackData(selectedTrack);
      } else {
        const data = await res.json();
        setMessage(data.error || "เกิดข้อผิดพลาด");
      }
    } catch {
      setMessage("เกิดข้อผิดพลาด");
    }
    setAdding(false);
  }

  async function handleRemove(memberId: string) {
    if (!confirm("ยืนยันการลบสมาชิกออกจากสาขา?")) return;
    const res = await fetch(`/api/track-members/${selectedTrack}/${memberId}`, { method: "DELETE" });
    if (res.ok) {
      setMessage("ลบสมาชิกสำเร็จ");
      await loadTrackData(selectedTrack);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-6 w-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!isChair && !isAdmin) {
    return <EmptyState icon={<Users className="h-12 w-12" />} title="ไม่มีสิทธิ์เข้าถึง" body="หน้านี้สำหรับประธานสาขาวิชาเท่านั้น" />;
  }

  if (tracks.length === 0) {
    return (
      <div className="space-y-6">
        <SectionTitle title="ทีมสาขาวิชา" subtitle="จัดการ Reviewer และ Committee ในสาขาวิชาของคุณ" />
        <EmptyState icon={<Users className="h-12 w-12" />} title="ไม่มีสาขาวิชา" body="คุณยังไม่ได้รับมอบหมายเป็น Program Chair สาขาวิชาใดๆ" />
      </div>
    );
  }

  const reviewers = members.filter((m) => m.role === "REVIEWER");
  const committees = members.filter((m) => m.role === "COMMITTEE");
  const currentTrack = tracks.find((t) => t.id === selectedTrack);

  return (
    <div className="space-y-6 max-w-4xl">
      <SectionTitle
        title="ทีมสาขาวิชา"
        subtitle="จัดการ Reviewer และ Committee ในสาขาวิชาของคุณ"
      />

      {message && <Alert tone="info">{message}</Alert>}

      {/* Track selector */}
      {tracks.length > 1 && (
        <Field label="เลือกสาขาวิชา">
          <Select value={selectedTrack} onChange={(e) => setSelectedTrack(e.target.value)}>
            {tracks.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </Select>
        </Field>
      )}

      {currentTrack && (
        <h2 className="text-lg font-bold text-ink">{currentTrack.name}</h2>
      )}

      {/* Add member */}
      <Card accent="brand">
        <CardHeader>
          <h3 className="text-sm font-semibold text-ink flex items-center gap-2">
            <UserPlus className="h-4 w-4" />
            เพิ่มสมาชิก
          </h3>
        </CardHeader>
        <CardBody>
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1">
              <Select value={addUserId} onChange={(e) => setAddUserId(e.target.value)}>
                <option value="">-- เลือกผู้ใช้ --</option>
                {available.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.email}){u.affiliation ? ` - ${u.affiliation}` : ""}
                  </option>
                ))}
              </Select>
            </div>
            <div className="w-full sm:w-48">
              <Select value={addRole} onChange={(e) => setAddRole(e.target.value as "REVIEWER" | "COMMITTEE")}>
                <option value="REVIEWER">Reviewer</option>
                <option value="COMMITTEE">Committee</option>
              </Select>
            </div>
            <Button onClick={handleAdd} loading={adding} disabled={!addUserId} size="sm" className="self-end">
              เพิ่ม
            </Button>
          </div>
        </CardBody>
      </Card>

      {/* Reviewers list */}
      <Card>
        <CardHeader>
          <h3 className="text-sm font-semibold text-ink flex items-center gap-2">
            <ClipboardCheck className="h-4 w-4" />
            Reviewers ({reviewers.length})
          </h3>
        </CardHeader>
        <CardBody>
          {reviewers.length === 0 ? (
            <p className="text-sm text-ink-muted">ยังไม่มี Reviewer ในสาขานี้</p>
          ) : (
            <div className="space-y-2">
              {reviewers.map((m) => (
                <div key={m.id} className="flex items-center justify-between bg-surface-alt rounded-lg px-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-ink">{m.user.name}</p>
                    <p className="text-xs text-ink-muted">
                      {m.user.email}
                      {m.user.affiliation && ` - ${m.user.affiliation}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge tone="info">Reviewer</Badge>
                    <Button variant="ghost" size="sm" onClick={() => handleRemove(m.id)}>
                      <Trash2 className="h-3.5 w-3.5 text-red-500" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardBody>
      </Card>

      {/* Committee list */}
      <Card>
        <CardHeader>
          <h3 className="text-sm font-semibold text-ink flex items-center gap-2">
            <ShieldCheck className="h-4 w-4" />
            Committee ({committees.length})
          </h3>
        </CardHeader>
        <CardBody>
          {committees.length === 0 ? (
            <p className="text-sm text-ink-muted">ยังไม่มี Committee ในสาขานี้</p>
          ) : (
            <div className="space-y-2">
              {committees.map((m) => (
                <div key={m.id} className="flex items-center justify-between bg-surface-alt rounded-lg px-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-ink">{m.user.name}</p>
                    <p className="text-xs text-ink-muted">
                      {m.user.email}
                      {m.user.affiliation && ` - ${m.user.affiliation}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge tone="success">Committee</Badge>
                    <Button variant="ghost" size="sm" onClick={() => handleRemove(m.id)}>
                      <Trash2 className="h-3.5 w-3.5 text-red-500" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
