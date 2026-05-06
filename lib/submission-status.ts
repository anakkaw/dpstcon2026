export const ACCEPTED_SUBMISSION_STATUSES = [
  "ACCEPTED",
  "CAMERA_READY_PENDING",
  "CAMERA_READY_SUBMITTED",
] as const;

export type AcceptedSubmissionStatus = (typeof ACCEPTED_SUBMISSION_STATUSES)[number];

export function isAcceptedSubmissionStatus(
  status: string | null | undefined
): status is AcceptedSubmissionStatus {
  return ACCEPTED_SUBMISSION_STATUSES.includes(status as AcceptedSubmissionStatus);
}

export function normalizeSubmissionStatus(status: string) {
  return isAcceptedSubmissionStatus(status) ? "ACCEPTED" : status;
}

export function getAcceptedSubmissionCount(
  statusCounts: Record<string, number | undefined>
) {
  return ACCEPTED_SUBMISSION_STATUSES.reduce(
    (total, status) => total + (statusCounts[status] ?? 0),
    0
  );
}

export function getSubmissionStatusSummaryCounts(
  statusCounts: Record<string, number | undefined>
) {
  const summaryCounts: Record<string, number> = {};

  for (const [status, count = 0] of Object.entries(statusCounts)) {
    const normalizedStatus = normalizeSubmissionStatus(status);
    const summaryStatus = isAcceptedSubmissionStatus(normalizedStatus)
      ? "ACCEPTED"
      : normalizedStatus;
    summaryCounts[summaryStatus] = (summaryCounts[summaryStatus] ?? 0) + count;
  }

  return summaryCounts;
}
