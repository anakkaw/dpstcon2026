import test from "node:test";
import assert from "node:assert/strict";
import {
  canAuthorEditSubmission,
  canAuthorUploadSubmissionFile,
  getSubmissionValidationError,
} from "@/server/submission-workflow";

test("authors can only edit metadata while submission is in draft", () => {
  assert.equal(canAuthorEditSubmission("DRAFT"), true);
  assert.equal(canAuthorEditSubmission("ADVISOR_APPROVAL_PENDING"), false);
  assert.equal(canAuthorEditSubmission("REVISION_REQUIRED"), false);
});

test("author upload permissions follow workflow state", () => {
  assert.equal(canAuthorUploadSubmissionFile("DRAFT", "MANUSCRIPT"), true);
  assert.equal(canAuthorUploadSubmissionFile("REVISION_REQUIRED", "MANUSCRIPT"), true);
  assert.equal(canAuthorUploadSubmissionFile("UNDER_REVIEW", "MANUSCRIPT"), false);
  assert.equal(canAuthorUploadSubmissionFile("DRAFT", "CAMERA_READY"), false);
  assert.equal(
    canAuthorUploadSubmissionFile("CAMERA_READY_PENDING", "CAMERA_READY"),
    true
  );
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
      fileUrl: "file-key",
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
      fileUrl: "file-key",
    }),
    null
  );
});
