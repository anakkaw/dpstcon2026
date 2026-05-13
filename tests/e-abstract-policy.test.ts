import test from "node:test";
import assert from "node:assert/strict";
import {
  canPickFileAsEAbstract,
  canPublishSubmission,
  isEAbstractEligibleKind,
  isPdfMime,
  isSubmissionFilePubliclyVisible,
  publicationPatchOnStatusChange,
} from "../server/e-abstract-policy";

const PDF = "application/pdf";
const DOCX =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

// ─── isEAbstractEligibleKind ────────────────────────────────────

test("isEAbstractEligibleKind accepts the three approved kinds", () => {
  assert.equal(isEAbstractEligibleKind("MANUSCRIPT"), true);
  assert.equal(isEAbstractEligibleKind("CAMERA_READY"), true);
  assert.equal(isEAbstractEligibleKind("E_ABSTRACT"), true);
});

test("isEAbstractEligibleKind rejects other stored file kinds", () => {
  assert.equal(isEAbstractEligibleKind("SUPPLEMENTARY"), false);
  assert.equal(isEAbstractEligibleKind("REVIEW_ATTACHMENT"), false);
});

test("isEAbstractEligibleKind rejects null / undefined / random strings", () => {
  assert.equal(isEAbstractEligibleKind(null), false);
  assert.equal(isEAbstractEligibleKind(undefined), false);
  assert.equal(isEAbstractEligibleKind(""), false);
  assert.equal(isEAbstractEligibleKind("MANUSCRIPT_DRAFT"), false);
});

// ─── isPdfMime ──────────────────────────────────────────────────

test("isPdfMime accepts only application/pdf", () => {
  assert.equal(isPdfMime(PDF), true);
  assert.equal(isPdfMime(DOCX), false);
  assert.equal(isPdfMime("image/png"), false);
  assert.equal(isPdfMime(null), false);
  assert.equal(isPdfMime(undefined), false);
  assert.equal(isPdfMime(""), false);
});

// ─── isSubmissionFilePubliclyVisible ────────────────────────────

const baseFile = {
  fileId: "file-1",
  fileKind: "MANUSCRIPT",
  fileMimeType: PDF,
  submissionPublished: true,
  submissionEAbstractFileId: null as string | null,
};

test("unpublished submissions never expose any file", () => {
  assert.equal(
    isSubmissionFilePubliclyVisible({
      ...baseFile,
      submissionPublished: false,
    }),
    false
  );
  // Even if the admin had previously chosen it, an unpublished paper
  // hides everything.
  assert.equal(
    isSubmissionFilePubliclyVisible({
      ...baseFile,
      submissionPublished: false,
      submissionEAbstractFileId: "file-1",
    }),
    false
  );
});

test("non-PDF files never go public, even when explicitly picked", () => {
  // PDF-only policy is unconditional — admin's pick can't override it.
  assert.equal(
    isSubmissionFilePubliclyVisible({
      ...baseFile,
      fileMimeType: DOCX,
      submissionEAbstractFileId: "file-1",
    }),
    false
  );
  // Any other mime: still rejected.
  assert.equal(
    isSubmissionFilePubliclyVisible({ ...baseFile, fileMimeType: "image/png" }),
    false
  );
});

test("explicitly chosen PDF is always visible when published", () => {
  assert.equal(
    isSubmissionFilePubliclyVisible({
      fileId: "file-7",
      // Even an ineligible kind is fine if explicitly picked (defence in depth).
      fileKind: "REVIEW_ATTACHMENT",
      fileMimeType: PDF,
      submissionPublished: true,
      submissionEAbstractFileId: "file-7",
    }),
    true
  );
});

test("with no explicit pick, eligible PDF kinds are visible when published", () => {
  for (const kind of ["MANUSCRIPT", "CAMERA_READY", "E_ABSTRACT"]) {
    assert.equal(
      isSubmissionFilePubliclyVisible({ ...baseFile, fileKind: kind }),
      true,
      `expected ${kind} to be visible`
    );
  }
});

test("with no explicit pick, ineligible kinds stay hidden", () => {
  for (const kind of ["SUPPLEMENTARY", "REVIEW_ATTACHMENT"]) {
    assert.equal(
      isSubmissionFilePubliclyVisible({ ...baseFile, fileKind: kind }),
      false,
      `expected ${kind} to be hidden`
    );
  }
});

// ─── canPublishSubmission ───────────────────────────────────────

test("ACCEPTED submissions may be published", () => {
  assert.deepEqual(
    canPublishSubmission({
      currentStatus: "ACCEPTED",
      requestedPublished: true,
    }),
    { ok: true }
  );
});

test("non-ACCEPTED submissions are blocked from going public", () => {
  for (const status of [
    "DRAFT",
    "ADVISOR_APPROVAL_PENDING",
    "SUBMITTED",
    "UNDER_REVIEW",
    "REVISION_REQUIRED",
    "REJECTED",
    "DESK_REJECTED",
    "WITHDRAWN",
  ]) {
    const result = canPublishSubmission({
      currentStatus: status,
      requestedPublished: true,
    });
    assert.deepEqual(
      result,
      { ok: false, reason: "ONLY_ACCEPTED_CAN_BE_PUBLISHED" },
      `expected ${status} to be blocked`
    );
  }
});

