/**
 * Pure policy helpers for the public e-abstract feature.
 *
 * Kept free of any DB access so the rules can be unit-tested.
 * Called from:
 *   - server/api/routes/submissions.ts (PATCH /:id/publication)
 *   - server/api/routes/reviews.ts     (chair decision → status change)
 *   - server/actions/submission.ts     (author withdraw → status change)
 *   - server/public-conference-data.ts (file proxy + fallback resolver)
 *   - server/admin-publications-data.ts (filter eligible files)
 */

/** File kinds eligible to serve as the public e-abstract document. */
export const E_ABSTRACT_ELIGIBLE_KINDS = [
  "MANUSCRIPT",
  "CAMERA_READY",
  "E_ABSTRACT",
] as const;

export type EAbstractEligibleKind = (typeof E_ABSTRACT_ELIGIBLE_KINDS)[number];

/**
 * The public e-abstract is served exclusively as PDF. Authors whose original
 * submission isn't PDF require an admin to upload a PDF override.
 */
export const E_ABSTRACT_MIME = "application/pdf";

export function isEAbstractEligibleKind(
  kind: string | null | undefined
): kind is EAbstractEligibleKind {
  return (
    kind === "MANUSCRIPT" ||
    kind === "CAMERA_READY" ||
    kind === "E_ABSTRACT"
  );
}

export function isPdfMime(mimeType: string | null | undefined): boolean {
  return mimeType === E_ABSTRACT_MIME;
}

/**
 * Decides whether a stored file attached to a submission may be served on
 * the public file proxy endpoint.
 *
 * A file is visible publicly when ALL of:
 *   - its submission is currently published
 *   - its mime type is PDF (the only public e-abstract format)
 *   - it's either the explicitly chosen eAbstractFileId OR has an eligible kind
 *
 * Files for templates (conference docs) use a separate code path and aren't
 * covered here.
 */
export function isSubmissionFilePubliclyVisible(opts: {
  fileId: string;
  fileKind: string;
  fileMimeType: string;
  submissionPublished: boolean;
  submissionEAbstractFileId: string | null;
}): boolean {
  if (!opts.submissionPublished) return false;
  if (!isPdfMime(opts.fileMimeType)) return false;
  if (opts.submissionEAbstractFileId === opts.fileId) return true;
  return isEAbstractEligibleKind(opts.fileKind);
}

/**
 * State-transition guard for the publication endpoint.
 * Returns ok=true only when the requested change is allowed.
 */
export type PublishGuardResult =
  | { ok: true }
  | { ok: false; reason: "ONLY_ACCEPTED_CAN_BE_PUBLISHED" };

export function canPublishSubmission(opts: {
  currentStatus: string;
  requestedPublished: boolean | undefined;
}): PublishGuardResult {
  // Only block PUBLISHING a non-ACCEPTED paper. Un-publishing is always allowed.
  if (opts.requestedPublished === true && opts.currentStatus !== "ACCEPTED") {
    return { ok: false, reason: "ONLY_ACCEPTED_CAN_BE_PUBLISHED" };
  }
  return { ok: true };
}

/**
 * Validates that the file the admin is picking belongs to the submission,
 * has an eligible kind, and is a PDF. Pure logic; caller does the DB lookup.
 */
export type FilePickGuardResult =
  | { ok: true }
  | {
      ok: false;
      reason:
        | "FILE_NOT_OWNED_BY_SUBMISSION"
        | "FILE_KIND_NOT_ELIGIBLE"
        | "FILE_NOT_PDF";
    };

export function canPickFileAsEAbstract(opts: {
  submissionId: string;
  fileSubmissionId: string | null;
  fileKind: string;
  fileMimeType: string;
}): FilePickGuardResult {
  if (opts.fileSubmissionId !== opts.submissionId) {
    return { ok: false, reason: "FILE_NOT_OWNED_BY_SUBMISSION" };
  }
  if (!isEAbstractEligibleKind(opts.fileKind)) {
    return { ok: false, reason: "FILE_KIND_NOT_ELIGIBLE" };
  }
  if (!isPdfMime(opts.fileMimeType)) {
    return { ok: false, reason: "FILE_NOT_PDF" };
  }
  return { ok: true };
}

/**
 * Returns the publication patch to apply alongside any submission status
 * change. If the submission is moving OUT of ACCEPTED (chair re-decides,
 * author withdraws, etc.) we automatically take it down from the public
 * site so attendees never see a stale abstract.
 *
 * The admin's `eAbstractFileId` selection is preserved so that if the
 * paper returns to ACCEPTED, the admin only has to flip publish back on.
 */
export function publicationPatchOnStatusChange(
  newStatus: string
): { isPublished?: false } {
  return newStatus === "ACCEPTED" ? {} : { isPublished: false };
}
