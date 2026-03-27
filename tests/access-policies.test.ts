import test from "node:test";
import assert from "node:assert/strict";
import {
  canRevealReviewerIdentity,
  getAllowedDiscussionVisibilities,
  isDuplicateReviewRound,
} from "../server/access-policies";

test("keeps reviewer identity hidden from authors with unrelated secondary roles", () => {
  assert.equal(
    canRevealReviewerIdentity({
      isAdmin: false,
      isTrackHead: false,
      isAssignedReviewer: false,
      isAuthor: true,
    }),
    false
  );
});

test("allows reviewer identity for managers or assigned reviewers", () => {
  assert.equal(
    canRevealReviewerIdentity({
      isAdmin: false,
      isTrackHead: true,
      isAssignedReviewer: false,
      isAuthor: true,
    }),
    true
  );
  assert.equal(
    canRevealReviewerIdentity({
      isAdmin: false,
      isTrackHead: false,
      isAssignedReviewer: true,
      isAuthor: false,
    }),
    true
  );
});

test("discussion visibility is constrained by submission-local access", () => {
  assert.deepEqual(
    Array.from(
      getAllowedDiscussionVisibilities({
        isAdmin: false,
        isTrackHead: false,
        isAssignedReviewer: false,
        isAuthor: true,
      })
    ),
    ["AUTHOR_VISIBLE"]
  );

  assert.deepEqual(
    Array.from(
      getAllowedDiscussionVisibilities({
        isAdmin: false,
        isTrackHead: false,
        isAssignedReviewer: true,
        isAuthor: false,
      })
    ),
    ["REVIEWERS_ONLY"]
  );
});

test("duplicate review submissions are rejected once a round is completed", () => {
  assert.equal(
    isDuplicateReviewRound({
      hasExistingReview: true,
      assignmentStatus: "COMPLETED",
    }),
    true
  );
  assert.equal(
    isDuplicateReviewRound({
      hasExistingReview: true,
      assignmentStatus: "ACCEPTED",
    }),
    false
  );
});
