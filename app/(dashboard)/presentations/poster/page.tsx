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
import { formatDateTime } from "@/lib/utils";
import { Image, Calendar, Save, Plus, Users, ClipboardList, X, Check, Clock, MapPin, ChevronDown, ChevronUp, UserPlus, ArrowUpDown, BarChart3, Download } from "lucide-react";
import { TrackFilter } from "@/components/track-filter";

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
  const [presentations, setPresentations] = useState<PresentationData[]>([]);
  const [criteria, setCriteria] = useState<CriterionData[]>([]);
  const [committeeUsers, setCommitteeUsers] = useState<CommitteeUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
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

  const sortedPresentations = [...filteredPresentations].sort((a, b) => {
    const dir = sortDir === "asc" ? 1 : -1;
    switch (sortKey) {
      case "title": return dir * a.submission.title.localeCompare(b.submission.title);
      case "author": return dir * a.submission.author.name.localeCompare(b.submission.author.name);
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
      const res = await fetch(`/api/presentations/${presId}/schedule`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scheduledAt: editForm.scheduledAt || undefined,
          room: editForm.room || undefined,
          duration: editForm.duration ? Number(editForm.duration) : undefined,
        }),
      });
      if (res.ok) {
        setMessage("บันทึกตารางสำเร็จ");
        setEditingId(null);
        await reload();
      }
    } catch {}
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
        setMessage("เพิ่มเกณฑ์สำเร็จ");
      }
    } catch {}
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
        setMessage(`แต่งตั้ง Committee ${selectedJudges.length} คนสำเร็จ`);
        setAssignPresId(null);
        setSelectedJudges([]);
      }
    } catch {}
    setAssigningSaving(false);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-6 w-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
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
    { key: "schedule" as const, label: "จัดตาราง", icon: <Calendar className="h-3.5 w-3.5" /> },
    { key: "criteria" as const, label: "เกณฑ์ประเมิน", icon: <ClipboardList className="h-3.5 w-3.5" /> },
    { key: "committee" as const, label: "Committee", icon: <Users className="h-3.5 w-3.5" /> },
    { key: "scoring" as const, label: "คะแนนประเมิน", icon: <BarChart3 className="h-3.5 w-3.5" /> },
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
        title="Poster Presentation"
        subtitle={`${filteredPresentations.length} รายการ`}
      />

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-xl bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100 px-4 py-3">
          <p className="text-2xl font-bold text-blue-700">{filteredPresentations.length}</p>
          <p className="text-xs text-blue-600/70 font-medium">ทั้งหมด</p>
        </div>
        <div className="rounded-xl bg-gradient-to-br from-emerald-50 to-green-50 border border-emerald-100 px-4 py-3">
          <p className="text-2xl font-bold text-emerald-700">{scheduledCount}</p>
          <p className="text-xs text-emerald-600/70 font-medium">จัดตารางแล้ว</p>
        </div>
        <div className="rounded-xl bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-100 px-4 py-3">
          <p className="text-2xl font-bold text-amber-700">{pendingCount}</p>
          <p className="text-xs text-amber-600/70 font-medium">รอจัดตาราง</p>
        </div>
      </div>

      <TrackFilter value={trackFilter} onChange={setTrackFilter} />

      {message && <Alert tone="success">{message}</Alert>}

      {/* Tabs */}
      <div className="flex gap-0.5 border-b border-border/60">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => handleTabChange(tab.key)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors duration-150 ${
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
          <EmptyState icon={<Image className="h-12 w-12" />} title="ยังไม่มี Poster Presentation" body="จะถูกสร้างอัตโนมัติเมื่อบทความได้รับการตอบรับ" />
        ) : (
          <Card>
            <CardBody className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-surface-alt/80 border-b border-border/60">
                      <SortTh label="บทความ" sortKey_="title" currentKey={sortKey} dir={sortDir} onSort={toggleSort} className="w-[35%] px-5" />
                      <SortTh label="Track" sortKey_="track" currentKey={sortKey} dir={sortDir} onSort={toggleSort} />
                      <SortTh label="วัน-เวลา" sortKey_="scheduledAt" currentKey={sortKey} dir={sortDir} onSort={toggleSort} />
                      <SortTh label="ห้อง" sortKey_="room" currentKey={sortKey} dir={sortDir} onSort={toggleSort} />
                      <SortTh label="นาที" sortKey_="duration" currentKey={sortKey} dir={sortDir} onSort={toggleSort} align="center" />
                      <SortTh label="สถานะ" sortKey_="status" currentKey={sortKey} dir={sortDir} onSort={toggleSort} align="center" />
                      <th className="text-right px-5 py-3 text-xs font-semibold text-ink-muted uppercase tracking-wider" />
                    </tr>
                  </thead>
                  <tbody>
                    {sortedPresentations.map((p) => (
                      <Fragment key={p.id}>
                        <tr className="border-t border-border/40 hover:bg-surface-hover/50 transition-colors group">
                          <td className="px-5 py-3.5">
                            <p className="font-medium text-ink leading-snug">{p.submission.title}</p>
                            <p className="text-xs text-ink-muted mt-0.5">{p.submission.author.name}</p>
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
                              {p.status === "SCHEDULED" ? "จัดแล้ว" : "รอจัด"}
                            </Badge>
                          </td>
                          <td className="px-5 py-3.5 text-right">
                            {editingId === p.id ? (
                              <div className="flex gap-1 justify-end">
                                <Button size="sm" onClick={() => handleSchedule(p.id)} loading={saving}><Check className="h-3.5 w-3.5" />บันทึก</Button>
                                <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}><X className="h-3.5 w-3.5" /></Button>
                              </div>
                            ) : (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="opacity-0 group-hover:opacity-100 transition-opacity"
                                onClick={() => { setEditingId(p.id); setEditForm({ scheduledAt: p.scheduledAt || "", room: p.room || "", duration: p.duration?.toString() || "" }); }}
                              >
                                {p.scheduledAt ? "แก้ไข" : "กำหนดตาราง"}
                              </Button>
                            )}
                          </td>
                        </tr>
                        {editingId === p.id && (
                          <tr className="bg-brand-50/40">
                            <td colSpan={7} className="px-5 py-4">
                              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-2xl">
                                <Field label="วัน-เวลา">
                                  <Input type="datetime-local" value={editForm.scheduledAt} onChange={(e) => setEditForm({ ...editForm, scheduledAt: e.target.value })} />
                                </Field>
                                <Field label="ห้อง">
                                  <Input value={editForm.room} onChange={(e) => setEditForm({ ...editForm, room: e.target.value })} placeholder="เช่น A101" />
                                </Field>
                                <Field label="ระยะเวลา (นาที)">
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
        )
      )}

      {/* ══════════════════════════════════════════════════════════════
          Tab: Criteria
         ══════════════════════════════════════════════════════════════ */}
      {activeTab === "criteria" && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-ink">เกณฑ์การประเมิน ({criteria.length} เกณฑ์)</h3>
              <Button size="sm" onClick={() => setShowAddCriteria(!showAddCriteria)}>
                <Plus className="h-3.5 w-3.5" />{showAddCriteria ? "ซ่อน" : "เพิ่มเกณฑ์"}
              </Button>
            </div>
          </CardHeader>
          <CardBody className="space-y-3">
            {showAddCriteria && (
              <div className="rounded-xl border border-brand-200/60 bg-brand-50/30 p-4 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Field label="ชื่อเกณฑ์" required>
                    <Input value={criteriaForm.name} onChange={(e) => setCriteriaForm({ ...criteriaForm, name: e.target.value })} placeholder="เช่น ความชัดเจนในการนำเสนอ" />
                  </Field>
                  <Field label="คำอธิบาย">
                    <Input value={criteriaForm.description} onChange={(e) => setCriteriaForm({ ...criteriaForm, description: e.target.value })} placeholder="รายละเอียดเพิ่มเติม" />
                  </Field>
                  <Field label="คะแนนเต็ม" hint="ค่าเริ่มต้น 10">
                    <Input type="number" value={criteriaForm.maxScore} onChange={(e) => setCriteriaForm({ ...criteriaForm, maxScore: e.target.value })} />
                  </Field>
                  <Field label="น้ำหนัก (Weight)" hint="สัดส่วนความสำคัญ">
                    <Input type="number" value={criteriaForm.weight} onChange={(e) => setCriteriaForm({ ...criteriaForm, weight: e.target.value })} />
                  </Field>
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="secondary" size="sm" onClick={() => setShowAddCriteria(false)}>ยกเลิก</Button>
                  <Button size="sm" onClick={handleAddCriteria} loading={addingCriteria} disabled={!criteriaForm.name.trim()}>บันทึกเกณฑ์</Button>
                </div>
              </div>
            )}

            {criteria.length === 0 ? (
              <EmptyState icon={<ClipboardList className="h-10 w-10" />} title="ยังไม่มีเกณฑ์ประเมิน" body="เพิ่มเกณฑ์การประเมินสำหรับ Committee" />
            ) : (
              <div className="overflow-x-auto rounded-lg border border-border/60">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-surface-alt/80">
                      <th className="text-left px-4 py-2.5 text-xs font-semibold text-ink-muted uppercase tracking-wider">ลำดับ</th>
                      <th className="text-left px-4 py-2.5 text-xs font-semibold text-ink-muted uppercase tracking-wider">ชื่อเกณฑ์</th>
                      <th className="text-left px-4 py-2.5 text-xs font-semibold text-ink-muted uppercase tracking-wider">คำอธิบาย</th>
                      <th className="text-center px-4 py-2.5 text-xs font-semibold text-ink-muted uppercase tracking-wider">คะแนนเต็ม</th>
                      <th className="text-center px-4 py-2.5 text-xs font-semibold text-ink-muted uppercase tracking-wider">น้ำหนัก</th>
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
            )}
          </CardBody>
        </Card>
      )}

      {/* ══════════════════════════════════════════════════════════════
          Tab: Committee — Table with inline assign
         ══════════════════════════════════════════════════════════════ */}
      {activeTab === "committee" && (
        filteredPresentations.length === 0 ? (
          <EmptyState icon={<Users className="h-12 w-12" />} title="ยังไม่มี Poster Presentation" />
        ) : (
          <Card>
            <CardBody className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-surface-alt/80 border-b border-border/60">
                      <th className="text-left px-5 py-3 text-xs font-semibold text-ink-muted uppercase tracking-wider w-[50%]">บทความ</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-ink-muted uppercase tracking-wider">Track</th>
                      <th className="text-right px-5 py-3 text-xs font-semibold text-ink-muted uppercase tracking-wider" />
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPresentations.map((p) => (
                      <Fragment key={p.id}>
                        <tr className="border-t border-border/40 hover:bg-surface-hover/50 transition-colors group">
                          <td className="px-5 py-3.5">
                            <p className="font-medium text-ink leading-snug">{p.submission.title}</p>
                            <p className="text-xs text-ink-muted mt-0.5">{p.submission.author.name}</p>
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
                              {assignPresId === p.id ? "ยกเลิก" : "กำหนด Committee"}
                            </Button>
                          </td>
                        </tr>
                        {assignPresId === p.id && (
                          <tr className="bg-blue-50/40">
                            <td colSpan={3} className="px-5 py-4">
                              {committeeUsers.length === 0 ? (
                                <p className="text-xs text-danger">ไม่พบผู้ใช้ที่มี role COMMITTEE — กรุณาเพิ่มในจัดการผู้ใช้</p>
                              ) : (
                                <div className="space-y-3">
                                  <p className="text-xs font-medium text-ink-light">เลือก Committee (เลือกได้หลายคน):</p>
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
                                            <p className="text-sm font-medium text-ink truncate">{u.name}</p>
                                            <p className="text-xs text-ink-muted truncate">{u.email}</p>
                                          </div>
                                        </label>
                                      );
                                    })}
                                  </div>
                                  {selectedJudges.length > 0 && (
                                    <div className="flex items-center justify-between pt-2 border-t border-blue-200/60">
                                      <p className="text-xs text-ink-muted">เลือกแล้ว {selectedJudges.length} คน</p>
                                      <Button size="sm" onClick={() => handleAssignCommittee(p.id)} loading={assigningSaving}>
                                        <Check className="h-3.5 w-3.5" />แต่งตั้ง
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
        )
      )}
      {/* ══════════════════════════════════════════════════════════════
          Tab: Scoring
         ══════════════════════════════════════════════════════════════ */}
      {activeTab === "scoring" && (
        filteredScoring.length === 0 ? (
          <EmptyState icon={<BarChart3 className="h-12 w-12" />} title="ยังไม่มีข้อมูลคะแนน" body="ยังไม่มี Committee ส่งผลการประเมิน" />
        ) : (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-ink">ผลคะแนนประเมิน ({filteredScoring.length} รายการ)</h3>
                <a href="/api/exports/proceedings?format=csv" download>
                  <Button variant="outline" size="sm"><Download className="h-3.5 w-3.5" />Export CSV</Button>
                </a>
              </div>
            </CardHeader>
            <CardBody className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-surface-alt/80 border-b border-border/60">
                      <th className="text-left px-5 py-3 text-xs font-semibold text-ink-muted uppercase tracking-wider w-[35%]">บทความ</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-ink-muted uppercase tracking-wider">Author</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-ink-muted uppercase tracking-wider">Track</th>
                      <th className="text-center px-4 py-3 text-xs font-semibold text-ink-muted uppercase tracking-wider">Committee</th>
                      <th className="text-center px-4 py-3 text-xs font-semibold text-ink-muted uppercase tracking-wider">คะแนนเฉลี่ย</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredScoring.map((p) => {
                      const avg = avgScore(p.evaluations);
                      return (
                        <tr key={p.id} className="border-t border-border/40 hover:bg-surface-hover/50 transition-colors">
                          <td className="px-5 py-3.5 font-medium text-ink">{p.submission.title}</td>
                          <td className="px-4 py-3.5 text-ink-light">{p.submission.author.name}</td>
                          <td className="px-4 py-3.5">
                            {p.submission.track ? <Badge tone="info">{p.submission.track.name}</Badge> : <span className="text-ink-muted">—</span>}
                          </td>
                          <td className="px-4 py-3.5 text-center"><Badge>{p.evaluations.length} คน</Badge></td>
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
