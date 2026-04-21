"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { useI18n } from "@/lib/i18n";
import { formatDate } from "@/lib/utils";
import { getAssignmentStatusLabels } from "@/lib/labels";
import {
  ClipboardCheck,
  AlertTriangle,
  Clock,
  CheckCircle,
  XCircle,
  ExternalLink,
} from "lucide-react";

const STATUS_COLORS: Record<string, "neutral" | "success" | "warning" | "danger" | "info"> = {
  PENDING: "warning",
  ACCEPTED: "info",
  DECLINED: "neutral",
  COMPLETED: "success",
  OVERDUE: "danger",
};

export interface MyReviewTask {
  id: string;
  status: string;
  dueDate: string | null;
  submission: {
    id: string;
    title: string;
    track: { id: string; name: string } | null;
  };
}

interface MyReviewTasksCardProps {
  tasks: MyReviewTask[];
  /** Header layout variant. "section" draws as a standalone section (used on /reviews and /submissions), "compact" is leaner for the dashboard. */
  variant?: "section" | "compact";
}

function isOverdue(dueDate: string | null, now: number) {
  if (!dueDate) return false;
  return new Date(dueDate).getTime() < now;
}

function isDueSoon(dueDate: string | null, now: number) {
  if (!dueDate) return false;
  const diff = new Date(dueDate).getTime() - now;
  return diff > 0 && diff < 3 * 24 * 60 * 60 * 1000;
}

export function MyReviewTasksCard({
  tasks,
  variant = "section",
}: MyReviewTasksCardProps) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const assignmentLabels = getAssignmentStatusLabels(t);
  const [respondingId, setRespondingId] = useState<string | null>(null);
  const now = Date.now();

  if (tasks.length === 0) return null;

  const overdueCount = tasks.filter(
    (task) => task.status !== "DECLINED" && isOverdue(task.dueDate, now)
  ).length;

  async function handleRespond(assignmentId: string, response: "ACCEPTED" | "DECLINED") {
    setRespondingId(assignmentId);
    try {
      const res = await fetch(`/api/reviews/assignments/${assignmentId}/respond`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ response }),
      });
      if (res.ok) {
        router.refresh();
      }
    } catch {
      /* swallow — user can retry */
    } finally {
      setRespondingId(null);
    }
  }

  const tasksList = (
    <Card accent="brand">
      <CardBody className="space-y-2">
        {tasks.map((task) => {
          const overdue = task.status !== "DECLINED" && isOverdue(task.dueDate, now);
          const dueSoon =
            !overdue && task.status !== "DECLINED" && isDueSoon(task.dueDate, now);
          return (
            <div
              key={task.id}
              className="flex flex-col gap-3 rounded-lg border border-border-light bg-white p-3 transition-all hover:shadow-sm sm:flex-row sm:items-center"
            >
              <Link
                href={`/submissions/${task.submission.id}${task.status === "ACCEPTED" ? "#section-review-form" : ""}`}
                className="min-w-0 flex-1"
              >
                <span className="block truncate text-sm font-semibold text-ink hover:text-brand-600">
                  {task.submission.title}
                </span>
                <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-ink-muted">
                  {task.submission.track && (
                    <Badge tone="info">{task.submission.track.name}</Badge>
                  )}
                  <Badge tone={STATUS_COLORS[task.status] || "neutral"} dot>
                    {assignmentLabels[task.status] || task.status}
                  </Badge>
                  {task.dueDate && (
                    <span
                      className={`inline-flex items-center gap-1 ${
                        overdue
                          ? "font-semibold text-red-600"
                          : dueSoon
                            ? "font-medium text-amber-600"
                            : ""
                      }`}
                    >
                      {overdue && <AlertTriangle className="h-3 w-3" />}
                      {dueSoon && <Clock className="h-3 w-3" />}
                      {t("reviews.due")} {formatDate(task.dueDate, locale)}
                    </span>
                  )}
                </div>
              </Link>
              <div className="flex shrink-0 gap-2">
                {task.status === "PENDING" && (
                  <>
                    <Button
                      size="sm"
                      onClick={() => handleRespond(task.id, "ACCEPTED")}
                      loading={respondingId === task.id}
                    >
                      <CheckCircle className="h-3.5 w-3.5" />
                      {t("reviews.accept")}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-red-600 hover:bg-red-50"
                      onClick={() => handleRespond(task.id, "DECLINED")}
                      loading={respondingId === task.id}
                    >
                      <XCircle className="h-3.5 w-3.5" />
                      {t("reviews.decline")}
                    </Button>
                  </>
                )}
                {task.status === "ACCEPTED" && (
                  <Link
                    href={`/submissions/${task.submission.id}#section-review-form`}
                  >
                    <Button size="sm">
                      <ExternalLink className="h-3.5 w-3.5" />
                      {t("reviews.writeReview")}
                    </Button>
                  </Link>
                )}
              </div>
            </div>
          );
        })}
      </CardBody>
    </Card>
  );

  if (variant === "compact") {
    return tasksList;
  }

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-0.5">
          <h2 className="flex items-center gap-2 text-base font-semibold text-ink">
            <ClipboardCheck className="h-4 w-4 text-brand-600" />
            {t("reviews.myReviewTasksHeading")}
          </h2>
          <p className="text-sm text-ink-muted">
            {t("reviews.myReviewTasksSubtitle", { n: tasks.length })}
          </p>
        </div>
        {overdueCount > 0 && (
          <Badge tone="danger">
            <AlertTriangle className="h-3 w-3" />
            {t("reviews.overdueCount", { n: overdueCount })}
          </Badge>
        )}
      </div>
      {tasksList}
    </section>
  );
}
