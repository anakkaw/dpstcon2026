"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader, CardFooter } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Field } from "@/components/ui/field";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { Divider } from "@/components/ui/divider";
import { Collapsible } from "@/components/ui/collapsible";
import { Alert } from "@/components/ui/alert";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import {
  SUBMISSION_STATUS_LABELS,
  SUBMISSION_STATUS_COLORS,
  RECOMMENDATION_LABELS,
  DECISION_LABELS,
} from "@/lib/labels";
import { ADVISOR_TOKEN_EXPIRY_DAYS } from "@/lib/constants";
import { formatDateTime, formatDate } from "@/lib/utils";
import { submitPaper, withdrawPaper, resubmitPaper } from "@/server/actions/submission";
import { FileUpload } from "@/components/ui/file-upload";
import { FileList } from "@/components/ui/file-list";
import { PdfPreviewModal } from "@/components/ui/pdf-preview-modal";
import { SubmissionPipeline } from "@/components/author/submission-pipeline";
import { ReviewProgress } from "@/components/author/review-progress";
import { PresentationCard } from "@/components/author/presentation-card";
import { getNextAction, getRelevantDeadlineKey, getDaysUntil } from "@/lib/author-utils";
import { displayNameTh } from "@/lib/display-name";
import { useI18n } from "@/lib/i18n";
import type { PresentationRubricCriterion } from "@/server/presentation-rubrics";
import { AssignReviewerCard } from "@/components/review/assign-reviewer-card";
import {
  Gavel, Send, RotateCcw, Paperclip,
  FileText, Clock, CheckCircle2, XCircle, Zap, Calendar,
  Trash2, Pencil, Mail, UserCheck, MessageSquare,
} from "lucide-react";

