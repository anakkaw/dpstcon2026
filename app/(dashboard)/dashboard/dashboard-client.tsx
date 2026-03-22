"use client";

import { StatCard } from "@/components/ui/stat-card";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ROLE_LABELS,
  SUBMISSION_STATUS_LABELS,
  SUBMISSION_STATUS_COLORS,
} from "@/lib/labels";
import {
  FileText, ClipboardCheck, Users, BarChart3, Send, Clock, CheckCircle2,
  Plus, UserPlus, Settings, Download, ArrowRight, Sparkles, Calendar, Mic,
} from "lucide-react";
import Link from "next/link";
import { SubmissionPipeline } from "@/components/author/submission-pipeline";
import { NextActionCard } from "@/components/author/next-action-card";
import { getNextAction, getDaysUntil, getDeadlineUrgency, getRelevantDeadlineKey } from "@/lib/author-utils";
import { formatDate } from "@/lib/utils";

interface DashboardClientProps {
  role: string;
  userName: string;
  stats: Record<string, unknown>;
}

export function DashboardClient({ role, userName, stats }: DashboardClientProps) {
  const isAdmin = ["ADMIN", "PROGRAM_CHAIR"].includes(role);

  return (
    <div className="max-w-6xl flex flex-col gap-8">
      {/* Welcome banner */}
      <div className="bg-welcome-gradient rounded-2xl p-8 text-white shadow-xl relative overflow-hidden">
        {/* Decorative orbs */}
        <div className="absolute -top-20 -right-20 w-72 h-72 rounded-full opacity-20 blur-3xl bg-orb-brand" />
        <div className="absolute -bottom-16 -left-16 w-56 h-56 rounded-full opacity-10 blur-2xl bg-orb-brand" />
        {/* Content */}
        <div className="relative">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="h-4 w-4 text-amber-400" />
            <p className="text-amber-300 text-sm font-medium">{ROLE_LABELS[role] || role} — DPSTCon 2026</p>
          </div>
          <h1 className="text-3xl font-bold">สวัสดี, {userName}</h1>
          <p className="text-slate-400 text-sm mt-2">ยินดีต้อนรับสู่ระบบจัดการบทความวิชาการ</p>
        </div>
      </div>

      {role === "AUTHOR" && <AuthorDashboard stats={stats} />}
      {role === "REVIEWER" && <ReviewerDashboard stats={stats} />}
      {isAdmin && <AdminDashboard stats={stats} />}
      {role === "COMMITTEE" && <CommitteeDashboard />}
    </div>
  );
}

/* ================================================================
   Author Dashboard
   ================================================================ */

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

function AuthorDashboard({ stats }: { stats: Record<string, unknown> }) {
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

/* ================================================================
   Reviewer Dashboard
   ================================================================ */
function ReviewerDashboard({ stats }: { stats: Record<string, unknown> }) {
  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <StatCard label="งานที่ได้รับมอบหมาย" value={(stats.totalAssignments as number) || 0} icon={<ClipboardCheck className="h-5 w-5" />} accent="brand" />
        <StatCard label="รอดำเนินการ" value={(stats.pending as number) || 0} icon={<Clock className="h-5 w-5" />} accent="warning" />
        <StatCard label="เสร็จสิ้น" value={(stats.completed as number) || 0} icon={<CheckCircle2 className="h-5 w-5" />} accent="success" />
      </div>

      {((stats.pending as number) || 0) > 0 && (
        <Card accent="warning">
          <CardBody className="flex items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-semibold text-ink">มีงานรอดำเนินการ</h3>
              <p className="text-sm text-ink-muted mt-0.5">กรุณาตรวจสอบบทความที่ได้รับมอบหมาย</p>
            </div>
            <Link href="/reviews">
              <Button><ArrowRight className="h-4 w-4" />ไปยังงานรีวิว</Button>
            </Link>
          </CardBody>
        </Card>
      )}
    </>
  );
}

/* ================================================================
   Admin / Program Chair Dashboard
   ================================================================ */

/* Full static class strings — Tailwind v4 scanner finds these */
const quickActions = [
  { href: "/admin/users", icon: <UserPlus className="h-5 w-5" />, label: "จัดการผู้ใช้", sub: "เพิ่ม/แก้ไข/import", cardBg: "bg-action-blue", iconBg: "bg-blue-500", iconShadow: "shadow-blue-glow" },
  { href: "/submissions", icon: <FileText className="h-5 w-5" />, label: "จัดการบทความ", sub: "ดู/มอบหมาย/ตัดสิน", cardBg: "bg-action-orange", iconBg: "bg-brand-500", iconShadow: "shadow-brand-glow" },
  { href: "/deadlines", icon: <Settings className="h-5 w-5" />, label: "กำหนดการ", sub: "ตั้งค่าวันสำคัญ", cardBg: "bg-action-green", iconBg: "bg-emerald-500", iconShadow: "shadow-emerald-glow" },
  { href: "/api/exports/proceedings?format=csv", icon: <Download className="h-5 w-5" />, label: "Export ข้อมูล", sub: "ดาวน์โหลด CSV", cardBg: "bg-action-violet", iconBg: "bg-violet-500", iconShadow: "shadow-violet-glow", isExternal: true },
];

