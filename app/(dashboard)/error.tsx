"use client";

import { Button } from "@/components/ui/button";
import { AlertCircle } from "lucide-react";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
      <AlertCircle className="h-12 w-12 text-danger mb-4" />
      <h2 className="text-lg font-bold text-ink mb-2">เกิดข้อผิดพลาด</h2>
      <p className="text-sm text-ink-muted mb-6 max-w-md">
        {error.message || "เกิดข้อผิดพลาดที่ไม่คาดคิด กรุณาลองใหม่อีกครั้ง"}
      </p>
      <Button onClick={reset}>ลองอีกครั้ง</Button>
    </div>
  );
}
