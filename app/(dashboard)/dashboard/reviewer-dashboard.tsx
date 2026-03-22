"use client";

import { StatCard } from "@/components/ui/stat-card";
import { Card, CardBody } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ClipboardCheck, Clock, CheckCircle2, ArrowRight } from "lucide-react";
import Link from "next/link";

export default function ReviewerDashboard({ stats }: { stats: Record<string, unknown> }) {
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
