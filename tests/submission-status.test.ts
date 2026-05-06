import test from "node:test";
import assert from "node:assert/strict";
import {
  getAcceptedSubmissionCount,
  getSubmissionStatusSummaryCounts,
  isAcceptedSubmissionStatus,
  normalizeSubmissionStatus,
} from "@/lib/submission-status";

test("accepted submission count includes camera-ready states", () => {
  assert.equal(
    getAcceptedSubmissionCount({
      ACCEPTED: 2,
      CAMERA_READY_PENDING: 3,
      CAMERA_READY_SUBMITTED: 5,
      REJECTED: 7,
    }),
    10
  );
});

test("submission status summaries collapse accepted workflow states", () => {
  assert.deepEqual(
    getSubmissionStatusSummaryCounts({
      SUBMITTED: 31,
      ACCEPTED: 10,
      UNDER_REVIEW: 7,
      REVISION_REQUIRED: 2,
      CAMERA_READY_SUBMITTED: 2,
      CAMERA_READY_PENDING: 1,
    }),
    {
      SUBMITTED: 31,
      ACCEPTED: 13,
      UNDER_REVIEW: 7,
      REVISION_REQUIRED: 2,
    }
  );
});

test("legacy camera-ready statuses normalize to accepted", () => {
  assert.equal(normalizeSubmissionStatus("CAMERA_READY_PENDING"), "ACCEPTED");
  assert.equal(normalizeSubmissionStatus("CAMERA_READY_SUBMITTED"), "ACCEPTED");
  assert.equal(normalizeSubmissionStatus("UNDER_REVIEW"), "UNDER_REVIEW");
});

test("accepted submission status predicate matches every accepted workflow state", () => {
  assert.equal(isAcceptedSubmissionStatus("ACCEPTED"), true);
  assert.equal(isAcceptedSubmissionStatus("CAMERA_READY_PENDING"), true);
  assert.equal(isAcceptedSubmissionStatus("CAMERA_READY_SUBMITTED"), true);
  assert.equal(isAcceptedSubmissionStatus("REVISION_REQUIRED"), false);
  assert.equal(isAcceptedSubmissionStatus(null), false);
});
