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
  prefixTh?: string | null;
  firstNameTh?: string | null;
  lastNameTh?: string | null;
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
                {availableReviewers.map((r) => (
                  <option key={r.id} value={r.id}>
                    {displayNameTh(r)} ({r.email})
                  </option>
                ))}
              </Select>
            </Field>
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
