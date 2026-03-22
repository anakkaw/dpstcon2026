"use client";

import { Card, CardBody } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";
import Link from "next/link";

export default function CommitteeDashboard() {
  const { t } = useI18n();

  return (
    <Card>
      <CardBody className="flex items-center justify-between gap-4">
        <p className="text-sm text-ink-muted">{t("dashboard.noPendingEvaluations")}</p>
        <div className="flex gap-2">
          <Link href="/presentations/oral"><Button variant="secondary" size="sm">Oral</Button></Link>
          <Link href="/presentations/poster"><Button variant="secondary" size="sm">Poster</Button></Link>
        </div>
      </CardBody>
    </Card>
  );
}
