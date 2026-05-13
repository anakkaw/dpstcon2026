import "server-only";
import { asc, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/server/db";
import {
  storedFiles,
  submissions,
  tracks,
  user as userTable,
} from "@/server/db/schema";
import {
  isEAbstractEligibleKind,
  type EAbstractEligibleKind,
} from "@/server/e-abstract-policy";

export type AdminPublicationFile = {
  id: string;
  originalName: string;
  mimeType: string;
  size: number;
  /** Kinds eligible to serve as the public e-abstract. */
  kind: EAbstractEligibleKind;
  uploadedAt: string;
};

export type AdminPublicationRow = {
  id: string;
  paperCode: string | null;
  title: string;
  titleEn: string | null;
  authorName: string;
  authorEmail: string;
  trackName: string | null;
  isPublished: boolean;
  eAbstractFileId: string | null;
  files: AdminPublicationFile[];
};

/**
 * Returns all accepted submissions plus the files admins can pick as
 * the public e-abstract (manuscripts, camera-ready, and prior overrides).
 */
export async function getAdminPublicationsData(): Promise<AdminPublicationRow[]> {
  const rows = await db
    .select({
      id: submissions.id,
      paperCode: submissions.paperCode,
      title: submissions.title,
      titleEn: submissions.titleEn,
      isPublished: submissions.isPublished,
      eAbstractFileId: submissions.eAbstractFileId,
      authorName: userTable.name,
      authorEmail: userTable.email,
      trackName: tracks.name,
    })
    .from(submissions)
    .innerJoin(userTable, eq(submissions.authorId, userTable.id))
    .leftJoin(tracks, eq(submissions.trackId, tracks.id))
    .where(eq(submissions.status, "ACCEPTED"))
    .orderBy(asc(submissions.paperCode), asc(submissions.title));

  if (rows.length === 0) return [];

  const submissionIds = rows.map((r) => r.id);
  const allFiles = await db
    .select({
      id: storedFiles.id,
      submissionId: storedFiles.submissionId,
      originalName: storedFiles.originalName,
      mimeType: storedFiles.mimeType,
      size: storedFiles.size,
      kind: storedFiles.kind,
      uploadedAt: storedFiles.uploadedAt,
    })
    .from(storedFiles)
    .where(inArray(storedFiles.submissionId, submissionIds))
    .orderBy(desc(storedFiles.uploadedAt));

  const filesBySubmission = new Map<string, AdminPublicationFile[]>();
  for (const f of allFiles) {
    if (!f.submissionId) continue;
    if (!isEAbstractEligibleKind(f.kind)) continue;
    const list = filesBySubmission.get(f.submissionId) ?? [];
    list.push({
      id: f.id,
      originalName: f.originalName,
      mimeType: f.mimeType,
      size: f.size,
      kind: f.kind,
      uploadedAt: f.uploadedAt.toISOString(),
    });
    filesBySubmission.set(f.submissionId, list);
  }

  return rows.map((r) => ({
    id: r.id,
    paperCode: r.paperCode,
    title: r.title,
    titleEn: r.titleEn,
    authorName: r.authorName,
    authorEmail: r.authorEmail,
    trackName: r.trackName,
    isPublished: r.isPublished,
    eAbstractFileId: r.eAbstractFileId,
    files: filesBySubmission.get(r.id) ?? [],
  }));
}
