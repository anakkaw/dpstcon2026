"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { SectionTitle } from "@/components/ui/section-title";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/alert";
import { Divider } from "@/components/ui/divider";
import { EmptyState } from "@/components/ui/empty-state";
import { PageLoading } from "@/components/ui/page-loading";
import { SummaryStatCard } from "@/components/ui/summary-stat-card";
import { WorkspaceSection, WorkspaceSurface } from "@/components/ui/workspace-section";
import { getPhaseTypeLabels } from "@/lib/labels";
import { useI18n } from "@/lib/i18n";
import { formatDate } from "@/lib/utils";
import { CalendarRange, Layers3, Plus, Settings } from "lucide-react";

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
  const { t, locale } = useI18n();
  const phaseLabels = getPhaseTypeLabels(t);
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
        setMessage(t("conference.trackAdded"));
      }
    } catch {}
    setSaving(false);
  }

  if (loading) {
    return <PageLoading label={t("conference.settings")} />;
  }

  if (!event) {
    return (
      <div className="space-y-6">
        <SectionTitle title={t("conference.settings")} />
        <EmptyState
          icon={<Settings className="h-12 w-12" />}
          title={t("conference.noActive")}
          body={t("conference.createNew")}
        />
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-5xl">
      <SectionTitle
        title={t("conference.settings")}
        subtitle={t("conference.subtitle", { event: event.name, year: event.year })}
      />

      {message && <Alert tone="success">{message}</Alert>}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <SummaryStatCard label={t("conference.year")} value={event.year} color="blue" icon={<CalendarRange className="h-5 w-5" />} />
        <SummaryStatCard label={t("conference.tracks")} value={event.tracks.length} color="indigo" icon={<Layers3 className="h-5 w-5" />} />
        <SummaryStatCard label={t("conference.phases")} value={event.phases.length} color="amber" icon={<CalendarRange className="h-5 w-5" />} />
        <SummaryStatCard label={t("dashboard.submissionDeadline")} value={formatDate(event.submissionDeadline, locale)} color="gray" />
      </div>

      <WorkspaceSection title={t("conference.generalInfo")}>
        <WorkspaceSurface className="p-5">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <InfoField label={t("conference.name")} value={event.name} />
            <InfoField label={t("conference.year")} value={String(event.year)} />
            <InfoField label={t("dashboard.reviewDeadline")} value={formatDate(event.reviewDeadline, locale)} />
            <InfoField label={t("dashboard.cameraReadyDeadline")} value={formatDate(event.cameraReadyDeadline, locale)} />
          </div>
          {event.description && (
            <>
              <Divider className="my-5" />
              <InfoField label={t("conference.description")} value={event.description} />
            </>
          )}
        </WorkspaceSurface>
      </WorkspaceSection>

      <WorkspaceSection
        title={t("conference.tracks")}
        action={<Badge>{t("conference.tracksCount", { n: event.tracks.length })}</Badge>}
      >
        <WorkspaceSurface className="overflow-hidden">
          {event.tracks.length === 0 ? (
            <div className="px-5 py-6 text-sm text-ink-muted">{t("conference.noTracks")}</div>
          ) : (
            <div className="divide-y divide-border-light">
              {event.tracks.map((track, index) => (
                <div key={track.id} className={`px-5 py-4 ${index === 0 ? "" : ""}`}>
                  <div>
                    <p className="text-sm font-semibold text-ink">{track.name}</p>
                    {track.description && (
                      <p className="mt-1 text-xs text-ink-muted">{track.description}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="border-t border-border-light bg-surface-alt/40 px-5 py-4">
            <p className="mb-3 text-sm font-semibold text-ink">{t("conference.addTrack")}</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label={t("conference.trackName")} htmlFor="trackName">
                <Input
                  id="trackName"
                  value={trackName}
                  onChange={(e) => setTrackName(e.target.value)}
                  placeholder={t("conference.trackNamePlaceholder")}
                />
              </Field>
              <Field label={t("conference.trackDesc")} htmlFor="trackDesc">
                <Input
                  id="trackDesc"
                  value={trackDesc}
                  onChange={(e) => setTrackDesc(e.target.value)}
                  placeholder={t("conference.trackDescPlaceholder")}
                />
              </Field>
            </div>
            <div className="mt-4 flex justify-end">
              <Button size="sm" onClick={addTrack} loading={saving} disabled={!trackName.trim()}>
                <Plus className="h-4 w-4" />
                {t("conference.addTrackBtn")}
              </Button>
            </div>
          </div>
        </WorkspaceSurface>
      </WorkspaceSection>

      <WorkspaceSection title={t("conference.phases")}>
        <WorkspaceSurface className="overflow-hidden">
          {event.phases.length === 0 ? (
            <div className="px-5 py-6 text-sm text-ink-muted">{t("conference.noPhases")}</div>
          ) : (
            <div className="divide-y divide-border-light">
              {event.phases.map((phase) => (
                <div key={phase.id} className="flex items-center justify-between gap-4 px-5 py-4">
                  <div>
                    <p className="text-sm font-semibold text-ink">
                      {phaseLabels[phase.type] || phase.name}
                    </p>
                    <p className="mt-1 text-xs text-ink-muted">
                      {formatDate(phase.startDate, locale)} — {formatDate(phase.endDate, locale)}
                    </p>
                  </div>
                  <Badge tone={phase.isActive ? "success" : "neutral"} dot={phase.isActive}>
                    {phase.isActive ? t("conference.inProgress") : t("conference.notOpen")}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </WorkspaceSurface>
      </WorkspaceSection>
    </div>
  );
}

function InfoField({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1">
      <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-ink-muted">{label}</p>
      <p className="text-sm font-medium text-ink">{value}</p>
    </div>
  );
}
