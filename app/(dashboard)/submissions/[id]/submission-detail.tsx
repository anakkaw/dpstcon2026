"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Field } from "@/components/ui/field";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { Divider } from "@/components/ui/divider";
import { Collapsible } from "@/components/ui/collapsible";
import { Alert } from "@/components/ui/alert";
import {
  SUBMISSION_STATUS_LABELS,
  SUBMISSION_STATUS_COLORS,
  RECOMMENDATION_LABELS,
  DECISION_LABELS,
} from "@/lib/labels";
import { formatDateTime, formatDate } from "@/lib/utils";
import { submitPaper, withdrawPaper, resubmitPaper } from "@/server/actions/submission";
import { FileUpload } from "@/components/ui/file-upload";
import { FileList } from "@/components/ui/file-list";
import { SubmissionPipeline } from "@/components/author/submission-pipeline";
import { ReviewProgress } from "@/components/author/review-progress";
import { PresentationCard } from "@/components/author/presentation-card";
import { getNextAction, getRelevantDeadlineKey, getDaysUntil } from "@/lib/author-utils";
import {
  UserPlus, Gavel, Send, RotateCcw, Paperclip, AlertTriangle,
  FileText, Clock, CheckCircle2, XCircle, Zap, Calendar,
} from "lucide-react";

interface Props {
  submission: {
    id: string;
    title: string;
    abstract: string | null;
    keywords: string | null;
    status: string;
    fileUrl: string | null;
    advisorEmail: string | null;
    advisorName: string | null;
    advisorApprovalStatus: string | null;
    rebuttalText: string | null;
    submittedAt: Date | null;
    createdAt: Date;
    author: { id: string; name: string; email: string; affiliation: string | null };
    track: { id: string; name: string } | null;
    coAuthors: { id: string; name: string; email: string | null; affiliation: string | null }[];
    reviews: {
      id: string;
      recommendation: string | null;
      commentsToAuthor: string | null;
      commentsToChair: string | null;
      completedAt: Date | null;
      reviewer: { id: string; name: string };
    }[];
    discussions: {
      id: string;
      message: string;
      createdAt: Date;
      author: { id: string; name: string };
    }[];
  };
  currentUserRole: string;
  currentUserId: string;
  reviewers: { id: string; name: string; email: string }[];
  files: {
    id: string;
    originalName: string;
    mimeType: string;
    size: number;
    kind: string;
    uploadedAt: string;
  }[];
  reviewCounts?: { total: number; completed: number };
  decision?: {
    outcome: string;
    comments: string | null;
    conditions: string | null;
    decidedAt: string;
  } | null;
  presentations?: {
    type: string;
    status: string;
    scheduledAt: string | null;
    room: string | null;
    duration: number | null;
  }[];
  criteria?: {
    id: string;
    name: string;
    description: string | null;
    maxScore: number;
    weight: number;
  }[];
  deadlines?: Record<string, string>;
}

