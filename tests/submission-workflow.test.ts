import test from "node:test";
import assert from "node:assert/strict";
import {
  canMakeSubmissionDecision,
  canAuthorEditSubmission,
  canAuthorEditSubmissionTitle,
  canAuthorUploadSubmissionFile,
  canSubmitReviewForAssignment,
  getDecisionSubmissionStatus,
  getSubmissionValidationError,
} from "@/server/submission-workflow";

test("authors can only edit metadata while submission is in draft", () => {
  assert.equal(canAuthorEditSubmission("DRAFT"), true);
  assert.equal(canAuthorEditSubmission("ADVISOR_APPROVAL_PENDING"), false);
  assert.equal(canAuthorEditSubmission("REVISION_REQUIRED"), false);
});

test("authors can edit the paper title while revising", () => {
  assert.equal(canAuthorEditSubmissionTitle("DRAFT"), true);
  assert.equal(canAuthorEditSubmissionTitle("REVISION_REQUIRED"), true);
  assert.equal(canAuthorEditSubmissionTitle("UNDER_REVIEW"), false);
  assert.equal(canAuthorEditSubmissionTitle("ACCEPTED"), false);
});

test("author upload permissions follow workflow state", () => {
  assert.equal(canAuthorUploadSubmissionFile("DRAFT", "MANUSCRIPT"), true);
  assert.equal(canAuthorUploadSubmissionFile("REVISION_REQUIRED", "MANUSCRIPT"), true);
  assert.equal(canAuthorUploadSubmissionFile("UNDER_REVIEW", "MANUSCRIPT"), false);
  assert.equal(canAuthorUploadSubmissionFile("DRAFT", "CAMERA_READY"), false);
  assert.equal(
    canAuthorUploadSubmissionFile("CAMERA_READY_PENDING", "CAMERA_READY"),
    false
  );
  assert.equal(canAuthorUploadSubmissionFile("ACCEPTED", "CAMERA_READY"), false);
});

test("chair decisions map to the expected submission status", () => {
  assert.equal(getDecisionSubmissionStatus("ACCEPT"), "ACCEPTED");
  assert.equal(getDecisionSubmissionStatus("REJECT"), "REJECTED");
  assert.equal(
    getDecisionSubmissionStatus("CONDITIONAL_ACCEPT"),
    "REVISION_REQUIRED"
  );
  assert.equal(getDecisionSubmissionStatus("DESK_REJECT"), "DESK_REJECTED");
});

test("decision eligibility uses current completed reviews only", () => {
  assert.equal(
    canMakeSubmissionDecision({
      status: "UNDER_REVIEW",
      currentCompletedReviews: 1,
      hasDecision: false,
    }),
    true
  );
  assert.equal(
    canMakeSubmissionDecision({
      status: "UNDER_REVIEW",
      currentCompletedReviews: 0,
      hasDecision: false,
    }),
    false
  );
  assert.equal(
    canMakeSubmissionDecision({
      status: "REVISION_REQUIRED",
      currentCompletedReviews: 1,
      hasDecision: false,
    }),
    false
  );
  assert.equal(
    canMakeSubmissionDecision({
      status: "UNDER_REVIEW",
      currentCompletedReviews: 1,
      hasDecision: true,
    }),
    false
  );
  assert.equal(
    canMakeSubmissionDecision({
      status: "UNDER_REVIEW",
      currentCompletedReviews: 0,
      completedReviewHistory: 1,
      hasDecision: false,
      isRevisionResubmission: true,
    }),
    true
  );
  assert.equal(
    canMakeSubmissionDecision({
      status: "UNDER_REVIEW",
      currentCompletedReviews: 0,
      completedReviewHistory: 0,
      hasDecision: false,
      isRevisionResubmission: true,
    }),
    false
  );
});

test("reviews can only be submitted for accepted assignments", () => {
  assert.equal(canSubmitReviewForAssignment("ACCEPTED"), true);
  assert.equal(canSubmitReviewForAssignment("PENDING"), false);
  assert.equal(canSubmitReviewForAssignment("DECLINED"), false);
  assert.equal(canSubmitReviewForAssignment("COMPLETED"), false);
});

test("submission validation requires all mandatory metadata before submission", () => {
  assert.equal(
    getSubmissionValidationError({
      title: "Thai title",
      titleEn: "",
      abstract: "Thai abstract",
      abstractEn: "English abstract",
      trackId: "track-id",
      advisorEmail: "advisor@example.com",
      advisorName: "Advisor",
      hasManuscript: true,
    }),
    "กรุณากรอกชื่อบทความภาษาอังกฤษ"
  );

  assert.equal(
    getSubmissionValidationError({
      title: "Thai title",
      titleEn: "English title",
      abstract: "Thai abstract",
      abstractEn: "English abstract",
      trackId: "track-id",
      advisorEmail: "advisor@example.com",
      advisorName: "Advisor",
      hasManuscript: true,
    }),
    null
  );
});
