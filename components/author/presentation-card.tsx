"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Collapsible } from "@/components/ui/collapsible";
import { RubricManager } from "@/components/presentations/rubric-manager";
import { formatDateTime } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";
import type { PresentationRubricCriterion } from "@/server/presentation-rubrics";
import { Mic, Image as ImageIcon, MapPin, Clock } from "lucide-react";

interface PresentationData {
  type: string;
  status: string;
  paperCode?: string | null;
  scheduledAt?: string | null;
  room?: string | null;
  duration?: number | null;
}

interface PresentationCardProps {
  presentations: PresentationData[];
  criteriaByType: Record<"ORAL" | "POSTER", PresentationRubricCriterion[]>;
}

export function PresentationCard({
  presentations,
  criteriaByType,
}: PresentationCardProps) {
  const { t } = useI18n();
  if (presentations.length === 0) return null;

  return (
    <Card accent="success">
      <CardHeader>
        <h3 className="text-sm font-semibold text-ink flex items-center gap-2">
          <Mic className="h-4 w-4" />
          {t("presentations.presentation")}
        </h3>
      </CardHeader>
      <CardBody className="space-y-3">
        {presentations.map((pres, i) => (
          <div key={i} className="flex items-start gap-3 bg-surface-alt rounded-lg p-3">
            <div className="shrink-0 mt-0.5">
              {pres.type === "ORAL" ? (
                <Mic className="h-4 w-4 text-brand-500" />
              ) : (
                <ImageIcon className="h-4 w-4 text-violet-500" />
              )}
            </div>
            <div className="flex-1 space-y-1.5">
              <div className="flex items-center gap-2">
                <Badge tone={pres.type === "ORAL" ? "info" : "neutral"}>
                  {pres.type === "ORAL" ? t("presentations.oral") : t("presentations.poster")}
                </Badge>
                {pres.paperCode && <Badge>{pres.paperCode}</Badge>}
                <Badge tone={pres.status === "SCHEDULED" ? "success" : "warning"}>
                  {pres.status === "SCHEDULED" ? t("presentations.statusScheduled") : pres.status === "COMPLETED" ? t("presentations.completedStatus") : t("presentations.statusPending")}
                </Badge>
              </div>

              {pres.scheduledAt && (
                <p className="text-xs text-ink flex items-center gap-1.5">
                  <Clock className="h-3 w-3 text-ink-muted" />
                  {formatDateTime(pres.scheduledAt)}
                  {pres.duration && <span className="text-ink-muted">({pres.duration} {t("presentations.minutes")})</span>}
                </p>
              )}

              {pres.room && (
                <p className="text-xs text-ink flex items-center gap-1.5">
                  <MapPin className="h-3 w-3 text-ink-muted" />
                  {pres.room}
                </p>
              )}

              {!pres.scheduledAt && !pres.room && (
                <p className="text-xs text-ink-muted">{t("presentations.pendingAnnouncement")}</p>
              )}
            </div>
          </div>
        ))}

        {presentations.map((presentation, index) => {
          const criteria =
            presentation.type === "POSTER"
              ? criteriaByType.POSTER
              : criteriaByType.ORAL;

          if (!criteria || criteria.length === 0) return null;

          return (
            <Collapsible
              key={`${presentation.type}-${index}`}
              title={`${t("presentations.evaluationCriteria")} · ${
                presentation.type === "POSTER"
                  ? t("presentations.poster")
                  : t("presentations.oral")
              }`}
              defaultOpen={false}
            >
              <RubricManager criteria={criteria} />
            </Collapsible>
          );
        })}
      </CardBody>
    </Card>
  );
}
