"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader, CardFooter } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { Textarea } from "@/components/ui/textarea";
import { Field } from "@/components/ui/field";
import { Badge } from "@/components/ui/badge";

interface SubmissionData {
  id: string;
  title: string;
  abstract: string | null;
  keywords: string | null;
  advisorName: string | null;
  author: { name: string; email: string; affiliation: string | null };
  event: { name: string; year: number } | null;
  track: { name: string } | null;
}

export default function AdvisorApprovalPage() {
  const params = useParams();
  const token = params.token as string;

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submission, setSubmission] = useState<SubmissionData | null>(null);
  const [alreadyResponded, setAlreadyResponded] = useState(false);
  const [responseMessage, setResponseMessage] = useState("");
  const [comments, setComments] = useState("");
  const [result, setResult] = useState<{ decision: string } | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`/api/advisor-approval/${token}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) {
          setError(data.error);
        } else {
          setSubmission(data.submission);
          setAlreadyResponded(data.alreadyResponded);
          if (data.message) setResponseMessage(data.message);
        }
      })
      .catch(() => setError("ไม่สามารถโหลดข้อมูลได้"))
      .finally(() => setLoading(false));
  }, [token]);

  async function handleDecision(decision: "APPROVED" | "REJECTED") {
    setSubmitting(true);
    try {
      const res = await fetch(`/api/advisor-approval/${token}/respond`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision, comments }),
      });
      const data = await res.json();
      if (data.error) {
        setError(data.error);
      } else {
        setResult({ decision: data.decision });
      }
    } catch {
      setError("เกิดข้อผิดพลาด");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800">
        <div className="h-8 w-8 border-3 border-brand-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800 px-4">
        <Card className="max-w-lg w-full">
          <CardBody><Alert tone="danger">{error}</Alert></CardBody>
        </Card>
      </div>
    );
  }

  if (result) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800 px-4">
        <Card className="max-w-lg w-full" accent={result.decision === "APPROVED" ? "success" : "danger"}>
          <CardBody className="text-center py-10">
            <div className={`inline-flex h-16 w-16 rounded-full items-center justify-center mb-4 ${result.decision === "APPROVED" ? "bg-emerald-100" : "bg-red-100"}`}>
              <span className="text-3xl">{result.decision === "APPROVED" ? "✓" : "✗"}</span>
            </div>
            <h2 className="text-xl font-bold text-ink tracking-tight mb-2">
              {result.decision === "APPROVED" ? "รับรองบทความแล้ว" : "ปฏิเสธการรับรอง"}
            </h2>
            <p className="text-sm text-ink-muted">
              {result.decision === "APPROVED"
                ? "บทความจะถูกส่งเข้าระบบพิจารณาต่อไป"
                : "บทความจะถูกส่งกลับให้นักศึกษาแก้ไข"}
            </p>
          </CardBody>
        </Card>
      </div>
    );
  }

  if (alreadyResponded) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800 px-4">
        <Card className="max-w-lg w-full">
          <CardBody><Alert tone="info">{responseMessage}</Alert></CardBody>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 py-10 px-4">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="text-center">
          <div className="inline-flex h-14 w-14 rounded-2xl bg-gradient-to-br from-brand-400 to-brand-600 items-center justify-center mb-4 shadow-2xl shadow-brand-500/40">
            <span className="text-white font-bold text-2xl">D</span>
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">ขอรับรองบทความ</h1>
          <p className="text-xs text-slate-400 mt-1">DPSTCon Conference Management System</p>
        </div>

        <Card>
          <CardHeader>
            <h2 className="text-sm font-semibold text-ink">ข้อมูลบทความ</h2>
          </CardHeader>
          <CardBody className="space-y-4">
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">ชื่อบทความ</p>
              <p className="text-sm font-semibold text-ink mt-0.5">{submission?.title}</p>
            </div>
            {submission?.abstract && (
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">บทคัดย่อ</p>
                <p className="text-sm text-ink whitespace-pre-wrap mt-0.5 leading-relaxed">{submission.abstract}</p>
              </div>
            )}
            {submission?.keywords && (
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">คำสำคัญ</p>
                <p className="text-sm text-ink mt-0.5">{submission.keywords}</p>
              </div>
            )}
            <div className="flex gap-8">
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Author</p>
                <p className="text-sm text-ink mt-0.5">{submission?.author.name}</p>
                {submission?.author.affiliation && (
                  <p className="text-xs text-gray-500">{submission.author.affiliation}</p>
                )}
              </div>
              {submission?.event && (
                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">งานประชุม</p>
                  <p className="text-sm text-ink mt-0.5">{submission.event.name} {submission.event.year}</p>
                </div>
              )}
              {submission?.track && (
                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">สาขา</p>
                  <Badge className="mt-0.5">{submission.track.name}</Badge>
                </div>
              )}
            </div>
          </CardBody>
        </Card>

        <Card accent="brand">
          <CardHeader>
            <h2 className="text-sm font-semibold text-ink">ดำเนินการรับรอง</h2>
          </CardHeader>
          <CardBody>
            <Field label="ความคิดเห็น (ไม่บังคับ)" htmlFor="comments">
              <Textarea
                id="comments"
                value={comments}
                onChange={(e) => setComments(e.target.value)}
                placeholder="หมายเหตุหรือความคิดเห็นเพิ่มเติม..."
                rows={3}
              />
            </Field>
          </CardBody>
          <CardFooter className="flex justify-end gap-3">
            <Button variant="danger" onClick={() => handleDecision("REJECTED")} loading={submitting}>
              ปฏิเสธการรับรอง
            </Button>
            <Button onClick={() => handleDecision("APPROVED")} loading={submitting}>
              รับรองบทความ
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
