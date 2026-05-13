import { count, eq } from "drizzle-orm";
import { db } from "@/server/db";
import { submissionResubmissions } from "@/server/db/schema";

/**
 * The revision round currently in flight for a submission.
 *
 * - 1 = original submission (no resubmits yet)
 * - 2 = author has resubmitted once
 * - 3 = author has resubmitted twice
 *
 * Used by:
 * - Review insert (round of the review being written)
 * - Decision insert (round of the decision being closed)
 * - Resubmit insert (round + 1 = the round about to start)
 *
 * The count-then-use pattern is NOT inside a transaction. In practice the
 * UI flows that trigger these inserts are not concurrent for the same
 * submission, and the unique indexes on submission_resubmissions(round)
 * and decision_history(decided_at) catch the race.
 */
export async function getCurrentSubmissionRound(
  submissionId: string
): Promise<number> {
  const [{ priorResubmits }] = await db
    .select({ priorResubmits: count() })
    .from(submissionResubmissions)
    .where(eq(submissionResubmissions.submissionId, submissionId));
  return Number(priorResubmits) + 1;
}