test("un-publishing is allowed regardless of status", () => {
  for (const status of ["ACCEPTED", "WITHDRAWN", "REJECTED"]) {
    assert.deepEqual(
      canPublishSubmission({
        currentStatus: status,
        requestedPublished: false,
      }),
      { ok: true }
    );
  }
});

test("metadata-only patches (no isPublished) are allowed", () => {
  // E.g. when the admin only updates eAbstractFileId.
  assert.deepEqual(
    canPublishSubmission({
      currentStatus: "REVISION_REQUIRED",
      requestedPublished: undefined,
    }),
    { ok: true }
  );
});

// ─── canPickFileAsEAbstract ─────────────────────────────────────

test("file must belong to the submission", () => {
  assert.deepEqual(
    canPickFileAsEAbstract({
      submissionId: "sub-a",
      fileSubmissionId: "sub-b",
      fileKind: "MANUSCRIPT",
      fileMimeType: PDF,
    }),
    { ok: false, reason: "FILE_NOT_OWNED_BY_SUBMISSION" }
  );
  // Orphan files (no submissionId) also rejected.
  assert.deepEqual(
    canPickFileAsEAbstract({
      submissionId: "sub-a",
      fileSubmissionId: null,
      fileKind: "MANUSCRIPT",
      fileMimeType: PDF,
    }),
    { ok: false, reason: "FILE_NOT_OWNED_BY_SUBMISSION" }
  );
});

test("file kind must be eligible", () => {
  assert.deepEqual(
    canPickFileAsEAbstract({
      submissionId: "sub-a",
      fileSubmissionId: "sub-a",
      fileKind: "REVIEW_ATTACHMENT",
      fileMimeType: PDF,
    }),
    { ok: false, reason: "FILE_KIND_NOT_ELIGIBLE" }
  );
  assert.deepEqual(
    canPickFileAsEAbstract({
      submissionId: "sub-a",
      fileSubmissionId: "sub-a",
      fileKind: "SUPPLEMENTARY",
      fileMimeType: PDF,
    }),
    { ok: false, reason: "FILE_KIND_NOT_ELIGIBLE" }
  );
});

test("file must be PDF", () => {
  assert.deepEqual(
    canPickFileAsEAbstract({
      submissionId: "sub-a",
      fileSubmissionId: "sub-a",
      fileKind: "MANUSCRIPT",
      fileMimeType: DOCX,
    }),
    { ok: false, reason: "FILE_NOT_PDF" }
  );
});

test("eligible PDF file owned by the submission may be picked", () => {
  for (const kind of ["MANUSCRIPT", "CAMERA_READY", "E_ABSTRACT"]) {
    assert.deepEqual(
      canPickFileAsEAbstract({
        submissionId: "sub-a",
        fileSubmissionId: "sub-a",
        fileKind: kind,
        fileMimeType: PDF,
      }),
      { ok: true },
      `expected PDF ${kind} to be pickable`
    );
  }
});

test("ownership check runs before kind/mime checks", () => {
  // A file from another submission should fail with the ownership reason
  // even if it would have failed other checks too — keeps error messages
  // stable and avoids leaking info about the other submission's files.
  assert.deepEqual(
    canPickFileAsEAbstract({
      submissionId: "sub-a",
      fileSubmissionId: "sub-b",
      fileKind: "REVIEW_ATTACHMENT",
      fileMimeType: DOCX,
    }),
    { ok: false, reason: "FILE_NOT_OWNED_BY_SUBMISSION" }
  );
});

test("kind check runs before mime check", () => {
  // An ineligible-kind PDF still fails with kind reason, not mime.
  assert.deepEqual(
    canPickFileAsEAbstract({
      submissionId: "sub-a",
      fileSubmissionId: "sub-a",
      fileKind: "REVIEW_ATTACHMENT",
      fileMimeType: PDF,
    }),
    { ok: false, reason: "FILE_KIND_NOT_ELIGIBLE" }
  );
});

// ─── publicationPatchOnStatusChange ─────────────────────────────

test("staying in ACCEPTED produces an empty patch", () => {
  assert.deepEqual(publicationPatchOnStatusChange("ACCEPTED"), {});
});

test("moving out of ACCEPTED forces isPublished=false", () => {
  for (const status of [
    "DRAFT",
    "SUBMITTED",
    "UNDER_REVIEW",
    "REVISION_REQUIRED",
    "REBUTTAL",
    "REJECTED",
    "DESK_REJECTED",
    "WITHDRAWN",
  ]) {
    assert.deepEqual(
      publicationPatchOnStatusChange(status),
      { isPublished: false },
      `expected ${status} to auto-unpublish`
    );
  }
});
