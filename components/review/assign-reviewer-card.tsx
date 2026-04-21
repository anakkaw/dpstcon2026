"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { useI18n } from "@/lib/i18n";
import { displayNameTh } from "@/lib/display-name";
import { UserPlus } from "lucide-react";

interface Reviewer {
  id: string;
  name: string;
  email: string;
  affiliation?: string | null;
  prefixTh?: string | null;
  firstNameTh?: string | null;
  lastNameTh?: string | null;
  /** Assignments awaiting reviewer response */
  pendingLoad?: number;
  /** Assignments the reviewer accepted and is working on */
  activeLoad?: number;
  /** Number of completed reviews */
  completedLoad?: number;
}

interface AssignReviewerCardProps {
  submissionId: string;
  reviewers: Reviewer[];
  /** IDs of reviewers already assigned to this submission */
  excludeReviewerIds?: string[];
  /** Called after successful assignment */
  onAssigned?: () => void;
  /** Called with error/success message */
  onMessage?: (text: string) => void;
  /** Show due date field */
  showDueDate?: boolean;
}

export function AssignReviewerCard({
  submissionId,
  reviewers,
  excludeReviewerIds = [],
  onAssigned,
  onMessage,
  showDueDate = false,
}: AssignReviewerCardProps) {
  const { t } = useI18n();
  const router = useRouter();
  const [selectedReviewer, setSelectedReviewer] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [assigning, setAssigning] = useState(false);

  const availableReviewers = reviewers.filter(
    (r) => !excludeReviewerIds.includes(r.id),
  );

  async function handleAssign() {
    if (!selectedReviewer) return;
    setAssigning(true);
    try {
      const res = await fetch("/api/reviews/assignments/manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          submissionId,
          reviewerId: selectedReviewer,
          dueDate: dueDate || undefined,
        }),
      });
      if (res.ok) {
        onMessage?.(t("reviews.assignmentAssigned"));
        setSelectedReviewer("");
        setDueDate("");
        onAssigned?.();
        router.refresh();
      } else {
        const data = await res.json();
        onMessage?.(data.error || t("reviews.assignFailed"));
      }
    } catch {
      onMessage?.(t("reviews.assignFailed"));
    }
    setAssigning(false);
  }

  return (
    <Card accent="info">
      <CardHeader>
        <h3 className="text-sm font-semibold text-ink flex items-center gap-2">
          <UserPlus className="h-4 w-4" />
          {t("reviews.assignReviewer")}
        </h3>
      </CardHeader>
      <CardBody>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <Field label={t("reviews.selectReviewer")} htmlFor={`reviewer-${submissionId}`}>
              <Select
                id={`reviewer-${submissionId}`}
                value={selectedReviewer}
                onChange={(e) => setSelectedReviewer(e.target.value)}
              >
                <option value="">{t("reviews.selectReviewer")}</option>
                {availableReviewers
                  .slice()
                  .sort((a, b) => ((a.activeLoad ?? 0) + (a.pendingLoad ?? 0)) - ((b.activeLoad ?? 0) + (b.pendingLoad ?? 0)))
                  .map((r) => {
                    const active = r.activeLoad ?? 0;
                    const pending = r.pendingLoad ?? 0;
                    const suffix =
                      active === 0 && pending === 0
                        ? ` · ${t("reviews.workloadFree")}`
                        : ` · ${t("reviews.workloadCompact", { active, pending })}`;
                    return (
                      <option key={r.id} value={r.id}>
                        {displayNameTh(r)}
                        {r.affiliation ? ` · ${r.affiliation}` : ""}
                        {suffix}
                      </option>
                    );
                  })}
              </Select>
            </Field>
            {selectedReviewer && (() => {
              const picked = availableReviewers.find((r) => r.id === selectedReviewer);
              if (!picked) return null;
              const active = picked.activeLoad ?? 0;
              const pending = picked.pendingLoad ?? 0;
              const done = picked.completedLoad ?? 0;
              const isHeavy = active >= 5;
              return (
                <div className={`mt-1 text-xs ${isHeavy ? "text-amber-700 font-medium" : "text-ink-muted"} space-y-0.5`}>
                  <p>
                    {isHeavy
                      ? t("reviews.workloadHeavy", { n: active })
                      : t("reviews.workloadSummary2", { active, pending, done })}
                  </p>
                  {picked.affiliation && <p className="text-ink-muted/80">{picked.affiliation}</p>}
                </div>
              );
            })()}
          </div>
          {showDueDate && (
            <div className="sm:w-40">
              <Field label={t("reviews.dueDate")} htmlFor={`due-${submissionId}`}>
                <Input
                  id={`due-${submissionId}`}
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                />
              </Field>
            </div>
          )}
          <Button
            onClick={handleAssign}
            loading={assigning}
            disabled={!selectedReviewer}
            size="sm"
          >
            {t("reviews.assign")}
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}
