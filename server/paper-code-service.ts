import { eq, isNotNull } from "drizzle-orm";
import { formatPaperCode, getTrackPaperCode, parsePaperCodeSequence } from "@/lib/paper-codes";
import { db } from "@/server/db";
import { submissions } from "@/server/db/schema";

/**
 * Load all existing paper codes and compute next sequence per prefix.
 * Shared by both single and batch generation.
 */
async function buildPrefixCounter(): Promise<Map<string, number>> {
  const rows = await db
    .select({ paperCode: submissions.paperCode })
    .from(submissions)
    .where(isNotNull(submissions.paperCode));

  const counter = new Map<string, number>();
  for (const row of rows) {
    if (!row.paperCode) continue;
    const [prefix] = row.paperCode.split("-");
    const sequence = parsePaperCodeSequence(row.paperCode, prefix);
    if (sequence == null) continue;
    counter.set(prefix, Math.max(counter.get(prefix) ?? 0, sequence));
  }
  return counter;
}

/**
 * Ensure a single submission has a paper code. Idempotent — returns existing code if already set.
 */
export async function ensureSubmissionPaperCode(submissionId: string) {
  const submission = await db.query.submissions.findFirst({
    where: eq(submissions.id, submissionId),
    columns: { id: true, paperCode: true },
    with: { track: { columns: { name: true } } },
  });

  if (!submission) throw new Error("Submission not found");
  if (submission.paperCode) return submission.paperCode;

  const counter = await buildPrefixCounter();
  const prefix = getTrackPaperCode(submission.track?.name);
  const next = (counter.get(prefix) ?? 0) + 1;
  const paperCode = formatPaperCode(prefix, next);

  await db
    .update(submissions)
    .set({ paperCode, updatedAt: new Date() })
    .where(eq(submissions.id, submissionId));

  return paperCode;
}

/**
 * Generate paper codes for all accepted submissions that don't have one yet.
 * Assigns codes in a single pass to avoid sequence gaps.
 */
export async function generateMissingPaperCodes() {
  const acceptedStatuses = ["ACCEPTED", "CAMERA_READY_PENDING", "CAMERA_READY_SUBMITTED"] as const;

  const rows = await db.query.submissions.findMany({
    columns: { id: true, paperCode: true, status: true },
    with: { track: { columns: { name: true } } },
  });

  const targets = rows.filter(
    (row) =>
      acceptedStatuses.includes(row.status as (typeof acceptedStatuses)[number]) &&
      !row.paperCode
  );

  if (targets.length === 0) return [];

  const counter = await buildPrefixCounter();
  const updated: Array<{ id: string; paperCode: string }> = [];

  for (const target of targets) {
    const prefix = getTrackPaperCode(target.track?.name);
    const next = (counter.get(prefix) ?? 0) + 1;
    counter.set(prefix, next);
    const paperCode = formatPaperCode(prefix, next);

    await db
      .update(submissions)
      .set({ paperCode, updatedAt: new Date() })
      .where(eq(submissions.id, target.id));

    updated.push({ id: target.id, paperCode });
  }

  return updated;
}

export async function isPaperCodeAvailable(paperCode: string, excludeSubmissionId?: string) {
  const rows = await db
    .select({ id: submissions.id })
    .from(submissions)
    .where(eq(submissions.paperCode, paperCode));

  if (!excludeSubmissionId) return rows.length === 0;
  return rows.every((row) => row.id === excludeSubmissionId);
}
