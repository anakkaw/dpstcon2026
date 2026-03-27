export type SubmissionAccessFlags = {
  isAdmin: boolean;
  isTrackHead: boolean;
  isAssignedReviewer: boolean;
  isAuthor: boolean;
};

export function canRevealReviewerIdentity(access: SubmissionAccessFlags) {
  return access.isAdmin || access.isTrackHead || access.isAssignedReviewer;
}

export function getAllowedDiscussionVisibilities(
  access: SubmissionAccessFlags
) {
  const allowed = new Set<string>();

  if (access.isAuthor) {
    allowed.add("AUTHOR_VISIBLE");
  }

  if (access.isAssignedReviewer) {
    allowed.add("REVIEWERS_ONLY");
  }

  if (access.isTrackHead || access.isAdmin) {
    allowed.add("CHAIRS_ONLY");
    allowed.add("AUTHOR_VISIBLE");
    allowed.add("REVIEWERS_ONLY");
  }

  return allowed;
}

export function isDuplicateReviewRound(params: {
  hasExistingReview: boolean;
  assignmentStatus?: string | null;
  isAdminOverride?: boolean;
}) {
  if (!params.hasExistingReview) return false;
  if (params.isAdminOverride) return true;
  return params.assignmentStatus === "COMPLETED";
}
