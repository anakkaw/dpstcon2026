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
import { RecommendationPicker } from "@/components/review/recommendation-picker";
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
  Trash2, Pencil, Mail, UserCheck, MessageSquare, AlertCircle, AlertTriangle,
} from "lucide-react";

function StepHeader({
  number,
  done,
  title,
  hint,
  tone,
}: {
  number: number;
  done: boolean;
  title: string;
  hint: string;
  tone: "required" | "optional";
}) {
  return (
    <div className="flex items-center justify-between gap-3 flex-wrap">
      <div className="flex items-center gap-2.5">
        <div
          className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold transition-colors ${
            done ? "bg-emerald-500 text-white" : "bg-slate-200 text-slate-600"
          }`}
        >
          {done ? <CheckCircle2 className="h-3.5 w-3.5" /> : number}
        </div>
        <h4 className="text-sm font-semibold text-ink">{title}</h4>
      </div>
      <span
        className={`text-[11px] font-medium ${
          tone === "required" ? "text-red-500" : "text-ink-muted"
        }`}
      >
        {hint}
      </span>
    </div>
  );
}

interface Props {
  submission: {
    id: string;
    paperCode?: string | null;
    title: string;
    titleEn?: string | null;
    abstract: string | null;
    abstractEn?: string | null;
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
  reviewers: { id: string; name: string; email: string; affiliation?: string | null; pendingLoad?: number; activeLoad?: number; completedLoad?: number }[];
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
  reviewerAssignmentStatus?: string | null;
  reviewerAssignmentAssignedAt?: string | null;
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
  isAssignedReviewer, reviewerAssignmentId, reviewerAssignmentStatus, reviewerAssignmentAssignedAt, lastAdvisorEmail,
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

  // Focus mode — split-pane review with PDF on the left
  const [focusMode, setFocusMode] = useState(false);
  const [focusPdfUrl, setFocusPdfUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!focusMode || !manuscriptFile) {
      setFocusPdfUrl(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch(`/api/submissions/${submission.id}/download/${manuscriptFile.id}`);
        if (!r.ok) return;
        const data = (await r.json()) as { url?: string };
        if (!cancelled && data.url) setFocusPdfUrl(data.url);
      } catch { /* ignore */ }
    })();
    return () => { cancelled = true; };
  }, [focusMode, manuscriptFile, submission.id]);
  useEffect(() => {
    if (!focusMode) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setFocusMode(false); };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = original;
    };
  }, [focusMode]);

  // Review form state
  const [reviewRecommendation, setReviewRecommendation] = useState("");
  const [reviewCommentsToAuthor, setReviewCommentsToAuthor] = useState("");
  const [reviewCommentsToChair, setReviewCommentsToChair] = useState("");
  const [submittingReview, setSubmittingReview] = useState(false);
  const [editReviewMode, setEditReviewMode] = useState(false);

  const myCompletedReview = submission.reviews.find(
    (r) => r.reviewer.id === currentUserId && r.completedAt
  );
  const EDIT_WINDOW_MS = 24 * 60 * 60 * 1000;
  const canEditReview = myCompletedReview?.completedAt
    ? Date.now() - new Date(myCompletedReview.completedAt as unknown as string | Date).getTime() < EDIT_WINDOW_MS
    : false;

  // Round 2 detection: author resubmitted → assignment re-opened to ACCEPTED with
  // assignedAt bumped past the existing review.completedAt. Reviewer should get
  // a fresh form to review the revised manuscript.
  const isRound2Active = (() => {
    if (!isAssignedReviewer || !myCompletedReview?.completedAt) return false;
    if (reviewerAssignmentStatus !== "ACCEPTED") return false;
    if (!reviewerAssignmentAssignedAt) return false;
    return (
      new Date(reviewerAssignmentAssignedAt).getTime() >
      new Date(myCompletedReview.completedAt as unknown as string | Date).getTime()
    );
  })();

  function startEditReview() {
    if (!myCompletedReview) return;
    setReviewRecommendation(myCompletedReview.recommendation || "");
    setReviewCommentsToAuthor(myCompletedReview.commentsToAuthor || "");
    setReviewCommentsToChair(myCompletedReview.commentsToChair || "");
    setEditReviewMode(true);
  }

  function cancelEditReview() {
    setReviewRecommendation("");
    setReviewCommentsToAuthor("");
    setReviewCommentsToChair("");
    setEditReviewMode(false);
  }

  // Draft auto-save state
  const draftStorageKey = `review-draft-${submission.id}-${currentUserId}`;
  const [draftLoaded, setDraftLoaded] = useState(false);
  const [hasRestoredDraft, setHasRestoredDraft] = useState(false);
  const [draftSavedAt, setDraftSavedAt] = useState<number | null>(null);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Draft autosave is active whenever the user is an assigned reviewer
  // (covers round 1, round 2 after resubmit, and the 24h edit window).
  const canWriteReview = isAssignedReviewer;

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
      } catch (err) {
        console.warn("[review-draft] failed to persist draft to localStorage", err);
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

  // Multi-tab sync: if another tab writes to the same draft key, alert this tab
  const [otherTabConflict, setOtherTabConflict] = useState(false);
  useEffect(() => {
    if (!canWriteReview) return;
    function onStorage(e: StorageEvent) {
      if (e.key !== draftStorageKey) return;
      if (!e.newValue) return;
      try {
        const parsed = JSON.parse(e.newValue) as { savedAt?: number };
        // Only flag if the incoming value is newer than the one we just wrote
        if (parsed.savedAt && (!draftSavedAt || parsed.savedAt > draftSavedAt)) {
          setOtherTabConflict(true);
        }
      } catch { /* ignore */ }
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [canWriteReview, draftStorageKey, draftSavedAt]);

  function reloadFromOtherTab() {
    try {
      const raw = window.localStorage.getItem(draftStorageKey);
      if (raw) {
        const parsed = JSON.parse(raw) as {
          recommendation?: string;
          commentsToAuthor?: string;
          commentsToChair?: string;
          savedAt?: number;
        };
        setReviewRecommendation(parsed.recommendation || "");
        setReviewCommentsToAuthor(parsed.commentsToAuthor || "");
        setReviewCommentsToChair(parsed.commentsToChair || "");
        setDraftSavedAt(parsed.savedAt || null);
      }
    } catch { /* ignore */ }
    setOtherTabConflict(false);
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


  const [decisionConfirmOpen, setDecisionConfirmOpen] = useState(false);

  function requestDecision() {
    if (!decisionOutcome) return;
    const totalAssignments = reviewCounts?.total ?? submission.reviews.length;
    const completedReviews = submission.reviews.filter((r) => r.completedAt).length;
    // Confirm if not all reviewers have submitted yet
    if (totalAssignments > 0 && completedReviews < totalAssignments) {
      setDecisionConfirmOpen(true);
      return;
    }
    void handleDecision();
  }

  async function handleDecision() {
    if (!decisionOutcome) return;
    setDecisionConfirmOpen(false);
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
      const isEdit = editReviewMode && myCompletedReview;
      const res = await fetch(
        isEdit ? `/api/reviews/reviews/${myCompletedReview.id}` : "/api/reviews/reviews",
        {
          method: isEdit ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...(isEdit
              ? {}
              : {
                  submissionId: submission.id,
                  assignmentId: reviewerAssignmentId || undefined,
                }),
            commentsToAuthor: reviewCommentsToAuthor,
            commentsToChair: reviewCommentsToChair || undefined,
            recommendation: reviewRecommendation,
          }),
        }
      );
      if (res.ok) {
        setMessage(isEdit ? t("reviewForm.editSaved") : t("reviewForm.submitted"));
        setReviewRecommendation("");
        setReviewCommentsToAuthor("");
        setReviewCommentsToChair("");
        setEditReviewMode(false);
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

      {/* Workflow hint — shown to the common dual-role case (PC who's also reviewing).
          Sequential flow: write your review → then make the chair decision.
          After a REVISE cycle, reverts to step 1 for round 2. */}
      {isAdmin && isAssignedReviewer && !isOwner && (
        <div className="flex items-center gap-3 rounded-xl border border-border bg-surface-alt px-4 py-2.5 text-sm">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-100 text-brand-700 font-bold text-xs">
            {myCompletedReview && !isRound2Active ? 2 : 1}
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-medium text-ink">
              {isRound2Active
                ? t("detail.workflowRound2Title")
                : myCompletedReview
                  ? t("detail.workflowStep2Title")
                  : t("detail.workflowStep1Title")}
            </p>
            <p className="text-xs text-ink-muted">
              {isRound2Active
                ? t("detail.workflowRound2Desc")
                : myCompletedReview
                  ? t("detail.workflowStep2Desc")
                  : t("detail.workflowStep1Desc")}
            </p>
          </div>
        </div>
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

      {/* Decision Display — hidden from reviewers while they're writing their review to avoid bias.
          Hides during round 1 (before first submit) AND during active round 2 (after resubmit). */}
      {decision && !(isAssignedReviewer && !isOwner && (!submission.reviews.some((r) => r.reviewer.id === currentUserId && r.completedAt) || isRound2Active)) && (
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

      {/* Advisor Endorsement Card — hidden while actively reviewing (focus on paper, not advisor) */}
      {(isAdmin || isOwner) && !(isAssignedReviewer && !isOwner) && submission.advisorName && (
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

      {/* Review confirmation — shown after reviewer already submitted
          (hidden while editing OR during an active round 2) */}
      {isAssignedReviewer && myCompletedReview && !editReviewMode && !isRound2Active && (
        <Alert tone="success">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
              <div>
                <p className="font-medium">{t("reviewForm.alreadySubmitted")}</p>
                <p className="text-sm mt-0.5">{t("reviewForm.alreadySubmittedDesc")}</p>
                {myCompletedReview.recommendation && (
                  <p className="text-sm mt-1">
                    {t("reviewForm.yourRecommendation")}{" "}
                    <Badge tone={myCompletedReview.recommendation === "ACCEPT" ? "success" : myCompletedReview.recommendation === "REJECT" ? "danger" : "warning"}>
                      {RECOMMENDATION_LABELS[myCompletedReview.recommendation] || myCompletedReview.recommendation}
                    </Badge>
                  </p>
                )}
              </div>
            </div>
            {canEditReview && (
              <Button size="sm" variant="secondary" onClick={startEditReview}>
                <Pencil className="h-3.5 w-3.5" />
                {t("reviewForm.editReview")}
              </Button>
            )}
          </div>
          {canEditReview && (
            <p className="mt-2 text-[11px] text-ink-muted">
              {t("reviewForm.editWindowHint")}
            </p>
          )}
        </Alert>
      )}

      {/* Paper details for reviewers — shown prominently above the review form so reviewer
          can reference the paper while writing */}
      {isAssignedReviewer && !isOwner && (() => {
        const paperFiles = files.filter((f) => f.kind === "MANUSCRIPT" || f.kind === "SUPPLEMENTARY");
        return (
          <Card id="section-paper-details" accent="info">
            <CardHeader>
              <h3 className="text-sm font-semibold text-ink flex items-center gap-2">
                <FileText className="h-4 w-4" />
                {t("detail.paperDetails")}
              </h3>
            </CardHeader>
            <CardBody className="space-y-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-[11px] font-semibold text-ink-muted uppercase tracking-wider mb-1">
                    {t("detail.authorLabel")}
                  </p>
                  <p className="text-sm text-ink">
                    {displayNameTh(submission.author)}
                    {submission.author.affiliation && (
                      <span className="text-ink-muted"> ({submission.author.affiliation})</span>
                    )}
                  </p>
                </div>
                {submission.track && (
                  <div>
                    <p className="text-[11px] font-semibold text-ink-muted uppercase tracking-wider mb-1">
                      {t("detail.trackLabel")}
                    </p>
                    <Badge tone="info">{submission.track.name}</Badge>
                  </div>
                )}
              </div>

              {submission.coAuthors.length > 0 && (
                <div>
                  <p className="text-[11px] font-semibold text-ink-muted uppercase tracking-wider mb-1">
                    {t("detail.coAuthorsLabel")}
                  </p>
                  <p className="text-sm text-ink">
                    {submission.coAuthors
                      .map((ca) => `${ca.name}${ca.affiliation ? ` (${ca.affiliation})` : ""}`)
                      .join(", ")}
                  </p>
                </div>
              )}

              {submission.titleEn && (
                <div>
                  <p className="text-[11px] font-semibold text-ink-muted uppercase tracking-wider mb-1">
                    {t("detail.titleEn")}
                  </p>
                  <p className="text-sm text-ink italic">{submission.titleEn}</p>
                </div>
              )}

              {(submission.abstract || submission.abstractEn) && (
                <div className="grid gap-4 lg:grid-cols-2">
                  {submission.abstract && (
                    <div>
                      <p className="text-[11px] font-semibold text-ink-muted uppercase tracking-wider mb-1.5">
                        {t("detail.abstractTh")}
                      </p>
                      <p className="text-sm text-ink whitespace-pre-wrap leading-relaxed rounded-lg bg-surface-alt p-3">
                        {submission.abstract}
                      </p>
                    </div>
                  )}
                  {submission.abstractEn && (
                    <div>
                      <p className="text-[11px] font-semibold text-ink-muted uppercase tracking-wider mb-1.5">
                        {t("detail.abstractEn")}
                      </p>
                      <p className="text-sm text-ink whitespace-pre-wrap leading-relaxed rounded-lg bg-surface-alt p-3">
                        {submission.abstractEn}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {submission.keywords && (
                <div>
                  <p className="text-[11px] font-semibold text-ink-muted uppercase tracking-wider mb-1.5">
                    {t("detail.keywords")}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {submission.keywords.split(",").map((kw, i) => (
                      <span
                        key={i}
                        className="text-xs bg-white border border-border text-ink-light px-2.5 py-1 rounded-md"
                      >
                        {kw.trim()}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {paperFiles.length > 0 && (
                <div>
                  <p className="text-[11px] font-semibold text-ink-muted uppercase tracking-wider mb-2">
                    {t("detail.paperFiles")}
                  </p>
                  <FileList
                    submissionId={submission.id}
                    files={paperFiles}
                    canDelete={false}
                    currentUserId={currentUserId}
                  />
                </div>
              )}
            </CardBody>
          </Card>
        );
      })()}

      {/* Round 2 banner — prompts reviewer to re-evaluate the revised manuscript */}
      {isRound2Active && !editReviewMode && (
        <Alert tone="info">
          <div className="flex items-start gap-2">
            <RotateCcw className="h-4 w-4 shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-semibold">{t("reviewForm.round2Title")}</p>
              <p className="mt-0.5 text-xs">{t("reviewForm.round2Desc")}</p>
            </div>
          </div>
        </Alert>
      )}

      {/* Review Submission Form — shown when:
          - reviewer hasn't submitted yet (round 1), OR
          - reviewer is editing within 24h window, OR
          - round 2 is active (author resubmitted after REVISE) */}
      {isAssignedReviewer && (!myCompletedReview || editReviewMode || isRound2Active) && (() => {
        const myAttachments = files.filter(
          (f) => f.kind === "REVIEW_ATTACHMENT" && f.uploadedById === currentUserId
        );
        const MIN_COMMENTS = 50;
        const authorChars = reviewCommentsToAuthor.length;
        const chairChars = reviewCommentsToChair.length;
        const ready = Boolean(reviewRecommendation) && reviewCommentsToAuthor.trim().length >= MIN_COMMENTS;
        const step1Done = Boolean(reviewRecommendation);
        const step2Done = reviewCommentsToAuthor.trim().length >= MIN_COMMENTS;

        const formContent = (
          <>
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
            {otherTabConflict && (
              <Alert tone="warning">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm">
                    <p className="font-medium">{t("reviewForm.otherTabConflictTitle")}</p>
                    <p className="text-xs">{t("reviewForm.otherTabConflictDesc")}</p>
                  </div>
                  <Button size="sm" variant="secondary" onClick={reloadFromOtherTab}>
                    {t("reviewForm.otherTabReload")}
                  </Button>
                </div>
              </Alert>
            )}

            {/* Step 1 — Recommendation */}
            <section className="space-y-2">
              <StepHeader
                number={1}
                done={step1Done}
                title={t("reviewForm.step1")}
                hint={t("reviewForm.step1Required")}
                tone="required"
              />
              <RecommendationPicker
                value={reviewRecommendation as "" | "ACCEPT" | "REVISE" | "REJECT"}
                onChange={(v) => setReviewRecommendation(v)}
              />
            </section>

            {/* Step 2 — Comments to author */}
            <section className="space-y-2">
              <StepHeader
                number={2}
                done={step2Done}
                title={t("reviewForm.step2")}
                hint={t("reviewForm.step1Required")}
                tone="required"
              />
              <p className="text-xs text-ink-muted">{t("reviewForm.commentsToAuthorExamples")}</p>
              <Textarea
                id="reviewCommentsToAuthor"
                value={reviewCommentsToAuthor}
                onChange={(e) => setReviewCommentsToAuthor(e.target.value)}
                placeholder={t("reviewForm.commentsToAuthorPlaceholder")}
                rows={focusMode ? 10 : 6}
              />
              <p className={`text-[11px] text-right ${authorChars > 0 && authorChars < MIN_COMMENTS ? "text-amber-600" : "text-ink-muted"}`}>
                {authorChars < MIN_COMMENTS && authorChars > 0
                  ? t("reviewForm.charCountMin", { n: authorChars, min: MIN_COMMENTS })
                  : t("reviewForm.charCount", { n: authorChars })}
              </p>
            </section>

            {/* Step 3 — Comments to chair */}
            <section className="space-y-2">
              <StepHeader
                number={3}
                done={chairChars > 0}
                title={t("reviewForm.step3")}
                hint={t("reviewForm.step3Optional")}
                tone="optional"
              />
              <p className="text-xs text-ink-muted">{t("reviewForm.commentsToChairExamples")}</p>
              <Textarea
                id="reviewCommentsToChair"
                value={reviewCommentsToChair}
                onChange={(e) => setReviewCommentsToChair(e.target.value)}
                placeholder={t("reviewForm.commentsToChairPlaceholder")}
                rows={focusMode ? 5 : 3}
              />
              <p className="text-[11px] text-right text-ink-muted">
                {t("reviewForm.charCount", { n: chairChars })}
              </p>
            </section>

            {/* Step 4 — Attachments */}
            <section className="space-y-2">
              <StepHeader
                number={4}
                done={myAttachments.length > 0}
                title={t("reviewForm.step4")}
                hint={t("reviewForm.step4Optional")}
                tone="optional"
              />
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
            </section>
          </>
        );

        const actionBar = (
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2 text-xs">
              {ready ? (
                <span className="inline-flex items-center gap-1 text-emerald-600 font-medium">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  {t("reviewForm.summaryReady")}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-amber-600">
                  <AlertCircle className="h-3.5 w-3.5" />
                  {t("reviewForm.summaryIncomplete")}
                </span>
              )}
              <span className="text-ink-muted/60">·</span>
              {draftSavedAt ? (
                <span className="inline-flex items-center gap-1 text-ink-muted">
                  <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                  {t("reviewForm.draftSavedAt", { time: new Date(draftSavedAt).toLocaleTimeString() })}
                </span>
              ) : (
                <span className="text-ink-muted/70">{t("reviewForm.draftAutoSaveHint")}</span>
              )}
            </div>
            <div className="flex gap-2">
              {editReviewMode && (
                <Button variant="ghost" onClick={cancelEditReview} size="sm">
                  {t("common.cancel")}
                </Button>
              )}
              <Button
                onClick={handleSubmitReview}
                loading={submittingReview}
                disabled={!ready}
              >
                <Send className="h-3.5 w-3.5" />
                {editReviewMode ? t("reviewForm.saveEdit") : t("reviewForm.submit")}
              </Button>
            </div>
          </div>
        );

        const headerControls = (
          <div className="flex items-center gap-2 flex-wrap">
            {manuscriptFile && !focusMode && (
              <button
                type="button"
                onClick={() => setPreviewOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-white px-2.5 py-1 text-xs font-medium text-brand-600 border border-brand-200 hover:bg-brand-50 hover:border-brand-300 transition-colors"
              >
                <Paperclip className="h-3.5 w-3.5" />
                {t("reviewForm.previewManuscript")}
              </button>
            )}
            {manuscriptFile && (
              <button
                type="button"
                onClick={() => setFocusMode((prev) => !prev)}
                className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium border transition-colors ${
                  focusMode
                    ? "bg-brand-500 text-white border-brand-500 hover:bg-brand-600"
                    : "bg-white text-brand-600 border-brand-200 hover:bg-brand-50 hover:border-brand-300"
                }`}
              >
                {focusMode ? t("reviewForm.exitFocusMode") : t("reviewForm.focusMode")}
              </button>
            )}
          </div>
        );

        if (focusMode) {
          return (
            <div className="fixed inset-0 z-50 flex flex-col bg-slate-950/70 backdrop-blur-sm p-2 sm:p-3">
              <div className="flex flex-1 flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
                {/* Focus header */}
                <div className="flex flex-wrap items-center gap-3 border-b border-border bg-surface px-4 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] uppercase tracking-wider text-ink-muted">
                      {t("reviewForm.focusMode")}
                    </p>
                    <h2 className="truncate text-sm font-semibold text-ink sm:text-base">
                      {submission.title}
                    </h2>
                  </div>
                  {headerControls}
                </div>
                {/* Body — split pane */}
                <div className="grid flex-1 grid-cols-1 overflow-hidden lg:grid-cols-[55%_45%]">
                  {/* PDF left */}
                  <div className="relative min-h-[40vh] bg-slate-100 lg:min-h-0">
                    {focusPdfUrl ? (
                      <iframe src={focusPdfUrl} title={manuscriptFile?.originalName || ""} className="h-full w-full border-0" />
                    ) : (
                      <div className="flex h-full items-center justify-center text-ink-muted text-sm">
                        {t("pdfPreview.loading")}
                      </div>
                    )}
                  </div>
                  {/* Form right */}
                  <div id="section-review-form" className="flex flex-col overflow-hidden border-t border-border lg:border-t-0 lg:border-l">
                    <div className="flex-1 overflow-y-auto p-5 space-y-5">
                      {formContent}
                    </div>
                    <div className="border-t border-border bg-surface-alt px-4 py-3">
                      {actionBar}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        }

        return (
          <Card id="section-review-form" accent="brand">
            <CardHeader>
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <h3 className="text-sm font-semibold text-ink flex items-center gap-2">
                  <Send className="h-4 w-4" />
                  {t("reviewForm.title")}
                </h3>
                {headerControls}
              </div>
            </CardHeader>
            <CardBody className="space-y-5">{formContent}</CardBody>
            <CardFooter>{actionBar}</CardFooter>
          </Card>
        );
      })()}

      {/* Paper Info — hidden for reviewers because they see the prominent PaperDetails card above */}
      {!(isAssignedReviewer && !isOwner) && (
      <div id="section-paper-info">
      <Collapsible title={t("detail.paperInfo")} defaultOpen={submission.status === "DRAFT"}>
        <div className="space-y-4">
          <div>
            <h3 className="text-xs font-semibold text-ink-muted uppercase tracking-wider mb-1">{t("detail.authorLabel")}</h3>
            <p className="text-sm text-ink">
              {displayNameTh(submission.author)}
              {submission.author.affiliation && <span className="text-ink-muted"> ({submission.author.affiliation})</span>}
            </p>
            <p className="text-xs text-ink-muted">{submission.author.email}</p>
          </div>

          {submission.coAuthors.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-ink-muted uppercase tracking-wider mb-1">{t("detail.coAuthorsLabel")}</h3>
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
      )}

      {/* Files Section — hidden for reviewers because paper files already appear in the Paper Details card above */}
      {!(isAssignedReviewer && !isOwner) && (
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
      )}

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
            <Button onClick={requestDecision} loading={deciding} disabled={!decisionOutcome || (decisionOutcome === "CONDITIONAL_ACCEPT" && !decisionConditions.trim())}>
              {t("detail.confirmDecision")}
            </Button>
          </CardFooter>
        </Card>
      )}

      <ConfirmDialog
        open={decisionConfirmOpen}
        title={t("detail.decisionPartialConfirmTitle")}
        description={t("detail.decisionPartialConfirmDesc", {
          completed: submission.reviews.filter((r) => r.completedAt).length,
          total: reviewCounts?.total ?? submission.reviews.length,
        })}
        confirmLabel={t("detail.decisionPartialConfirmBtn")}
        cancelLabel={t("common.cancel")}
        tone="primary"
        loading={deciding}
        onCancel={() => setDecisionConfirmOpen(false)}
        onConfirm={() => { void handleDecision(); }}
      />

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
              <a
                href={isAssignedReviewer && !isOwner ? "#section-paper-details" : "#section-paper-info"}
                className="flex items-center gap-2 py-1.5 px-2 rounded-lg text-ink-muted hover:bg-surface-hover hover:text-ink transition-colors"
              >
                <FileText className="h-3.5 w-3.5 shrink-0" />
                {isAssignedReviewer && !isOwner ? t("detail.paperDetails") : t("detail.paperInfo")}
              </a>
              {!(isAssignedReviewer && !isOwner) && (
                <a href="#section-files" className="flex items-center gap-2 py-1.5 px-2 rounded-lg text-ink-muted hover:bg-surface-hover hover:text-ink transition-colors">
                  <Paperclip className="h-3.5 w-3.5 shrink-0" />{t("detail.files")}
                </a>
              )}
              {(isAdmin || isOwner) && !(isAssignedReviewer && !isOwner) && submission.advisorName && (
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
          mimeType={manuscriptFile.mimeType}
          onClose={() => setPreviewOpen(false)}
        />
      )}
    </div>
  );
}
