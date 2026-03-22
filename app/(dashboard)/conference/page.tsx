"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field } from "@/components/ui/field";
import { SectionTitle } from "@/components/ui/section-title";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/alert";
import { Collapsible } from "@/components/ui/collapsible";
import { Divider } from "@/components/ui/divider";
import { EmptyState } from "@/components/ui/empty-state";
import { PHASE_TYPE_LABELS } from "@/lib/labels";
import { formatDate } from "@/lib/utils";
import { Plus, Settings } from "lucide-react";

interface EventData {
  id: string;
  name: string;
  year: number;
  description: string | null;
  submissionDeadline: string | null;
  reviewDeadline: string | null;
  cameraReadyDeadline: string | null;
  isActive: boolean;
  tracks: { id: string; name: string; description: string | null }[];
  phases: { id: string; type: string; name: string; startDate: string | null; endDate: string | null; isActive: boolean }[];
}

export default function ConferencePage() {
  const [event, setEvent] = useState<EventData | null>(null);
  const [loading, setLoading] = useState(true);
  const [trackName, setTrackName] = useState("");
  const [trackDesc, setTrackDesc] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetch("/api/events/active")
      .then((r) => r.json())
      .then((data) => setEvent(data.event))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function addTrack() {
    if (!event || !trackName.trim()) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/events/${event.id}/tracks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trackName, description: trackDesc }),
      });
      if (res.ok) {
        const data = await res.json();
        setEvent({ ...event, tracks: [...event.tracks, data.track] });
        setTrackName("");
        setTrackDesc("");
        setMessage("เพิ่ม track สำเร็จ");
      }
    } catch {}
    setSaving(false);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-6 w-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!event) {
    return (
      <div className="space-y-6">
        <SectionTitle title="ตั้งค่า Conference" />
        <EmptyState
          icon={<Settings className="h-12 w-12" />}
          title="ยังไม่มี Conference ที่ active"
          body="สร้าง Conference ใหม่เพื่อเริ่มต้น"
        />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <SectionTitle
        title="ตั้งค่า Conference"
        subtitle={`${event.name} ${event.year}`}
      />

      {message && <Alert tone="success">{message}</Alert>}

      {/* Conference Info */}
      <Card>
        <CardHeader>
          <h3 className="text-sm font-semibold text-ink">ข้อมูลทั่วไป</h3>
        </CardHeader>
        <CardBody className="space-y-3">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-ink-muted uppercase tracking-wider font-medium">ชื่อ</p>
              <p className="text-sm font-medium text-ink">{event.name}</p>
            </div>
            <div>
              <p className="text-xs text-ink-muted uppercase tracking-wider font-medium">ปี</p>
              <p className="text-sm font-medium text-ink">{event.year}</p>
            </div>
          </div>
          {event.description && (
            <div>
              <p className="text-xs text-ink-muted uppercase tracking-wider font-medium">คำอธิบาย</p>
              <p className="text-sm text-ink">{event.description}</p>
            </div>
          )}
          <Divider />
          <div className="grid grid-cols-3 gap-4">
            <div>
              <p className="text-xs text-ink-muted uppercase tracking-wider font-medium">กำหนดส่งบทความ</p>
              <p className="text-sm text-ink">{formatDate(event.submissionDeadline)}</p>
            </div>
            <div>
              <p className="text-xs text-ink-muted uppercase tracking-wider font-medium">กำหนดส่งรีวิว</p>
              <p className="text-sm text-ink">{formatDate(event.reviewDeadline)}</p>
            </div>
            <div>
              <p className="text-xs text-ink-muted uppercase tracking-wider font-medium">กำหนดส่งฉบับสมบูรณ์</p>
              <p className="text-sm text-ink">{formatDate(event.cameraReadyDeadline)}</p>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Tracks */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-ink">สาขา (Tracks)</h3>
            <Badge>{event.tracks.length} สาขา</Badge>
          </div>
        </CardHeader>
        <CardBody className="space-y-3">
          {event.tracks.length === 0 ? (
            <p className="text-xs text-ink-muted uppercase tracking-wider font-medium">ยังไม่มี track</p>
          ) : (
            <div className="space-y-2">
              {event.tracks.map((track) => (
                <div
                  key={track.id}
                  className="flex items-center justify-between rounded-lg bg-surface-alt px-4 py-2"
                >
                  <div>
                    <p className="text-sm font-medium text-ink">{track.name}</p>
                    {track.description && (
                      <p className="text-xs text-ink-muted uppercase tracking-wider font-medium">{track.description}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          <Divider label="เพิ่ม Track ใหม่" />

          <div className="grid grid-cols-2 gap-3">
            <Field label="ชื่อ Track" htmlFor="trackName">
              <Input
                id="trackName"
                value={trackName}
                onChange={(e) => setTrackName(e.target.value)}
                placeholder="เช่น Computer Science"
              />
            </Field>
            <Field label="คำอธิบาย" htmlFor="trackDesc">
              <Input
                id="trackDesc"
                value={trackDesc}
                onChange={(e) => setTrackDesc(e.target.value)}
                placeholder="คำอธิบายสาขา"
              />
            </Field>
          </div>
          <Button size="sm" onClick={addTrack} loading={saving} disabled={!trackName.trim()}>
            <Plus className="h-4 w-4" />
            เพิ่ม Track
          </Button>
        </CardBody>
      </Card>

      {/* Phases */}
      <Card>
        <CardHeader>
          <h3 className="text-sm font-semibold text-ink">ระยะเวลา (Phases)</h3>
        </CardHeader>
        <CardBody>
          {event.phases.length === 0 ? (
            <p className="text-xs text-ink-muted uppercase tracking-wider font-medium">ยังไม่มี phase</p>
          ) : (
            <div className="space-y-2">
              {event.phases.map((phase) => (
                <div
                  key={phase.id}
                  className="flex items-center justify-between rounded-lg bg-surface-alt px-4 py-2"
                >
                  <div>
                    <p className="text-sm font-medium text-ink">
                      {PHASE_TYPE_LABELS[phase.type] || phase.name}
                    </p>
                    <p className="text-xs text-ink-muted uppercase tracking-wider font-medium">
                      {formatDate(phase.startDate)} — {formatDate(phase.endDate)}
                    </p>
                  </div>
                  <Badge tone={phase.isActive ? "success" : "neutral"} dot={phase.isActive}>
                    {phase.isActive ? "กำลังดำเนินการ" : "ยังไม่เปิด"}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