export function SubmissionDetail({
  submission, currentUserRole, currentUserId, reviewers, files,
  reviewCounts, decision, presentations, criteria, deadlines,
}: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const isOwner = submission.author.id === currentUserId;
  const isAdmin = ["ADMIN", "PROGRAM_CHAIR"].includes(currentUserRole);
  const isAuthor = currentUserRole === "AUTHOR";
  const canSubmit = isOwner && submission.status === "DRAFT";
  const canWithdraw = isOwner && !["WITHDRAWN", "DRAFT"].includes(submission.status);
  const canResubmit = isOwner && submission.status === "REVISION_REQUIRED";

  const [selectedReviewer, setSelectedReviewer] = useState("");
  const [assigning, setAssigning] = useState(false);
  const [decisionOutcome, setDecisionOutcome] = useState("");
  const [decisionComments, setDecisionComments] = useState("");
  const [deciding, setDeciding] = useState(false);
  const [discussionMsg, setDiscussionMsg] = useState("");
  const [posting, setPosting] = useState(false);

  // Computed values for author view
  const nextAction = isAuthor ? getNextAction(submission.status, !!submission.fileUrl) : null;
  const deadlineKey = isAuthor ? getRelevantDeadlineKey(submission.status) : null;
  const relevantDeadline = deadlineKey && deadlines ? deadlines[deadlineKey] : null;
  const daysLeft = relevantDeadline ? getDaysUntil(relevantDeadline) : null;

  async function handleSubmit() {
    const hasManuscript = files.some((f) => f.kind === "MANUSCRIPT");
    if (!hasManuscript) {
      setMessage("กรุณาอัปโหลดไฟล์ต้นฉบับบทความก่อนส่ง");
      return;
    }
    setLoading(true);
    try {
      await submitPaper(submission.id);
      router.refresh();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "เกิดข้อผิดพลาด");
    }
    setLoading(false);
  }

  async function handleWithdraw() {
    if (!confirm("คุณแน่ใจหรือไม่ที่จะถอนบทความนี้?")) return;
    setLoading(true);
    await withdrawPaper(submission.id);
    router.refresh();
    setLoading(false);
  }

  async function handleResubmit() {
    if (!confirm("คุณแน่ใจหรือไม่ที่จะส่งบทความแก้ไขใหม่?")) return;
    setLoading(true);
    await resubmitPaper(submission.id);
    router.refresh();
    setLoading(false);
  }

  async function handleAssignReviewer() {
    if (!selectedReviewer) return;
    setAssigning(true);
    try {
      const res = await fetch("/api/reviews/assignments/manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ submissionId: submission.id, reviewerId: selectedReviewer }),
      });
      if (res.ok) {
        setMessage("มอบหมาย reviewer สำเร็จ");
        setSelectedReviewer("");
        router.refresh();
      } else {
        const data = await res.json();
        setMessage(data.error || "เกิดข้อผิดพลาด");
      }
    } catch { setMessage("เกิดข้อผิดพลาด"); }
    setAssigning(false);
  }

  async function handleDecision() {
    if (!decisionOutcome) return;
    setDeciding(true);
    try {
      const res = await fetch("/api/reviews/decisions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ submissionId: submission.id, outcome: decisionOutcome, comments: decisionComments }),
      });
      if (res.ok) {
        setMessage("ตัดสินบทความสำเร็จ");
        router.refresh();
      } else {
        const data = await res.json();
        setMessage(data.error || "เกิดข้อผิดพลาด");
      }
    } catch { setMessage("เกิดข้อผิดพลาด"); }
    setDeciding(false);
  }

  async function handlePostDiscussion() {
    if (!discussionMsg.trim()) return;
    setPosting(true);
    try {
      await fetch(`/api/submissions/${submission.id}/discussion`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: discussionMsg, visibility: isAdmin ? "CHAIRS_ONLY" : "REVIEWERS_ONLY" }),
      });
      setDiscussionMsg("");
      router.refresh();
    } catch {}
    setPosting(false);
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <Breadcrumb items={[{ label: "บทความ", href: "/submissions" }, { label: submission.title }]} />

      {message && <Alert tone="info">{message}</Alert>}

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-ink tracking-tight">{submission.title}</h1>
          <div className="flex items-center gap-2.5 mt-2">
            <Badge tone={SUBMISSION_STATUS_COLORS[submission.status] || "neutral"}>
              {SUBMISSION_STATUS_LABELS[submission.status] || submission.status}
            </Badge>
            {submission.track && (
              <span className="text-xs text-ink-muted bg-surface-alt px-2.5 py-1 rounded-md">{submission.track.name}</span>
            )}
          </div>
        </div>
        <div className="flex gap-2 shrink-0">
          {canSubmit && <Button onClick={handleSubmit} loading={loading} size="sm"><Send className="h-3.5 w-3.5" />ส่งบทความ</Button>}
          {canResubmit && <Button onClick={handleResubmit} loading={loading} size="sm"><RotateCcw className="h-3.5 w-3.5" />ส่งฉบับแก้ไข</Button>}
          {canWithdraw && <Button onClick={handleWithdraw} variant="danger" loading={loading} size="sm">ถอนบทความ</Button>}
        </div>
      </div>

      {/* Pipeline (author view) */}
      {isAuthor && (
        <Card>
          <CardBody className="py-5 px-6">
            <SubmissionPipeline status={submission.status} />
          </CardBody>
        </Card>
      )}

      {/* Deadline Banner (author view) */}
      {isAuthor && relevantDeadline && daysLeft !== null && (
        <Alert tone={daysLeft <= 3 ? "danger" : daysLeft <= 14 ? "warning" : "info"}>
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 shrink-0" />
            <span>
              {deadlineKey === "submissionDeadline" ? "กำหนดส่งบทความ" : "กำหนดส่งฉบับสมบูรณ์"}
              : {formatDate(relevantDeadline)}
              {daysLeft > 0 ? ` (เหลือ ${daysLeft} วัน)` : daysLeft === 0 ? " (วันนี้!)" : ` (เลยกำหนด ${Math.abs(daysLeft)} วัน)`}
            </span>
          </div>
        </Alert>
      )}

      {/* Next Action (author view) */}
      {isAuthor && nextAction && (
        <Card accent={nextAction.urgency === "urgent" ? "danger" : nextAction.urgency === "warning" ? "warning" : "brand"}>
          <CardBody className="flex items-center gap-3">
            <Zap className="h-5 w-5 text-brand-500 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-ink">{nextAction.label}</p>
              <p className="text-xs text-ink-muted">{nextAction.description}</p>
            </div>
          </CardBody>
        </Card>
      )}

      {/* Decision Display (author view) */}
      {decision && (
        <Card accent={decision.outcome === "ACCEPT" || decision.outcome === "CONDITIONAL_ACCEPT" ? "success" : "danger"}>
          <CardHeader>
            <h3 className="text-sm font-semibold text-ink flex items-center gap-2">
              {decision.outcome === "ACCEPT" || decision.outcome === "CONDITIONAL_ACCEPT"
                ? <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                : <XCircle className="h-4 w-4 text-red-500" />
              }
              ผลการตัดสิน
            </h3>
          </CardHeader>
          <CardBody className="space-y-2">
            <Badge
              tone={decision.outcome === "ACCEPT" || decision.outcome === "CONDITIONAL_ACCEPT" ? "success" : "danger"}
            >
              {DECISION_LABELS[decision.outcome] || decision.outcome}
            </Badge>
            {decision.conditions && (
              <div>
                <p className="text-xs font-medium text-ink-muted mb-1">เงื่อนไข:</p>
                <p className="text-sm text-ink whitespace-pre-wrap bg-surface-alt rounded-lg p-3">{decision.conditions}</p>
              </div>
            )}
            {decision.comments && (
              <div>
                <p className="text-xs font-medium text-ink-muted mb-1">ความคิดเห็น:</p>
                <p className="text-sm text-ink whitespace-pre-wrap bg-surface-alt rounded-lg p-3">{decision.comments}</p>
              </div>
            )}
            <p className="text-[11px] text-ink-muted">ตัดสินเมื่อ {formatDateTime(decision.decidedAt)}</p>
          </CardBody>
        </Card>
      )}

      {/* Paper Info */}
      <Collapsible title="ข้อมูลบทความ" defaultOpen={submission.status === "DRAFT"}>
        <div className="space-y-4">
          <div>
            <h3 className="text-xs font-semibold text-ink-muted uppercase tracking-wider mb-1">Author</h3>
            <p className="text-sm text-ink">
              {submission.author.name}
              {submission.author.affiliation && <span className="text-ink-muted"> ({submission.author.affiliation})</span>}
            </p>
            <p className="text-xs text-ink-muted">{submission.author.email}</p>
          </div>

          {submission.coAuthors.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-ink-muted uppercase tracking-wider mb-1">Co-Authors</h3>
              {submission.coAuthors.map((ca) => (
                <p key={ca.id} className="text-sm text-ink">
                  {ca.name}{ca.affiliation && <span className="text-ink-muted"> ({ca.affiliation})</span>}
                </p>
              ))}
            </div>
          )}

          {submission.abstract && (
            <>
              <Divider />
              <div>
                <h3 className="text-xs font-semibold text-ink-muted uppercase tracking-wider mb-1">บทคัดย่อ</h3>
                <p className="text-sm text-ink whitespace-pre-wrap leading-relaxed">{submission.abstract}</p>
              </div>
            </>
          )}

          {submission.keywords && (
            <div>
              <h3 className="text-xs font-semibold text-ink-muted uppercase tracking-wider mb-1.5">คำสำคัญ</h3>
              <div className="flex flex-wrap gap-1.5">
                {submission.keywords.split(",").map((kw, i) => (
                  <span key={i} className="text-xs bg-surface-alt text-ink-light px-2.5 py-1 rounded-md">{kw.trim()}</span>
                ))}
              </div>
            </div>
          )}

          {submission.advisorName && (
            <div>
              <h3 className="text-xs font-semibold text-ink-muted uppercase tracking-wider mb-1">Advisor</h3>
              <p className="text-sm text-ink">{submission.advisorName} ({submission.advisorEmail})</p>
              <Badge
                tone={submission.advisorApprovalStatus === "APPROVED" ? "success" : submission.advisorApprovalStatus === "PENDING" ? "warning" : "neutral"}
                className="mt-1.5"
              >
                {submission.advisorApprovalStatus === "APPROVED" ? "รับรองแล้ว" : submission.advisorApprovalStatus === "PENDING" ? "รออนุมัติ" : submission.advisorApprovalStatus || "—"}
              </Badge>
            </div>
          )}

          <div className="text-xs text-ink-muted pt-1">
            สร้างเมื่อ {formatDateTime(submission.createdAt)}
            {submission.submittedAt && ` — ส่งเมื่อ ${formatDateTime(submission.submittedAt)}`}
          </div>
        </div>
      </Collapsible>

      {/* Files Section */}
      <Card>
        <CardHeader>
          <h3 className="text-sm font-semibold text-ink flex items-center gap-2">
            <Paperclip className="h-4 w-4" />
            ไฟล์แนบ
          </h3>
        </CardHeader>
        <CardBody className="space-y-4">
          <FileList submissionId={submission.id} files={files} />

          {isOwner && submission.status === "DRAFT" && (
            <FileUpload
              submissionId={submission.id}
              kind="MANUSCRIPT"
              label="อัปโหลดต้นฉบับบทความ"
              hint="อัปโหลดไฟล์บทความที่ต้องการส่ง"
              accept=".pdf,.doc,.docx"
              onUploadComplete={() => router.refresh()}
            />
          )}

          {isOwner && submission.status === "CAMERA_READY_PENDING" && (
            <FileUpload
              submissionId={submission.id}
              kind="CAMERA_READY"
              label="อัปโหลด Camera-Ready"
              hint="อัปโหลดฉบับสมบูรณ์พร้อมตีพิมพ์"
              accept=".pdf"
              onUploadComplete={() => router.refresh()}
            />
          )}

          {isOwner && ["DRAFT", "REVISION_REQUIRED"].includes(submission.status) && (
            <FileUpload
              submissionId={submission.id}
              kind="SUPPLEMENTARY"
              label="อัปโหลดเอกสารเสริม (ไม่บังคับ)"
              hint="เช่น ข้อมูลเพิ่มเติม ซอร์สโค้ด ฯลฯ"
              accept=".pdf,.zip,.rar,.doc,.docx"
              onUploadComplete={() => router.refresh()}
            />
          )}
        </CardBody>
      </Card>

      {/* Review Progress + Reviews */}
      {(submission.reviews.length > 0 || (reviewCounts && reviewCounts.total > 0)) && (
        <Card>
          <CardHeader>
            <h3 className="text-sm font-semibold text-ink flex items-center gap-2">
              <FileText className="h-4 w-4" />
              ผลรีวิว
            </h3>
          </CardHeader>
          <CardBody className="space-y-4">
            {reviewCounts && reviewCounts.total > 0 && (
              <ReviewProgress completed={reviewCounts.completed} total={reviewCounts.total} />
            )}

            {submission.reviews.length > 0 && (
              <div className="space-y-3">
                {submission.reviews.map((review, i) => (
                  <Collapsible
                    key={review.id}
                    title={`Reviewer ${i + 1}${isAdmin ? ` (${review.reviewer.name})` : ""} ${review.completedAt ? `— ${RECOMMENDATION_LABELS[review.recommendation ?? ""] || "รีวิวแล้ว"}` : "— ยังไม่รีวิว"}`}
                    defaultOpen={i === 0}
                  >
                    {review.completedAt ? (
                      <div className="space-y-3">
                        {review.recommendation && (
                          <div className="text-sm">
                            <span className="text-ink-muted">คำแนะนำ: </span>
                            <Badge tone={review.recommendation === "ACCEPT" ? "success" : review.recommendation === "REJECT" ? "danger" : "warning"}>
                              {RECOMMENDATION_LABELS[review.recommendation] || review.recommendation}
                            </Badge>
                          </div>
                        )}
                        {review.commentsToAuthor && (
                          <div>
                            <p className="text-xs text-ink-muted mb-1">ความคิดเห็นถึง Author:</p>
                            <p className="text-sm text-ink whitespace-pre-wrap bg-surface-alt rounded-lg p-3 leading-relaxed">{review.commentsToAuthor}</p>
                          </div>
                        )}
                        {isAdmin && review.commentsToChair && (
                          <div>
                            <p className="text-xs text-ink-muted mb-1">ความคิดเห็นถึงประธาน (เฉพาะ admin):</p>
                            <p className="text-sm text-ink whitespace-pre-wrap bg-amber-50/60 border border-amber-200/40 rounded-lg p-3 leading-relaxed">{review.commentsToChair}</p>
                          </div>
                        )}
                      </div>
                    ) : (
                      <p className="text-sm text-ink-muted flex items-center gap-2">
                        <Clock className="h-3.5 w-3.5" />ยังไม่ส่งผลรีวิว
                      </p>
                    )}
                  </Collapsible>
                ))}
              </div>
            )}
          </CardBody>
        </Card>
      )}

      {/* Presentation Info (author view) */}
      {presentations && presentations.length > 0 && criteria && (
        <PresentationCard presentations={presentations} criteria={criteria} />
      )}

      {/* Admin: Assign Reviewer */}
      {isAdmin && ["SUBMITTED", "UNDER_REVIEW"].includes(submission.status) && (
        <Card accent="info">
          <CardHeader>
            <h3 className="text-sm font-semibold text-ink flex items-center gap-2">
              <UserPlus className="h-4 w-4" />
              มอบหมาย Reviewer
            </h3>
          </CardHeader>
          <CardBody>
            <div className="flex gap-3">
              <div className="flex-1">
                <Select value={selectedReviewer} onChange={(e) => setSelectedReviewer(e.target.value)}>
                  <option value="">— เลือก Reviewer —</option>
                  {reviewers
                    .filter((r) => !submission.reviews.some((rev) => rev.reviewer.id === r.id))
                    .map((r) => (
                      <option key={r.id} value={r.id}>{r.name} ({r.email})</option>
                    ))}
                </Select>
              </div>
              <Button onClick={handleAssignReviewer} loading={assigning} disabled={!selectedReviewer} size="sm">
                มอบหมาย
              </Button>
            </div>
          </CardBody>
        </Card>
      )}

      {/* Admin: Decision Panel */}
      {isAdmin && ["UNDER_REVIEW", "REBUTTAL"].includes(submission.status) && submission.reviews.some((r) => r.completedAt) && (
        <Card accent="brand">
          <CardHeader>
            <h3 className="text-sm font-semibold text-ink flex items-center gap-2">
              <Gavel className="h-4 w-4" />
              ตัดสินบทความ
            </h3>
          </CardHeader>
          <CardBody className="space-y-3">
            <Field label="ผลการตัดสิน" htmlFor="decision" required>
              <Select id="decision" value={decisionOutcome} onChange={(e) => setDecisionOutcome(e.target.value)}>
                <option value="">— เลือกผลการตัดสิน —</option>
                {Object.entries(DECISION_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </Select>
            </Field>
            <Field label="ความคิดเห็น" htmlFor="decisionComments">
              <Textarea
                id="decisionComments"
                value={decisionComments}
                onChange={(e) => setDecisionComments(e.target.value)}
                placeholder="เหตุผลประกอบการตัดสิน..."
                rows={3}
              />
            </Field>
          </CardBody>
          <CardFooter className="flex justify-end">
            <Button onClick={handleDecision} loading={deciding} disabled={!decisionOutcome}>
              ยืนยันการตัดสิน
            </Button>
          </CardFooter>
        </Card>
      )}

      {/* Discussion */}
      {(isAdmin || currentUserRole === "REVIEWER") && (
        <Card>
          <CardHeader>
            <h3 className="text-sm font-semibold text-ink">การสนทนา (เฉพาะ Reviewer และ Program Chair)</h3>
          </CardHeader>
          <CardBody className="space-y-3">
            {submission.discussions.length > 0 ? (
              submission.discussions.map((disc) => (
                <div key={disc.id} className="bg-surface-alt rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-medium text-ink">{disc.author.name}</span>
                    <span className="text-xs text-ink-muted">{formatDateTime(disc.createdAt)}</span>
                  </div>
                  <p className="text-sm text-ink leading-relaxed">{disc.message}</p>
                </div>
              ))
            ) : (
              <p className="text-sm text-ink-muted">ยังไม่มีข้อความ</p>
            )}

            <Divider />
            <div className="flex gap-3">
              <div className="flex-1">
                <Textarea
                  value={discussionMsg}
                  onChange={(e) => setDiscussionMsg(e.target.value)}
                  placeholder="พิมพ์ข้อความ..."
                  rows={2}
                />
              </div>
              <Button onClick={handlePostDiscussion} loading={posting} disabled={!discussionMsg.trim()} size="sm" className="self-end">
                ส่ง
              </Button>
            </div>
          </CardBody>
        </Card>
      )}
    </div>
  );
}
