"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Collapsible } from "@/components/ui/collapsible";
import { formatDateTime } from "@/lib/utils";
import { Mic, Image, MapPin, Clock, Award } from "lucide-react";

interface PresentationData {
  type: string;
  status: string;
  scheduledAt?: string | null;
  room?: string | null;
  duration?: number | null;
}

interface CriterionData {
  id: string;
  name: string;
  description?: string | null;
  maxScore: number;
  weight: number;
}

interface PresentationCardProps {
  presentations: PresentationData[];
  criteria: CriterionData[];
}

export function PresentationCard({ presentations, criteria }: PresentationCardProps) {
  if (presentations.length === 0) return null;

  return (
    <Card accent="success">
      <CardHeader>
        <h3 className="text-sm font-semibold text-ink flex items-center gap-2">
          <Mic className="h-4 w-4" />
          การนำเสนอ
        </h3>
      </CardHeader>
      <CardBody className="space-y-3">
        {presentations.map((pres, i) => (
          <div key={i} className="flex items-start gap-3 bg-surface-alt rounded-lg p-3">
            <div className="shrink-0 mt-0.5">
              {pres.type === "ORAL" ? (
                <Mic className="h-4 w-4 text-brand-500" />
              ) : (
                <Image className="h-4 w-4 text-violet-500" />
              )}
            </div>
            <div className="flex-1 space-y-1.5">
              <div className="flex items-center gap-2">
                <Badge tone={pres.type === "ORAL" ? "info" : "neutral"}>
                  {pres.type === "ORAL" ? "นำเสนอปากเปล่า" : "โปสเตอร์"}
                </Badge>
                <Badge tone={pres.status === "SCHEDULED" ? "success" : "warning"}>
                  {pres.status === "SCHEDULED" ? "กำหนดแล้ว" : pres.status === "COMPLETED" ? "เสร็จสิ้น" : "รอกำหนด"}
                </Badge>
              </div>

              {pres.scheduledAt && (
                <p className="text-xs text-ink flex items-center gap-1.5">
                  <Clock className="h-3 w-3 text-ink-muted" />
                  {formatDateTime(pres.scheduledAt)}
                  {pres.duration && <span className="text-ink-muted">({pres.duration} นาที)</span>}
                </p>
              )}

              {pres.room && (
                <p className="text-xs text-ink flex items-center gap-1.5">
                  <MapPin className="h-3 w-3 text-ink-muted" />
                  {pres.room}
                </p>
              )}

              {!pres.scheduledAt && !pres.room && (
                <p className="text-xs text-ink-muted">รอประกาศกำหนดการและสถานที่</p>
              )}
            </div>
          </div>
        ))}

        {criteria.length > 0 && (
          <Collapsible title="เกณฑ์การประเมิน" defaultOpen={false}>
            <div className="space-y-2">
              {criteria.map((c) => (
                <div key={c.id} className="flex items-start gap-2">
                  <Award className="h-3.5 w-3.5 text-amber-500 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-ink">{c.name}</span>
                      <span className="text-[10px] text-ink-muted">
                        {c.maxScore} คะแนน (x{c.weight})
                      </span>
                    </div>
                    {c.description && (
                      <p className="text-[11px] text-ink-muted mt-0.5">{c.description}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </Collapsible>
        )}
      </CardBody>
    </Card>
  );
}
