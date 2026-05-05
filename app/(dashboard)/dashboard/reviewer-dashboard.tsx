"use client";

import { useState } from "react";
import Link from "next/link";
import { StatCard } from "@/components/ui/stat-card";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useI18n } from "@/lib/i18n";
import { formatDate } from "@/lib/utils";
import {
  ClipboardCheck, Clock, CheckCircle2, ArrowRight, ListTodo,
  AlertTriangle, ChevronRight, FileText,
} from "lucide-react";

interface TopPendingItem {
  id: string;
  submissionId: string;
  title: string;
  trackName: string | null;
  status: string;
  dueDate: string | null;
}

export default function ReviewerDashboard({ stats }: { stats: Record<string, unknown> }) {
  const { t, locale } = useI18n();
  const totalAssignments = (stats.totalAssignments as number) || 0;
  const pendingCount = (stats.pending as number) || 0;
  const completedCount = (stats.completed as number) || 0;
  const remainingCount = Math.max(totalAssignments - completedCount, 0);
  const topPending = (stats.topPending as TopPendingItem[]) || [];
  const [now] = useState(() => Date.now());

  function isOverdue(dueDate: string | null) {
    if (!dueDate) return false;
    return new Date(dueDate).getTime() < now;
  }

  function isDueSoon(dueDate: string | null) {
    if (!dueDate) return false;
    const diff = new Date(dueDate).getTime() - now;
    return diff > 0 && diff < 3 * 24 * 60 * 60 * 1000;
  }

  const hasOverdue = topPending.some((item) => isOverdue(item.dueDate));

  return (
    <div className="space-y-6">
      {hasOverdue && (
        <Alert tone="danger">
          <div className="flex items-center justify-between gap-3">
            <span className="font-medium flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              {t("dashboard.reviewerOverdueAlert")}
            </span>
            <Link href="/reviews">
              <Button size="sm" variant="ghost" className="text-red-700 hover:bg-red-100">
                <ArrowRight className="h-3.5 w-3.5" />{t("dashboard.goToReviews")}
              </Button>
            </Link>
          </div>
        </Alert>
      )}
      {!hasOverdue && pendingCount > 0 && (
        <Alert tone="warning">
          <div className="flex items-center justify-between gap-3">
            <span className="font-medium">
              {t("dashboard.actionRequired")}: {t("dashboard.reviewerActionDesc", { n: pendingCount })}
            </span>
            <Link href="/reviews">
              <Button size="sm"><ArrowRight className="h-3.5 w-3.5" />{t("dashboard.goToReviews")}</Button>
            </Link>
          </div>
        </Alert>
      )}

      {/* 4 stat cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label={t("dashboard.assignedTasks")} value={totalAssignments} icon={<ClipboardCheck className="h-5 w-5" />} accent="brand" />
        <StatCard label={t("dashboard.pending")} value={pendingCount} icon={<Clock className="h-5 w-5" />} accent="warning" />
        <StatCard label={t("dashboard.completed")} value={completedCount} icon={<CheckCircle2 className="h-5 w-5" />} accent="success" />
        <StatCard label={t("dashboard.remaining")} value={remainingCount} icon={<ListTodo className="h-5 w-5" />} accent="info" />
      </div>

      {/* 2-col layout: pending queue + progress */}
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(280px,0.85fr)]">
        <section className="rounded-2xl border border-border bg-white p-5 shadow-elev-1">
          <div className="mb-4 flex items-end justify-between gap-3">
            <div className="space-y-1">
              <h2 className="text-base font-semibold text-ink">{t("dashboard.reviewerFocus")}</h2>
              <p className="text-sm text-ink-muted">
                {pendingCount > 0 ? t("dashboard.reviewerFocusDesc") : t("dashboard.noPendingEvaluations")}
              </p>
            </div>
            <Link href="/reviews">
              <Button size="sm" variant="secondary">
                {t("common.viewAll")} <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </Link>
          </div>

          {topPending.length === 0 ? (
            <div className="flex flex-col items-center gap-3 rounded-xl bg-surface-alt py-8 text-center">
              <CheckCircle2 className="h-9 w-9 text-emerald-400" />
              <p className="text-sm font-medium text-ink-muted">{t("dashboard.noPendingEvaluations")}</p>
            </div>
          ) : (
            <ul className="divide-y divide-border-light">
              {topPending.map((item) => {
                const overdue = isOverdue(item.dueDate);
                const dueSoon = !overdue && isDueSoon(item.dueDate);
                return (
                  <li key={item.id}>
                    <Link
                      href={`/submissions/${item.submissionId}${item.status === "ACCEPTED" ? "#section-review-form" : ""}`}
                      className="flex items-start gap-3 py-3 transition-colors hover:bg-surface-hover rounded-lg px-2 -mx-2 group"
                    >
                      <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                        overdue ? "bg-red-100 text-red-600" :
                        dueSoon ? "bg-amber-100 text-amber-600" :
                        item.status === "ACCEPTED" ? "bg-blue-100 text-blue-600" :
                        "bg-slate-100 text-slate-500"
                      }`}>
                        <FileText className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-ink line-clamp-2 leading-snug group-hover:text-brand-600">
                          {item.title}
                        </p>
                        <div className="mt-1.5 flex flex-wrap items-center gap-2">
                          {item.trackName && (
                            <Badge tone="info" className="text-[11px]">{item.trackName}</Badge>
                          )}
                          <Badge
                            tone={item.status === "ACCEPTED" ? "info" : "warning"}
                            className="text-[11px]"
                          >
                            {item.status === "ACCEPTED" ? t("reviews.inReview") : t("reviews.pending")}
                          </Badge>
                          {item.dueDate && (
                            <span className={`inline-flex items-center gap-1 text-[11px] ${
                              overdue ? "text-red-600 font-semibold" :
                              dueSoon ? "text-amber-600 font-medium" :
                              "text-ink-muted"
                            }`}>
                              {overdue && <AlertTriangle className="h-3 w-3" />}
                              {dueSoon && <Clock className="h-3 w-3" />}
                              {overdue ? t("dashboard.reviewerOverdue") : ""} {formatDate(item.dueDate, locale)}
                            </span>
                          )}
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 shrink-0 text-ink-muted group-hover:text-ink transition-colors" />
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}

          {pendingCount > topPending.length && (
            <div className="mt-3 border-t border-border-light pt-3">
              <Link href="/reviews">
                <Button variant="ghost" size="sm" className="w-full text-ink-muted">
                  {t("dashboard.reviewerMorePending", { n: pendingCount - topPending.length })}
                  <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </Link>
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-border bg-white p-5 shadow-elev-1">
          <div className="space-y-1">
            <h2 className="text-base font-semibold text-ink">{t("dashboard.reviewProgress")}</h2>
            <p className="text-sm text-ink-muted">{t("dashboard.reviewProgressDesc")}</p>
          </div>
          {totalAssignments > 0 ? (
            <div className="mt-4 space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-ink-muted">{t("dashboard.completed")}</span>
                <span className="font-semibold text-ink">{completedCount} / {totalAssignments}</span>
              </div>
              <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-bar-brand transition-all duration-700"
                  style={{ width: `${Math.round((completedCount / totalAssignments) * 100)}%` }}
                />
              </div>
              <p className="text-xs text-ink-muted">
                {Math.round((completedCount / totalAssignments) * 100)}% {t("dashboard.completionRate")}
              </p>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <div className="rounded-xl bg-amber-50 p-3 text-center">
                  <p className="text-2xl font-bold text-amber-600">{pendingCount}</p>
                  <p className="mt-0.5 text-xs text-amber-700">{t("dashboard.pending")}</p>
                </div>
                <div className="rounded-xl bg-emerald-50 p-3 text-center">
                  <p className="text-2xl font-bold text-emerald-600">{completedCount}</p>
                  <p className="mt-0.5 text-xs text-emerald-700">{t("dashboard.completed")}</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="mt-4 flex flex-col items-center gap-2 py-6 text-center">
              <ClipboardCheck className="h-8 w-8 text-ink-muted/40" />
              <p className="text-sm text-ink-muted">{t("reviews.noReviewTasksDesc")}</p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
