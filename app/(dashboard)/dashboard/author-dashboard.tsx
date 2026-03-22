"use client";

import { StatCard } from "@/components/ui/stat-card";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  SUBMISSION_STATUS_LABELS,
  SUBMISSION_STATUS_COLORS,
} from "@/lib/labels";
import {
  FileText, Send, Clock, CheckCircle2,
  Plus, ArrowRight, Sparkles, Calendar, Mic,
} from "lucide-react";
import Link from "next/link";
import { SubmissionPipeline } from "@/components/author/submission-pipeline";
import { NextActionCard } from "@/components/author/next-action-card";
import { getNextAction, getDaysUntil, getRelevantDeadlineKey } from "@/lib/author-utils";
import { formatDate } from "@/lib/utils";

interface AuthorSubmission {
  id: string;
  title: string;
  status: string;
  hasFile: boolean;
  trackName: string | null;
  reviewTotal: number;
  reviewCompleted: number;
}

interface AuthorPresentation {
  submissionId: string;
  type: string;
  status: string;
  scheduledAt: string | null;
  room: string | null;
  duration: number | null;
}

export default function AuthorDashboard({ stats }: { stats: Record<string, unknown> }) {
  const byStatus = (stats.byStatus || {}) as Record<string, number>;
  const subs = (stats.submissions || []) as AuthorSubmission[];
  const deadlines = (stats.deadlines || {}) as Record<string, string>;
  const presentations = (stats.presentations || []) as AuthorPresentation[];

  // Compute action items
  const actionItems = subs
    .map((s) => {
      const action = getNextAction(s.status, s.hasFile);
      if (!action) return null;
      const deadlineKey = getRelevantDeadlineKey(s.status);
      const deadline = deadlineKey ? deadlines[deadlineKey] : undefined;
      const daysLeft = deadline ? getDaysUntil(deadline) : undefined;
      return { ...action, sub: s, deadline, daysLeft };
    })
    .filter(Boolean) as { label: string; description: string; urgency: "normal" | "warning" | "urgent"; sub: AuthorSubmission; deadline?: string; daysLeft?: number }[];

  // Upcoming deadlines (future only)
  const deadlineList = [
    { key: "submissionDeadline", label: "กำหนดส่งบทความ" },
    { key: "reviewDeadline", label: "กำหนดส่งรีวิว" },
    { key: "notificationDate", label: "แจ้งผลการพิจารณา" },
    { key: "cameraReadyDeadline", label: "กำหนดส่งฉบับสมบูรณ์" },
  ]
    .map((d) => ({ ...d, date: deadlines[d.key], daysLeft: deadlines[d.key] ? getDaysUntil(deadlines[d.key]) : 999 }))
    .filter((d) => d.date && d.daysLeft > -30)
    .sort((a, b) => a.daysLeft - b.daysLeft);

  // Presentations mapped to submission titles
  const presWithTitle = presentations.map((p) => ({
    ...p,
    title: subs.find((s) => s.id === p.submissionId)?.title || "",
  }));

  return (
    <>
      {/* Action Items */}
      {actionItems.length > 0 && (
        <div>
          <h3 className="text-base font-semibold text-ink mb-3 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-amber-500" />
            สิ่งที่ต้องทำ
          </h3>
          <div className="space-y-2">
            {actionItems.map((item) => (
              <NextActionCard
                key={item.sub.id}
                action={item}
                paperTitle={item.sub.title}
                href={`/submissions/${item.sub.id}`}
                deadline={item.deadline}
                daysLeft={item.daysLeft}
              />
            ))}
          </div>
        </div>
      )}

      {/* Stats + Deadlines */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard label="บทความทั้งหมด" value={(stats.totalSubmissions as number) || 0} icon={<FileText className="h-5 w-5" />} accent="brand" />
            <StatCard label="แบบร่าง" value={byStatus.DRAFT || 0} icon={<Clock className="h-5 w-5" />} accent="warning" />
            <StatCard label="อยู่ระหว่างรีวิว" value={(byStatus.SUBMITTED || 0) + (byStatus.UNDER_REVIEW || 0)} icon={<Send className="h-5 w-5" />} accent="info" />
            <StatCard label="ตอบรับ" value={byStatus.ACCEPTED || 0} icon={<CheckCircle2 className="h-5 w-5" />} accent="success" />
          </div>
        </div>

        <Card>
          <CardHeader>
            <h3 className="text-sm font-semibold text-ink flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              กำหนดการ
            </h3>
          </CardHeader>
          <CardBody className="space-y-2.5 py-2">
            {deadlineList.map((d) => {
              const isPast = d.daysLeft < 0;
              return (
                <div key={d.key} className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-xs font-medium text-ink">{d.label}</p>
                    <p className="text-[11px] text-ink-muted">{formatDate(d.date)}</p>
                  </div>
                  <Badge tone={isPast ? "neutral" : d.daysLeft <= 7 ? "danger" : d.daysLeft <= 30 ? "warning" : "info"}>
                    {isPast ? "ผ่านแล้ว" : `${d.daysLeft} วัน`}
                  </Badge>
                </div>
              );
            })}
          </CardBody>
        </Card>
      </div>

      {/* Submission Pipeline Overview */}
      {subs.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-ink">สถานะบทความของฉัน</h3>
              <Link href="/submissions">
                <Button variant="ghost" size="sm">ดูทั้งหมด <ArrowRight className="h-3.5 w-3.5" /></Button>
              </Link>
            </div>
          </CardHeader>
          <CardBody className="space-y-4">
            {subs.map((s) => (
              <Link key={s.id} href={`/submissions/${s.id}`}>
                <div className="rounded-xl border border-border p-4 hover:bg-surface-hover transition-colors cursor-pointer">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-ink truncate">{s.title}</p>
                      <div className="flex items-center gap-2 mt-1">
                        {s.trackName && <span className="text-[11px] text-ink-muted">{s.trackName}</span>}
                        {s.reviewTotal > 0 && (
                          <span className="text-[11px] text-brand-600 font-medium">
                            รีวิว {s.reviewCompleted}/{s.reviewTotal}
                          </span>
                        )}
                      </div>
                    </div>
                    <Badge tone={SUBMISSION_STATUS_COLORS[s.status] || "neutral"}>
                      {SUBMISSION_STATUS_LABELS[s.status] || s.status}
                    </Badge>
                  </div>
                  <SubmissionPipeline status={s.status} compact />
                </div>
              </Link>
            ))}
          </CardBody>
        </Card>
      )}

      {/* Presentations */}
      {presWithTitle.length > 0 && (
        <Card accent="success">
          <CardHeader>
            <h3 className="text-sm font-semibold text-ink flex items-center gap-2">
              <Mic className="h-4 w-4" />
              การนำเสนอของฉัน
            </h3>
          </CardHeader>
          <CardBody className="space-y-2">
            {presWithTitle.map((p, i) => (
              <div key={i} className="flex items-center justify-between bg-surface-alt rounded-lg p-3">
                <div>
                  <p className="text-sm font-medium text-ink">{p.title}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge tone={p.type === "ORAL" ? "info" : "neutral"}>
                      {p.type === "ORAL" ? "นำเสนอปากเปล่า" : "โปสเตอร์"}
                    </Badge>
                    {p.room && <span className="text-xs text-ink-muted">{p.room}</span>}
                    {p.scheduledAt && <span className="text-xs text-ink-muted">{formatDate(p.scheduledAt)}</span>}
                  </div>
                </div>
                <Badge tone={p.status === "SCHEDULED" ? "success" : "warning"}>
                  {p.status === "SCHEDULED" ? "กำหนดแล้ว" : "รอกำหนด"}
                </Badge>
              </div>
            ))}
          </CardBody>
        </Card>
      )}

      {/* CTA if no submissions */}
      {subs.length === 0 && (
        <Card>
          <CardBody className="flex items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-semibold text-ink">ส่งบทความใหม่</h3>
              <p className="text-sm text-ink-muted mt-0.5">เริ่มต้นส่งบทความวิจัยของคุณ</p>
            </div>
            <Link href="/submissions/new">
              <Button><Plus className="h-4 w-4" />ส่งบทความ</Button>
            </Link>
          </CardBody>
        </Card>
      )}
    </>
  );
}