interface Props {
  submission: {
    id: string;
    paperCode?: string | null;
    title: string;
    abstract: string | null;
    keywords: string | null;
    status: string;
    fileUrl?: string | null;
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
  currentUserRoles: string[];
  currentUserId: string;
  reviewers: { id: string; name: string; email: string; activeLoad?: number; completedLoad?: number }[];
  files: {
    id: string;
    originalName: string;
    mimeType: string;
    size: number;
    kind: string;
    uploadedAt: string;
    uploadedById?: string | null;
    uploaderName?: string | null;
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
    paperCode?: string | null;
    scheduledAt: string | null;
    room: string | null;
    duration: number | null;
  }[];
  criteriaByType?: Record<"ORAL" | "POSTER", PresentationRubricCriterion[]>;
  deadlines?: Record<string, string>;
  isAssignedReviewer?: boolean;
  reviewerAssignmentId?: string | null;
  lastAdvisorEmail?: {
    status: "PENDING" | "SENT" | "FAILED";
    sentAt: string | null;
    error: string | null;
    createdAt: string;
  } | null;
}

export function SubmissionDetail({
  submission, currentUserRoles, currentUserId, reviewers, files,
  reviewCounts, decision, presentations, criteriaByType, deadlines,
  isAssignedReviewer, reviewerAssignmentId, lastAdvisorEmail,
}: Props) {
  const router = useRouter();
  const { t } = useI18n();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [confirmAction, setConfirmAction] = useState<null | "withdraw" | "resubmit" | "delete">(
    null
  );
  const isOwner = submission.author.id === currentUserId;
  const isAdmin = currentUserRoles.some((role) =>
    ["ADMIN", "PROGRAM_CHAIR"].includes(role)
  );
  const isAuthor = currentUserRoles.includes("AUTHOR");
  const isReviewer = currentUserRoles.includes("REVIEWER");
  const canManageOwnSubmission = isOwner && isAuthor;
  const canDeleteFiles = isAdmin || (canManageOwnSubmission && submission.status === "DRAFT");
  const canDeleteSubmission = currentUserRoles.includes("ADMIN");
  const canSubmit = canManageOwnSubmission && submission.status === "DRAFT";
  const canWithdraw = canManageOwnSubmission && !["WITHDRAWN", "DRAFT"].includes(submission.status);
  const canResubmit = canManageOwnSubmission && submission.status === "REVISION_REQUIRED";

  const [decisionOutcome, setDecisionOutcome] = useState("");
  const [decisionComments, setDecisionComments] = useState("");
  const [decisionConditions, setDecisionConditions] = useState("");
  const [deciding, setDeciding] = useState(false);
  const [discussionMsg, setDiscussionMsg] = useState("");
  const [posting, setPosting] = useState(false);
  const [resendingAdvisor, setResendingAdvisor] = useState(false);

  // Advisor management state (admin)
  const [showEditAdvisorModal, setShowEditAdvisorModal] = useState(false);
  const [editAdvisorName, setEditAdvisorName] = useState(submission.advisorName || "");
  const [editAdvisorEmail, setEditAdvisorEmail] = useState(submission.advisorEmail || "");
  const [sendAdvisorEmailOnChange, setSendAdvisorEmailOnChange] = useState(true);
  const [savingAdvisor, setSavingAdvisor] = useState(false);
  const [showOverrideConfirm, setShowOverrideConfirm] = useState(false);
  const [overrideTarget, setOverrideTarget] = useState<string>("");
  const [overriding, setOverriding] = useState(false);

  // Manuscript preview modal
  const [previewOpen, setPreviewOpen] = useState(false);
  const manuscriptFile = files.find((f) => f.kind === "MANUSCRIPT");

  // Review form state
  const [reviewRecommendation, setReviewRecommendation] = useState("");
  const [reviewCommentsToAuthor, setReviewCommentsToAuthor] = useState("");
  const [reviewCommentsToChair, setReviewCommentsToChair] = useState("");
  const [submittingReview, setSubmittingReview] = useState(false);

  // Draft auto-save state
  const draftStorageKey = `review-draft-${submission.id}-${currentUserId}`;
  const [draftLoaded, setDraftLoaded] = useState(false);
  const [hasRestoredDraft, setHasRestoredDraft] = useState(false);
  const [draftSavedAt, setDraftSavedAt] = useState<number | null>(null);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const alreadyCompleted = submission.reviews.some((r) => r.reviewer.id === currentUserId && r.completedAt);
  const canWriteReview = isAssignedReviewer && !alreadyCompleted;

  // Load saved draft once on mount
  useEffect(() => {
    if (!canWriteReview || draftLoaded) return;
    try {
      const raw = typeof window !== "undefined" ? window.localStorage.getItem(draftStorageKey) : null;
      if (raw) {
        const parsed = JSON.parse(raw) as {
          recommendation?: string;
          commentsToAuthor?: string;
          commentsToChair?: string;
          savedAt?: number;
        };
        const hasContent =
          (parsed.recommendation && parsed.recommendation.length > 0) ||
          (parsed.commentsToAuthor && parsed.commentsToAuthor.length > 0) ||
          (parsed.commentsToChair && parsed.commentsToChair.length > 0);
        if (hasContent) {
          setReviewRecommendation(parsed.recommendation || "");
          setReviewCommentsToAuthor(parsed.commentsToAuthor || "");
          setReviewCommentsToChair(parsed.commentsToChair || "");
          setDraftSavedAt(parsed.savedAt || null);
          setHasRestoredDraft(true);
        }
      }
    } catch {
      /* ignore corrupted draft */
    }
    setDraftLoaded(true);
  }, [canWriteReview, draftLoaded, draftStorageKey]);

  // Debounced save on changes
  useEffect(() => {
    if (!canWriteReview || !draftLoaded) return;
    const hasAny =
      reviewRecommendation.length > 0 ||
      reviewCommentsToAuthor.length > 0 ||
      reviewCommentsToChair.length > 0;
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    if (!hasAny) {
      try { window.localStorage.removeItem(draftStorageKey); } catch {}
      setDraftSavedAt(null);
      return;
    }
    saveTimeoutRef.current = setTimeout(() => {
      try {
        const now = Date.now();
        window.localStorage.setItem(
          draftStorageKey,
          JSON.stringify({
            recommendation: reviewRecommendation,
            commentsToAuthor: reviewCommentsToAuthor,
            commentsToChair: reviewCommentsToChair,
            savedAt: now,
          })
        );
        setDraftSavedAt(now);
      } catch {
        /* quota exceeded or disabled */
      }
    }, 500);
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, [reviewRecommendation, reviewCommentsToAuthor, reviewCommentsToChair, canWriteReview, draftLoaded, draftStorageKey]);

  function discardDraft() {
    setReviewRecommendation("");
    setReviewCommentsToAuthor("");
    setReviewCommentsToChair("");
    setHasRestoredDraft(false);
    setDraftSavedAt(null);
    try { window.localStorage.removeItem(draftStorageKey); } catch {}
  }

  // Computed values for author view
  const hasManuscript = files.some((f) => f.kind === "MANUSCRIPT");
  const nextAction = isAuthor ? getNextAction(submission.status, hasManuscript) : null;
  const deadlineKey = isAuthor ? getRelevantDeadlineKey(submission.status) : null;
  const relevantDeadline = deadlineKey && deadlines ? deadlines[deadlineKey] : null;
  const daysLeft = relevantDeadline ? getDaysUntil(relevantDeadline) : null;

  async function handleSubmit() {
    const hasManuscript = files.some((f) => f.kind === "MANUSCRIPT");
    if (!hasManuscript) {
      setMessage(t("detail.uploadBeforeSubmit"));
      return;
    }
    setLoading(true);
    try {
      await submitPaper(submission.id);
      router.refresh();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : t("detail.genericError"));
      router.refresh();
    }
    setLoading(false);
  }

  async function handleWithdraw() {
    setLoading(true);
    await withdrawPaper(submission.id);
    router.refresh();
    setLoading(false);
  }

  async function handleResubmit() {
    setLoading(true);
    await resubmitPaper(submission.id);
    router.refresh();
    setLoading(false);
  }

  async function handleDeleteSubmission() {
    setLoading(true);
    try {
      const res = await fetch(`/api/submissions/${submission.id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setMessage(data?.error || t("detail.deleteError"));
        return;
      }

      router.push("/submissions");
      router.refresh();
    } catch {
      setMessage(t("detail.deleteError"));
    } finally {
      setLoading(false);
    }
  }


  async function handleDecision() {
    if (!decisionOutcome) return;
    setDeciding(true);
    try {
      const res = await fetch("/api/reviews/decisions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ submissionId: submission.id, outcome: decisionOutcome, comments: decisionComments, conditions: decisionOutcome === "CONDITIONAL_ACCEPT" ? decisionConditions : undefined }),
      });
      if (res.ok) {
        setMessage(t("detail.decisionSuccess"));
        router.refresh();
      } else {
        const data = await res.json();
        setMessage(data.error || t("detail.genericError"));
      }
    } catch { setMessage(t("detail.genericError")); }
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

  async function handleSubmitReview() {
    if (!reviewRecommendation || !reviewCommentsToAuthor.trim()) return;
    setSubmittingReview(true);
    try {
      const res = await fetch("/api/reviews/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          submissionId: submission.id,
          assignmentId: reviewerAssignmentId || undefined,
          commentsToAuthor: reviewCommentsToAuthor,
          commentsToChair: reviewCommentsToChair || undefined,
          recommendation: reviewRecommendation,
        }),
      });
      if (res.ok) {
        setMessage(t("reviewForm.submitted"));
        setReviewRecommendation("");
        setReviewCommentsToAuthor("");
        setReviewCommentsToChair("");
        try { window.localStorage.removeItem(draftStorageKey); } catch {}
        setDraftSavedAt(null);
        setHasRestoredDraft(false);
        router.refresh();
      } else {
        const data = await res.json();
        setMessage(data.error || t("reviewForm.error"));
      }
    } catch {
      setMessage(t("reviewForm.error"));
    }
    setSubmittingReview(false);
  }

  async function handleResendAdvisorApproval() {
    setResendingAdvisor(true);
    try {
      const res = await fetch(`/api/submissions/${submission.id}/resend-advisor-approval`, {
        method: "POST",
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setMessage(data?.error || t("detail.advisorResendError"));
        return;
      }
      setMessage(t("detail.advisorResendSuccess"));
      router.refresh();
    } catch {
      setMessage(t("detail.advisorResendError"));
    } finally {
      setResendingAdvisor(false);
    }
  }

  async function handleSaveAdvisor() {
    if (!editAdvisorEmail.trim() || !editAdvisorName.trim()) return;
    setSavingAdvisor(true);
    try {
      const payload: Record<string, unknown> = {
        advisorName: editAdvisorName.trim(),
        advisorEmail: editAdvisorEmail.trim(),
      };
      if (sendAdvisorEmailOnChange && editAdvisorEmail.trim() !== (submission.advisorEmail || "")) {
        payload.sendAdvisorEmail = true;
      }
      const res = await fetch(`/api/submissions/${submission.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        setMessage(t("advisor.saveSuccess"));
        setShowEditAdvisorModal(false);
        router.refresh();
      } else {
        const data = await res.json().catch(() => null);
        setMessage(data?.error || t("advisor.saveError"));
      }
    } catch {
      setMessage(t("advisor.saveError"));
    } finally {
      setSavingAdvisor(false);
    }
  }

  async function handleOverrideAdvisorStatus() {
    if (!overrideTarget) return;
    setOverriding(true);
    try {
      const payload: Record<string, unknown> = { advisorApprovalStatus: overrideTarget };
      // When resetting to pending, also send a new email
      if (overrideTarget === "PENDING") {
        payload.sendAdvisorEmail = true;
      }
      const res = await fetch(`/api/submissions/${submission.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        setMessage(t("advisor.overrideSuccess"));
        setShowOverrideConfirm(false);
        setOverrideTarget("");
        router.refresh();
      } else {
        const data = await res.json().catch(() => null);
        setMessage(data?.error || t("advisor.overrideError"));
      }
    } catch {
      setMessage(t("advisor.overrideError"));
    } finally {
      setOverriding(false);
    }
  }

  return (
    <div className="max-w-6xl">
      <ConfirmDialog
        open={confirmAction === "withdraw"}
        title={t("detail.confirmWithdraw")}
        description={t("detail.confirmWithdrawDesc")}
        confirmLabel={t("detail.withdrawBtn")}
        cancelLabel={t("common.cancel")}
        tone="danger"
        loading={loading}
        onCancel={() => setConfirmAction(null)}
        onConfirm={async () => {
          await handleWithdraw();
          setConfirmAction(null);
        }}
      />
      <ConfirmDialog
        open={confirmAction === "resubmit"}
        title={t("detail.confirmResubmit")}
        description={t("detail.confirmResubmitDesc")}
        confirmLabel={t("detail.resubmitBtn")}
        cancelLabel={t("common.cancel")}
        loading={loading}
        onCancel={() => setConfirmAction(null)}
        onConfirm={async () => {
          await handleResubmit();
          setConfirmAction(null);
        }}
      />
      <ConfirmDialog
        open={confirmAction === "delete"}
        title={t("detail.confirmDelete")}
        description={t("detail.confirmDeleteDesc")}
        confirmLabel={t("detail.deleteBtn")}
        cancelLabel={t("common.cancel")}
        tone="danger"
        loading={loading}
        onCancel={() => setConfirmAction(null)}
        onConfirm={async () => {
          await handleDeleteSubmission();
          setConfirmAction(null);
        }}
      />

      {/* Override Advisor Status Confirm */}
      <ConfirmDialog
        open={showOverrideConfirm}
        title={t("advisor.overrideConfirmTitle")}
        description={
          overrideTarget === "APPROVED"
            ? t("advisor.overrideApproveDesc")
            : overrideTarget === "REJECTED"
              ? t("advisor.overrideRejectDesc")
              : t("advisor.overrideResetDesc")
        }
        confirmLabel={
          overrideTarget === "APPROVED"
            ? t("advisor.markApproved")
            : overrideTarget === "REJECTED"
              ? t("advisor.markRejected")
              : t("advisor.resetPending")
        }
        cancelLabel={t("common.cancel")}
        tone={overrideTarget === "REJECTED" ? "danger" : "primary"}
        loading={overriding}
        onCancel={() => { setShowOverrideConfirm(false); setOverrideTarget(""); }}
        onConfirm={handleOverrideAdvisorStatus}
      />

      <Breadcrumb items={[{ label: t("detail.papers"), href: "/submissions" }, { label: submission.title }]} />

      {message && <Alert tone="info">{message}</Alert>}

      <div className="mt-4 grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_220px] lg:items-start">
        <div className="space-y-6">
          {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-ink tracking-tight">{submission.title}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2.5">
            {submission.paperCode && <Badge>{submission.paperCode}</Badge>}
            <Badge tone={SUBMISSION_STATUS_COLORS[submission.status] || "neutral"}>
              {SUBMISSION_STATUS_LABELS[submission.status] || submission.status}
            </Badge>
            {submission.track && (
              <span className="text-xs text-ink-muted bg-surface-alt px-2.5 py-1 rounded-md">{submission.track.name}</span>
            )}
          </div>
        </div>
        <div className="flex flex-col gap-2 sm:shrink-0 sm:flex-row">
          {canSubmit && <Button onClick={handleSubmit} loading={loading} size="sm"><Send className="h-3.5 w-3.5" />{t("detail.submitBtn")}</Button>}
          {canWithdraw && (
            <Button
              onClick={() => setConfirmAction("withdraw")}
              variant="danger"
              loading={loading}
              size="sm"
            >
              {t("detail.withdrawAction")}
            </Button>
          )}
          {canDeleteSubmission && (
            <Button
              onClick={() => setConfirmAction("delete")}
              variant="danger"
              loading={loading}
              size="sm"
            >
              <Trash2 className="h-3.5 w-3.5" />
              {t("detail.deleteAction")}
            </Button>
          )}
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
              {deadlineKey === "submissionDeadline" ? t("detail.submissionDeadline") : t("detail.cameraReadyDeadline")}
              : {formatDate(relevantDeadline)}
              {daysLeft !== null && (daysLeft > 0 ? t("detail.daysLeft", { n: daysLeft }) : daysLeft === 0 ? t("detail.dueToday") : t("detail.overdue", { n: Math.abs(daysLeft) }))}
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
              {t("detail.decisionLabel")}
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
                <p className="text-xs font-medium text-ink-muted mb-1">{t("detail.conditions")}</p>
                <p className="text-sm text-ink whitespace-pre-wrap bg-surface-alt rounded-lg p-3">{decision.conditions}</p>
              </div>
            )}
            {decision.comments && (
              <div>
                <p className="text-xs font-medium text-ink-muted mb-1">{t("detail.commentsLabel")}</p>
                <p className="text-sm text-ink whitespace-pre-wrap bg-surface-alt rounded-lg p-3">{decision.comments}</p>
              </div>
            )}
            <p className="text-[11px] text-ink-muted">{t("detail.decidedAt", { date: formatDateTime(decision.decidedAt) })}</p>
          </CardBody>
        </Card>
      )}

      {/* Advisor Endorsement Card */}
      {(isAdmin || isOwner) && submission.advisorName && (
        <Card id="section-advisor">
          <CardHeader>
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-ink flex items-center gap-2">
                <UserCheck className="h-4 w-4" />
                {t("advisor.sectionTitle")}
              </h3>
              <Badge
                tone={
                  submission.advisorApprovalStatus === "APPROVED" ? "success"
                    : submission.advisorApprovalStatus === "PENDING" ? "warning"
                      : submission.advisorApprovalStatus === "REJECTED" ? "danger"
                        : "neutral"
                }
              >
                {submission.advisorApprovalStatus === "APPROVED"
                  ? t("advisor.statusApproved")
                  : submission.advisorApprovalStatus === "PENDING"
                    ? t("advisor.statusPending")
                    : submission.advisorApprovalStatus === "REJECTED"
                      ? t("advisor.statusRejected")
                      : t("advisor.statusNotRequested")}
              </Badge>
            </div>
          </CardHeader>
          {showEditAdvisorModal ? (
            <CardBody className="space-y-4">
              <Field label={t("advisor.advisorName")} htmlFor="editAdvisorName" required>
                <Input
                  id="editAdvisorName"
                  value={editAdvisorName}
                  onChange={(e) => setEditAdvisorName(e.target.value)}
                />
              </Field>
              <Field label={t("advisor.advisorEmail")} htmlFor="editAdvisorEmail" required>
                <Input
                  id="editAdvisorEmail"
                  type="email"
                  value={editAdvisorEmail}
                  onChange={(e) => setEditAdvisorEmail(e.target.value)}
                />
              </Field>
              {editAdvisorEmail.trim() !== (submission.advisorEmail || "") && (
                <label className="flex items-center gap-2 text-sm text-ink-light cursor-pointer">
                  <input
                    type="checkbox"
                    checked={sendAdvisorEmailOnChange}
                    onChange={(e) => setSendAdvisorEmailOnChange(e.target.checked)}
                    className="rounded border-border"
                  />
                  {t("advisor.sendEmailToNewAdvisor")}
                </label>
              )}
              <div className="flex justify-end gap-2 pt-2 border-t border-border">
                <Button variant="secondary" size="sm" onClick={() => setShowEditAdvisorModal(false)}>
                  {t("common.cancel")}
                </Button>
                <Button
                  size="sm"
                  onClick={handleSaveAdvisor}
                  loading={savingAdvisor}
                  disabled={!editAdvisorName.trim() || !editAdvisorEmail.trim()}
                >
                  {t("common.save")}
                </Button>
              </div>
            </CardBody>
          ) : (
            <>
              <CardBody className="space-y-3">
                {lastAdvisorEmail?.status === "FAILED" && submission.advisorApprovalStatus === "PENDING" && (
                  <Alert tone="danger">
                    <div className="space-y-1">
                      <p className="font-medium">ส่งอีเมลถึงอาจารย์ที่ปรึกษาไม่สำเร็จ</p>
                      <p className="text-sm">
                        {lastAdvisorEmail.error
                          ? `เหตุผล: ${lastAdvisorEmail.error}`
                          : "ระบบไม่สามารถส่งอีเมลออกไปได้"}
                      </p>
                      <p className="text-sm">
                        กรุณาตรวจสอบความถูกต้องของอีเมลอาจารย์ จากนั้นแก้ไข (ถ้าจำเป็น) แล้วกด &quot;{t("advisor.resendEmail")}&quot; เพื่อลองส่งอีกครั้ง
                      </p>
                    </div>
                  </Alert>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs font-medium text-ink-muted mb-0.5">{t("advisor.advisorName")}</p>
                    <p className="text-sm text-ink">{submission.advisorName}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-ink-muted mb-0.5">{t("advisor.advisorEmail")}</p>
                    <p className="text-sm text-ink">{submission.advisorEmail || "—"}</p>
                  </div>
                </div>

                {/* Link expiry info */}
                {submission.advisorApprovalStatus === "PENDING" && submission.submittedAt && (() => {
                  const expiresAt = new Date(new Date(submission.submittedAt!).getTime() + ADVISOR_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000);
                  const now = new Date();
                  const isExpired = now > expiresAt;
                  const daysRemaining = Math.ceil((expiresAt.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
                  return (
                    <div className="flex items-center gap-2 text-sm">
                      <Clock className="h-3.5 w-3.5 shrink-0 text-ink-muted" />
                      {isExpired ? (
                        <Badge tone="danger">{t("advisor.linkExpiredBadge")}</Badge>
                      ) : (
                        <Badge tone={daysRemaining <= 3 ? "warning" : "info"}>
                          {t("advisor.linkExpiresBadge", { n: daysRemaining, date: formatDate(expiresAt.toISOString()) })}
                        </Badge>
                      )}
                    </div>
                  );
                })()}
              </CardBody>
              <CardFooter>
                <div className="flex flex-wrap gap-2">
                  {/* Resend email — visible to admin and author when pending */}
                  {(isAdmin || canManageOwnSubmission) && submission.status === "ADVISOR_APPROVAL_PENDING" && submission.advisorApprovalStatus === "PENDING" && (
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      loading={resendingAdvisor}
                      onClick={handleResendAdvisorApproval}
                    >
                      <Mail className="h-3.5 w-3.5" />
                      {t("advisor.resendEmail")}
                    </Button>
                  )}

                  {/* Admin-only actions */}
                  {isAdmin && (
                    <>
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => {
                          setEditAdvisorName(submission.advisorName || "");
                          setEditAdvisorEmail(submission.advisorEmail || "");
                          setSendAdvisorEmailOnChange(true);
                          setShowEditAdvisorModal(true);
                        }}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        {t("advisor.editAdvisor")}
                      </Button>

                      {/* Override status dropdown */}
                      {submission.advisorApprovalStatus !== "NOT_REQUESTED" && (
                        <div className="relative">
                          <Select
                            value=""
                            onChange={(e) => {
                              if (e.target.value) {
                                setOverrideTarget(e.target.value);
                                setShowOverrideConfirm(true);
                              }
                            }}
                            className="text-xs h-8"
                          >
                            <option value="">{t("advisor.overrideStatus")}</option>
                            {submission.advisorApprovalStatus !== "APPROVED" && (
                              <option value="APPROVED">{t("advisor.markApproved")}</option>
                            )}
                            {submission.advisorApprovalStatus !== "REJECTED" && (
                              <option value="REJECTED">{t("advisor.markRejected")}</option>
                            )}
                            {submission.advisorApprovalStatus !== "PENDING" && (
                              <option value="PENDING">{t("advisor.resetPending")}</option>
                            )}
                          </Select>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </CardFooter>
            </>
          )}
        </Card>
      )}

      {/* Review confirmation — shown after reviewer already submitted */}
      {isAssignedReviewer && submission.reviews.some((r) => r.reviewer.id === currentUserId && r.completedAt) && (() => {
        const myReview = submission.reviews.find((r) => r.reviewer.id === currentUserId && r.completedAt);
        return (
          <Alert tone="success">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <div>
                <p className="font-medium">{t("reviewForm.alreadySubmitted")}</p>
                <p className="text-sm mt-0.5">{t("reviewForm.alreadySubmittedDesc")}</p>
                {myReview?.recommendation && (
                  <p className="text-sm mt-1">{t("reviewForm.yourRecommendation")} <Badge tone={myReview.recommendation === "ACCEPT" ? "success" : myReview.recommendation === "REJECT" ? "danger" : "warning"}>{RECOMMENDATION_LABELS[myReview.recommendation] || myReview.recommendation}</Badge></p>
                )}
              </div>
            </div>
          </Alert>
        );
      })()}

      {/* Review Submission Form — for assigned reviewers (shown prominently before paper info) */}
      {isAssignedReviewer && !submission.reviews.some((r) => r.reviewer.id === currentUserId && r.completedAt) && (
        <Card id="section-review-form" accent="brand">
          <CardHeader>
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm font-semibold text-ink flex items-center gap-2">
                  <Send className="h-4 w-4" />
                  {t("reviewForm.title")}
                </h3>
                {isAdmin && (
                  <Badge tone="info">{t("detail.modeReviewer")}</Badge>
                )}
              </div>
              {manuscriptFile && (
                <button
                  type="button"
                  onClick={() => setPreviewOpen(true)}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-white px-2.5 py-1 text-xs font-medium text-brand-600 border border-brand-200 hover:bg-brand-50 hover:border-brand-300 transition-colors"
                >
                  <Paperclip className="h-3.5 w-3.5" />
                  {t("reviewForm.previewManuscript")}
                </button>
              )}
            </div>
          </CardHeader>
          <CardBody className="space-y-3">
            {hasRestoredDraft && (
              <Alert tone="info">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm">
                    <p className="font-medium">{t("reviewForm.draftRestoredTitle")}</p>
                    <p className="text-xs text-ink-muted">
                      {draftSavedAt
                        ? t("reviewForm.draftRestoredAt", { time: new Date(draftSavedAt).toLocaleString() })
                        : t("reviewForm.draftRestoredGeneric")}
                    </p>
                  </div>
                  <Button size="sm" variant="ghost" onClick={discardDraft}>
                    <Trash2 className="h-3.5 w-3.5" />
                    {t("reviewForm.discardDraft")}
                  </Button>
                </div>
              </Alert>
            )}
            <Field label={t("reviewForm.recommendation")} htmlFor="reviewRecommendation" required>
              <Select id="reviewRecommendation" value={reviewRecommendation} onChange={(e) => setReviewRecommendation(e.target.value)}>
                <option value="">{t("reviewForm.recommendationPlaceholder")}</option>
                {Object.entries(RECOMMENDATION_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </Select>
            </Field>
            <Field label={t("reviewForm.commentsToAuthor")} htmlFor="reviewCommentsToAuthor" required hint={t("reviewForm.commentsToAuthorHint")}>
              <Textarea
                id="reviewCommentsToAuthor"
                value={reviewCommentsToAuthor}
                onChange={(e) => setReviewCommentsToAuthor(e.target.value)}
                placeholder={t("reviewForm.commentsToAuthorPlaceholder")}
                rows={5}
              />
            </Field>
            <Field label={t("reviewForm.commentsToChair")} htmlFor="reviewCommentsToChair">
              <Textarea
                id="reviewCommentsToChair"
                value={reviewCommentsToChair}
                onChange={(e) => setReviewCommentsToChair(e.target.value)}
                placeholder={t("reviewForm.commentsToChairPlaceholder")}
                rows={3}
              />
            </Field>

            {/* Reviewer attachment upload */}
            <div className="space-y-2">
              {(() => {
                const myAttachments = files.filter(
                  (f) => f.kind === "REVIEW_ATTACHMENT" && f.uploadedById === currentUserId
                );
                return (
                  <>
                    {myAttachments.length > 0 && (
                      <FileList
                        submissionId={submission.id}
                        files={myAttachments}
                        canDelete={false}
                        currentUserId={currentUserId}
                        onDeleteComplete={() => router.refresh()}
                      />
                    )}
                    <FileUpload
                      submissionId={submission.id}
                      kind="REVIEW_ATTACHMENT"
                      label={t("fileUpload.reviewAttachLabel")}
                      hint={t("fileUpload.reviewAttachHint")}
                      accept=".pdf,.doc,.docx,.zip"
                      onUploadComplete={() => router.refresh()}
                    />
                  </>
                );
              })()}
            </div>
          </CardBody>
          <CardFooter className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-ink-muted">
              {draftSavedAt ? (
                <span className="inline-flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                  {t("reviewForm.draftSavedAt", { time: new Date(draftSavedAt).toLocaleTimeString() })}
                </span>
              ) : (
                <span className="text-ink-muted/70">{t("reviewForm.draftAutoSaveHint")}</span>
              )}
            </p>
            <Button
              onClick={handleSubmitReview}
              loading={submittingReview}
              disabled={!reviewRecommendation || !reviewCommentsToAuthor.trim()}
            >
              <Send className="h-3.5 w-3.5" />
              {t("reviewForm.submit")}
            </Button>
          </CardFooter>
        </Card>
      )}

      {/* Paper Info */}
      <div id="section-paper-info">
      <Collapsible title={t("detail.paperInfo")} defaultOpen={submission.status === "DRAFT"}>
        <div className="space-y-4">
          <div>
            <h3 className="text-xs font-semibold text-ink-muted uppercase tracking-wider mb-1">Author</h3>
            <p className="text-sm text-ink">
              {displayNameTh(submission.author)}
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
                <h3 className="text-xs font-semibold text-ink-muted uppercase tracking-wider mb-1">{t("detail.abstract")}</h3>
                <p className="text-sm text-ink whitespace-pre-wrap leading-relaxed">{submission.abstract}</p>
              </div>
            </>
          )}

          {submission.keywords && (
            <div>
              <h3 className="text-xs font-semibold text-ink-muted uppercase tracking-wider mb-1.5">{t("detail.keywords")}</h3>
              <div className="flex flex-wrap gap-1.5">
                {submission.keywords.split(",").map((kw, i) => (
                  <span key={i} className="text-xs bg-surface-alt text-ink-light px-2.5 py-1 rounded-md">{kw.trim()}</span>
                ))}
              </div>
            </div>
          )}

          <div className="text-xs text-ink-muted pt-1">
            {t("detail.createdAt")} {formatDateTime(submission.createdAt)}
            {submission.submittedAt && ` — ${t("detail.submittedAt")} ${formatDateTime(submission.submittedAt)}`}
          </div>
        </div>
      </Collapsible>
      </div>

      {/* Files Section */}
      <Card id="section-files">
        <CardHeader>
          <h3 className="text-sm font-semibold text-ink flex items-center gap-2">
            <Paperclip className="h-4 w-4" />
            {t("detail.files")}
          </h3>
        </CardHeader>
        <CardBody className="space-y-4">
          <FileList
            submissionId={submission.id}
            files={files}
            canDelete={canDeleteFiles}
            currentUserId={currentUserId}
            onDeleteComplete={() => router.refresh()}
          />

          {canManageOwnSubmission && submission.status === "DRAFT" && (
            <FileUpload
              submissionId={submission.id}
              kind="MANUSCRIPT"
              label={t("detail.uploadManuscript")}
              hint={t("detail.uploadManuscriptHint")}
              accept=".pdf,.doc,.docx"
              onUploadComplete={() => router.refresh()}
            />
          )}

          {canManageOwnSubmission && submission.status === "CAMERA_READY_PENDING" && (
            <FileUpload
              submissionId={submission.id}
              kind="CAMERA_READY"
              label={t("detail.uploadCameraReady")}
              hint={t("detail.uploadCameraReadyHint")}
              accept=".pdf"
              onUploadComplete={() => router.refresh()}
            />
          )}

          {canManageOwnSubmission && submission.status === "DRAFT" && (
            <FileUpload
              submissionId={submission.id}
              kind="SUPPLEMENTARY"
              label={t("detail.uploadSupplementary")}
              hint={t("detail.uploadSupplementaryHint")}
              accept=".pdf,.zip,.doc,.docx"
              onUploadComplete={() => router.refresh()}
            />
          )}
        </CardBody>
      </Card>

      {/* Review Progress + Reviews */}
      {(submission.reviews.length > 0 || (reviewCounts && reviewCounts.total > 0)) && (
        <Card id="section-reviews">
          <CardHeader>
            <h3 className="text-sm font-semibold text-ink flex items-center gap-2">
              <FileText className="h-4 w-4" />
              {t("detail.reviewResults")}
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
                    title={`Reviewer ${i + 1}${isAdmin ? ` (${displayNameTh(review.reviewer)})` : ""} ${review.completedAt ? `— ${RECOMMENDATION_LABELS[review.recommendation ?? ""] || t("detail.reviewed")}` : `— ${t("detail.notReviewed")}`}`}
                    defaultOpen={i === 0}
                  >
                    {review.completedAt ? (
                      <div className="space-y-3">
                        {review.recommendation && (
                          <div className="text-sm">
                            <span className="text-ink-muted">{t("detail.recommendation")}</span>
                            <Badge tone={review.recommendation === "ACCEPT" ? "success" : review.recommendation === "REJECT" ? "danger" : "warning"}>
                              {RECOMMENDATION_LABELS[review.recommendation] || review.recommendation}
                            </Badge>
                          </div>
                        )}
                        {review.commentsToAuthor && (
                          <div>
                            <p className="text-xs text-ink-muted mb-1">{t("detail.commentsToAuthorLabel")}</p>
                            <p className="text-sm text-ink whitespace-pre-wrap bg-surface-alt rounded-lg p-3 leading-relaxed">{review.commentsToAuthor}</p>
                          </div>
                        )}
                        {isAdmin && review.commentsToChair && (
                          <div>
                            <p className="text-xs text-ink-muted mb-1">{t("detail.commentsToChairLabel")}</p>
                            <p className="text-sm text-ink whitespace-pre-wrap bg-amber-50/60 border border-amber-200/40 rounded-lg p-3 leading-relaxed">{review.commentsToChair}</p>
                          </div>
                        )}
                        {(() => {
                          const reviewerAttachments = files.filter(
                            (f) => f.kind === "REVIEW_ATTACHMENT" && f.uploadedById === review.reviewer.id
                          );
                          if (reviewerAttachments.length === 0) return null;
                          return (
                            <div>
                              <p className="text-xs text-ink-muted mb-2">{t("detail.reviewerAttachments")}</p>
                              <FileList
                                submissionId={submission.id}
                                files={reviewerAttachments}
                                canDelete={false}
                                currentUserId={currentUserId}
                              />
                            </div>
                          );
                        })()}
                      </div>
                    ) : (
                      <p className="text-sm text-ink-muted flex items-center gap-2">
                        <Clock className="h-3.5 w-3.5" />{t("detail.notReviewed")}
                      </p>
                    )}
                  </Collapsible>
                ))}
              </div>
            )}
          </CardBody>
        </Card>
      )}

      {/* Resubmit Section — shown when revision required */}
      {canResubmit && (
        <Card accent="warning">
          <CardHeader>
            <h3 className="text-sm font-semibold text-ink flex items-center gap-2">
              <RotateCcw className="h-4 w-4" />
              {t("detail.submitRevision")}
            </h3>
          </CardHeader>
          <CardBody className="space-y-4">
            <Alert tone="warning">
              {t("detail.revisionAlert")}
            </Alert>
            <FileUpload
              submissionId={submission.id}
              kind="MANUSCRIPT"
              label={t("detail.uploadRevised")}
              hint={t("detail.uploadRevisedHint")}
              accept=".pdf,.doc,.docx"
              onUploadComplete={() => router.refresh()}
            />
            <FileUpload
              submissionId={submission.id}
              kind="SUPPLEMENTARY"
              label={t("detail.uploadSupplementary")}
              hint={t("detail.uploadSupplementaryHint")}
              accept=".pdf,.zip,.doc,.docx"
              onUploadComplete={() => router.refresh()}
            />
          </CardBody>
          <CardFooter className="flex justify-end">
            <Button
              onClick={() => setConfirmAction("resubmit")}
              loading={loading}
              disabled={!files.some((f) => f.kind === "MANUSCRIPT")}
            >
              <RotateCcw className="h-3.5 w-3.5" />
              {t("detail.resubmitBtn")}
            </Button>
          </CardFooter>
        </Card>
      )}

      {/* Presentation Info (author view) */}
      {presentations && presentations.length > 0 && criteriaByType && (
        <PresentationCard
          presentations={presentations}
          criteriaByType={criteriaByType}
        />
      )}

      {/* Chair-mode divider — only shown to dual-role users so they see a clear switch of context */}
      {isAdmin && isAssignedReviewer && (
        (["SUBMITTED", "UNDER_REVIEW"].includes(submission.status) ||
          (submission.status === "UNDER_REVIEW" && submission.reviews.some((r) => r.completedAt))) && (
          <div className="flex items-center gap-3 pt-2">
            <div className="h-px flex-1 bg-gradient-to-r from-transparent via-amber-300 to-amber-300" />
            <div className="flex items-center gap-2 rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700 border border-amber-200">
              <Gavel className="h-3 w-3" />
              {t("detail.chairActionsSection")}
            </div>
            <div className="h-px flex-1 bg-gradient-to-l from-transparent via-amber-300 to-amber-300" />
          </div>
        )
      )}

      {/* Admin: Assign Reviewer */}
      {isAdmin && ["SUBMITTED", "UNDER_REVIEW"].includes(submission.status) && (
        <AssignReviewerCard
          submissionId={submission.id}
          reviewers={reviewers}
          excludeReviewerIds={submission.reviews.map((r) => r.reviewer.id)}
          onMessage={setMessage}
          showDueDate
        />
      )}

      {/* Admin: Decision Panel */}
      {isAdmin && submission.status === "UNDER_REVIEW" && submission.reviews.some((r) => r.completedAt) && (
        <Card id="section-decision" accent="brand">
          <CardHeader>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm font-semibold text-ink flex items-center gap-2">
                <Gavel className="h-4 w-4" />
                {t("detail.makeDecision")}
              </h3>
              {isAssignedReviewer && (
                <Badge tone="warning">{t("detail.modeChair")}</Badge>
              )}
            </div>
          </CardHeader>
          <CardBody className="space-y-3">
            <Field label={t("detail.decisionOutcome")} htmlFor="decision" required>
              <Select id="decision" value={decisionOutcome} onChange={(e) => setDecisionOutcome(e.target.value)}>
                <option value="">{t("detail.selectOutcome")}</option>
                {Object.entries(DECISION_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </Select>
            </Field>
            <Field label={t("detail.decisionComments")} htmlFor="decisionComments">
              <Textarea
                id="decisionComments"
                value={decisionComments}
                onChange={(e) => setDecisionComments(e.target.value)}
                placeholder={t("detail.decisionCommentsPlaceholder")}
                rows={3}
              />
            </Field>
            {decisionOutcome === "CONDITIONAL_ACCEPT" && (
              <Field label={t("detail.decisionConditions")} htmlFor="decisionConditions" required>
                <Textarea
                  id="decisionConditions"
                  value={decisionConditions}
                  onChange={(e) => setDecisionConditions(e.target.value)}
                  placeholder={t("detail.decisionConditionsPlaceholder")}
                  rows={4}
                />
              </Field>
            )}
          </CardBody>
          <CardFooter className="flex justify-end">
            <Button onClick={handleDecision} loading={deciding} disabled={!decisionOutcome || (decisionOutcome === "CONDITIONAL_ACCEPT" && !decisionConditions.trim())}>
              {t("detail.confirmDecision")}
            </Button>
          </CardFooter>
        </Card>
      )}

      {/* Discussion */}
      {(isAdmin || isReviewer) && (
        <Card id="section-discussion">
          <CardHeader>
            <h3 className="text-sm font-semibold text-ink">{t("detail.discussion")}</h3>
          </CardHeader>
          <CardBody className="space-y-3">
            {submission.discussions.length > 0 ? (
              submission.discussions.map((disc) => (
                <div key={disc.id} className="bg-surface-alt rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-medium text-ink">{displayNameTh(disc.author)}</span>
                    <span className="text-xs text-ink-muted">{formatDateTime(disc.createdAt)}</span>
                  </div>
                  <p className="text-sm text-ink leading-relaxed">{disc.message}</p>
                </div>
              ))
            ) : (
              <p className="text-sm text-ink-muted">{t("detail.noMessages")}</p>
            )}

            <Divider />
            <div className="flex gap-3">
              <div className="flex-1">
                <Textarea
                  value={discussionMsg}
                  onChange={(e) => setDiscussionMsg(e.target.value)}
                  placeholder={t("detail.typePlaceholder")}
                  rows={2}
                />
              </div>
              <Button onClick={handlePostDiscussion} loading={posting} disabled={!discussionMsg.trim()} size="sm" className="self-end">
                {t("detail.sendBtn")}
              </Button>
            </div>
          </CardBody>
        </Card>
      )}
        </div>

        {/* Sticky right rail */}
        <aside className="sticky top-6 hidden lg:block space-y-4">
          <nav className="rounded-2xl border border-border bg-white p-4 shadow-elev-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted mb-3">{t("detail.onThisPage")}</p>
            <div className="space-y-0.5 text-sm">
              {isAssignedReviewer && !submission.reviews.some((r) => r.reviewer.id === currentUserId && r.completedAt) && (
                <a href="#section-review-form" className="flex items-center gap-2 py-1.5 px-2 rounded-lg bg-brand-50 text-brand-700 font-medium hover:bg-brand-100 transition-colors">
                  <Send className="h-3.5 w-3.5 shrink-0" />{t("reviewForm.title")}
                </a>
              )}
              <a href="#section-paper-info" className="flex items-center gap-2 py-1.5 px-2 rounded-lg text-ink-muted hover:bg-surface-hover hover:text-ink transition-colors">
                <FileText className="h-3.5 w-3.5 shrink-0" />{t("detail.paperInfo")}
              </a>
              <a href="#section-files" className="flex items-center gap-2 py-1.5 px-2 rounded-lg text-ink-muted hover:bg-surface-hover hover:text-ink transition-colors">
                <Paperclip className="h-3.5 w-3.5 shrink-0" />{t("detail.files")}
              </a>
              {(isAdmin || isOwner) && submission.advisorName && (
                <a href="#section-advisor" className="flex items-center gap-2 py-1.5 px-2 rounded-lg text-ink-muted hover:bg-surface-hover hover:text-ink transition-colors">
                  <UserCheck className="h-3.5 w-3.5 shrink-0" />{t("advisor.sectionTitle")}
                </a>
              )}
              {(submission.reviews.length > 0 || (reviewCounts && reviewCounts.total > 0)) && (
                <a href="#section-reviews" className="flex items-center gap-2 py-1.5 px-2 rounded-lg text-ink-muted hover:bg-surface-hover hover:text-ink transition-colors">
                  <FileText className="h-3.5 w-3.5 shrink-0" />{t("detail.reviewResults")}
                </a>
              )}
              {isAdmin && submission.status === "UNDER_REVIEW" && submission.reviews.some((r) => r.completedAt) && (
                <a href="#section-decision" className="flex items-center gap-2 py-1.5 px-2 rounded-lg text-ink-muted hover:bg-surface-hover hover:text-ink transition-colors">
                  <Gavel className="h-3.5 w-3.5 shrink-0" />{t("detail.makeDecision")}
                </a>
              )}
              {(isAdmin || isReviewer) && (
                <a href="#section-discussion" className="flex items-center gap-2 py-1.5 px-2 rounded-lg text-ink-muted hover:bg-surface-hover hover:text-ink transition-colors">
                  <MessageSquare className="h-3.5 w-3.5 shrink-0" />{t("detail.discussion")}
                </a>
              )}
            </div>
          </nav>

          {(canSubmit || canWithdraw || canDeleteSubmission) && (
            <div className="rounded-2xl border border-border bg-white p-4 shadow-elev-1 space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted mb-1">{t("detail.actions")}</p>
              {canSubmit && (
                <Button onClick={handleSubmit} loading={loading} size="sm" className="w-full justify-center">
                  <Send className="h-3.5 w-3.5" />{t("detail.submitBtn")}
                </Button>
              )}
              {canWithdraw && (
                <Button onClick={() => setConfirmAction("withdraw")} variant="danger" loading={loading} size="sm" className="w-full justify-center">
                  {t("detail.withdrawAction")}
                </Button>
              )}
              {canDeleteSubmission && (
                <Button onClick={() => setConfirmAction("delete")} variant="danger" loading={loading} size="sm" className="w-full justify-center">
                  <Trash2 className="h-3.5 w-3.5" />{t("detail.deleteAction")}
                </Button>
              )}
            </div>
          )}
        </aside>
      </div>

      {manuscriptFile && (
        <PdfPreviewModal
          open={previewOpen}
          submissionId={submission.id}
          fileId={manuscriptFile.id}
          fileName={manuscriptFile.originalName}
          onClose={() => setPreviewOpen(false)}
        />
      )}
    </div>
  );
}