const barClasses = [
  "bg-bar-brand",
  "bg-bar-blue",
  "bg-bar-green",
  "bg-bar-violet",
  "bg-bar-pink",
  "bg-bar-amber",
];

function AdminDashboard({ stats }: { stats: Record<string, unknown> }) {
  const byStatus = (stats.submissionsByStatus || {}) as Record<string, number>;
  const byTrack = (stats.submissionsByTrack || []) as { name: string; count: number }[];
  const totalSubs = (stats.totalSubmissions as number) || 0;

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <StatCard label="บทความทั้งหมด" value={(stats.totalSubmissions as number) || 0} icon={<FileText className="h-5 w-5" />} accent="brand" />
        <StatCard label="Reviewers" value={(stats.totalReviewers as number) || 0} icon={<Users className="h-5 w-5" />} accent="info" />
        <StatCard label="รีวิวทั้งหมด" value={(stats.totalReviews as number) || 0} icon={<ClipboardCheck className="h-5 w-5" />} accent="warning" />
        <StatCard label="ตอบรับ" value={byStatus.ACCEPTED || 0} icon={<BarChart3 className="h-5 w-5" />} accent="success" />
      </div>

      {/* Quick Actions */}
      <div>
        <h3 className="text-base font-semibold text-ink mb-4">การดำเนินการด่วน</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {quickActions.map((item) => {
            const Wrapper = item.isExternal ? "a" : Link;
            const extraProps = item.isExternal ? { download: true } : {};
            return (
              <Wrapper key={item.label} href={item.href} {...(extraProps as Record<string, unknown>)}>
                <div className={`group rounded-2xl border border-border p-5 hover:shadow-lg hover:-translate-y-1 transition-all duration-300 cursor-pointer ${item.cardBg}`}>
                  <div className={`h-12 w-12 rounded-xl flex items-center justify-center text-white mb-4 group-hover:scale-110 transition-transform duration-300 ${item.iconBg} ${item.iconShadow}`}>
                    {item.icon}
                  </div>
                  <p className="text-sm font-semibold text-ink">{item.label}</p>
                  <p className="text-xs text-ink-muted mt-0.5">{item.sub}</p>
                </div>
              </Wrapper>
            );
          })}
        </div>
      </div>

      {/* Status + Track breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {Object.keys(byStatus).length > 0 && (
          <Card>
            <CardHeader><h3 className="text-base font-semibold text-ink">สรุปตามสถานะ</h3></CardHeader>
            <CardBody>
              <div className="flex flex-wrap gap-2">
                {Object.entries(byStatus).map(([status, count]) => (
                  <Badge key={status} tone={SUBMISSION_STATUS_COLORS[status] || "neutral"}>
                    {SUBMISSION_STATUS_LABELS[status] || status}: {count}
                  </Badge>
                ))}
              </div>
            </CardBody>
          </Card>
        )}

        {byTrack.length > 0 && (
          <Card>
            <CardHeader><h3 className="text-base font-semibold text-ink">สรุปตามสาขาวิชา</h3></CardHeader>
            <CardBody>
              <div className="space-y-4">
                {byTrack.map((t, i) => {
                  const pct = Math.round((t.count / Math.max(totalSubs, 1)) * 100);
                  return (
                    <div key={i}>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-sm font-medium text-ink">{t.name}</span>
                        <span className="text-sm font-bold text-ink">{t.count}</span>
                      </div>
                      <div className="w-full h-2.5 rounded-full bg-gray-100 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-700 ${barClasses[i % barClasses.length]}`}
                          style={{ width: `${Math.max(pct, 4)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardBody>
          </Card>
        )}
      </div>
    </>
  );
}

/* ================================================================
   Committee Dashboard
   ================================================================ */
function CommitteeDashboard() {
  return (
    <Card>
      <CardBody className="flex items-center justify-between gap-4">
        <p className="text-sm text-ink-muted">ไม่มีงานประเมินที่รอดำเนินการในขณะนี้</p>
        <div className="flex gap-2">
          <Link href="/presentations/oral"><Button variant="secondary" size="sm">Oral</Button></Link>
          <Link href="/presentations/poster"><Button variant="secondary" size="sm">Poster</Button></Link>
        </div>
      </CardBody>
    </Card>
  );
}
