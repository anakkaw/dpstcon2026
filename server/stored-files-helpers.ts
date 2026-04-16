import { eq, and, desc } from "drizzle-orm";
import { db } from "@/server/db";
import { storedFiles } from "@/server/db/schema";

type FileKind = "MANUSCRIPT" | "SUPPLEMENTARY" | "CAMERA_READY";

/**
 * Check if a submission has at least one file of the given kind.
 */
export async function hasFileOfKind(submissionId: string, kind: FileKind): Promise<boolean> {
  const row = await db.query.storedFiles.findFirst({
    where: and(eq(storedFiles.submissionId, submissionId), eq(storedFiles.kind, kind)),
    columns: { id: true },
  });
  return !!row;
}

/**
 * Get the latest stored file key for a given kind (e.g. the latest MANUSCRIPT).
 * Returns null if no files exist.
 */
export async function getLatestFileKey(submissionId: string, kind: FileKind): Promise<string | null> {
  const row = await db.query.storedFiles.findFirst({
    where: and(eq(storedFiles.submissionId, submissionId), eq(storedFiles.kind, kind)),
    columns: { storedKey: true },
    orderBy: [desc(storedFiles.uploadedAt)],
  });
  return row?.storedKey ?? null;
}
