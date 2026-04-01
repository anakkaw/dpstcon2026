import { eq, isNotNull } from "drizzle-orm";
import { formatPaperCode, getTrackPaperCode, parsePaperCodeSequence } from "@/lib/paper-codes";
import { db } from "@/server/db";
import { submissions, tracks } from "@/server/db/schema";

async function getNextPaperCode(prefix: string) {
  const rows = await db
    .select({ paperCode: submissions.paperCode })
    .from(submissions)
    .where(isNotNull(submissions.paperCode));

  const maxSequence = rows.reduce((max, row) => {
    const sequence = parsePaperCodeSequence(row.paperCode, prefix);
    if (sequence == null) return max;
    return Math.max(max, sequence);
  }, 0);

  return formatPaperCode(prefix, maxSequence + 1);
}

export async function ensureSubmissionPaperCode(submissionId: string) {
  const submission = await db.query.submissions.findFirst({
    where: eq(submissions.id, submissionId),
    columns: { id: true, paperCode: true },
    with: { track: { columns: { name: true } } },
  });

  if (!submission) {
    throw new Error("Submission not found");
  }

  if (submission.paperCode) {
    return submission.paperCode;
  }

  const prefix = getTrackPaperCode(submission.track?.name);
  const paperCode = await getNextPaperCode(prefix);

  await db
    .update(submissions)
    .set({ paperCode, updatedAt: new Date() })
    .where(eq(submissions.id, submissionId));

  return paperCode;
}

export async function generateMissingPaperCodes() {
  const acceptedStatuses = ["ACCEPTED", "CAMERA_READY_PENDING", "CAMERA_READY_SUBMITTED"] as const;

  const rows = await db.query.submissions.findMany({
    columns: {
      id: true,
      paperCode: true,
      status: true,
    },
    with: {
      track: {
        columns: { name: true },
      },
    },
  });

  const targets = rows.filter(
    (row) =>
      acceptedStatuses.includes(row.status as (typeof acceptedStatuses)[number]) &&
      !row.paperCode
  );

  const allCodes = rows
    .map((row) => row.paperCode)
    .filter((value): value is string => Boolean(value));

  const nextByPrefix = new Map<string, number>();
  for (const code of allCodes) {
    const [prefix] = code.split("-");
    const sequence = parsePaperCodeSequence(code, prefix);
    if (sequence == null) continue;
    nextByPrefix.set(prefix, Math.max(nextByPrefix.get(prefix) ?? 0, sequence));
  }

  const updated: Array<{ id: string; paperCode: string }> = [];

  for (const target of targets) {
    const prefix = getTrackPaperCode(target.track?.name);
    const next = (nextByPrefix.get(prefix) ?? 0) + 1;
    nextByPrefix.set(prefix, next);
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

  if (!excludeSubmissionId) {
    return rows.length === 0;
  }

  return rows.every((row) => row.id === excludeSubmissionId);
}

export async function getTrackNameForSubmission(submissionId: string) {
  const row = await db
    .select({ trackName: tracks.name })
    .from(submissions)
    .leftJoin(tracks, eq(submissions.trackId, tracks.id))
    .where(eq(submissions.id, submissionId))
    .limit(1);

  return row[0]?.trackName ?? null;
}
