import "server-only";
import { and, asc, count, desc, eq, ilike, inArray, isNotNull, or } from "drizzle-orm";
import { db } from "@/server/db";
import {
  posterSlotJudges,
  presentationAssignments,
  storedFiles,
  submissions,
  templates,
  tracks,
  user,
} from "@/server/db/schema";
import {
  E_ABSTRACT_MIME,
  isPdfMime,
  isSubmissionFilePubliclyVisible,
} from "@/server/e-abstract-policy";
import {
  PUBLISHED_POSTER_SLOT_STATUSES,
  PUBLISHED_PRESENTATION_STATUSES,
} from "@/lib/presentation-status";
import {
  getPosterScheduleSortAt,
  sortPosterScheduleSlots,
} from "@/lib/poster-schedule";

export type PublicAbstractListItem = {
  id: string;
  paperCode: string | null;
  titleTh: string;
  titleEn: string | null;
  keywordsTh: string | null;
  keywordsEn: string | null;
  track: { id: string; name: string } | null;
  mainAuthorTh: string;
  mainAuthorEn: string | null;
};

export type PublicPresentationSlot = {
  id: string;
  type: "ORAL" | "POSTER";
  scheduledAt: string | null;
  room: string | null;
  duration: number | null;
  status: string;
  posterSlots: PublicPosterSlot[];
};

export type PublicPosterSlot = {
  id: string;
  startsAt: string;
  endsAt: string;
  room: string | null;
};

export type PublicAuthorEntry = {
  nameTh: string;
  nameEn: string | null;
  affiliation: string | null;
  isMain: boolean;
};

export type PublicAbstractDetail = {
  id: string;
  paperCode: string | null;
  titleTh: string;
  titleEn: string | null;
  abstractTh: string | null;
  abstractEn: string | null;
  keywordsTh: string | null;
  keywordsEn: string | null;
  track: { id: string; name: string } | null;
  authors: PublicAuthorEntry[];
  presentations: PublicPresentationSlot[];
  eAbstractFile: {
    id: string;
    originalName: string;
    mimeType: string;
  } | null;
};

export type PublicProgramItem = {
  presentationId: string;
  submissionId: string;
  paperCode: string | null;
  titleTh: string;
  titleEn: string | null;
  type: "ORAL" | "POSTER";
  scheduledAt: string | null;
  room: string | null;
  duration: number | null;
  posterSlots: PublicPosterSlot[];
  mainAuthorTh: string;
  mainAuthorEn: string | null;
  track: { id: string; name: string } | null;
};

export type PublicDocument = {
  id: string;
  slug: string | null;
  nameTh: string;
  nameEn: string | null;
  descriptionTh: string | null;
  descriptionEn: string | null;
  mimeType: string | null;
  orderIndex: number;
};

export type PublicTrack = { id: string; name: string };
const DEFAULT_PUBLIC_PAGE_SIZE = 100;
const MAX_PUBLIC_PAGE_SIZE = 200;

function normalizeLimit(limit: number | undefined) {
  if (!Number.isFinite(limit) || !limit) return DEFAULT_PUBLIC_PAGE_SIZE;
  return Math.min(Math.max(Math.trunc(limit), 1), MAX_PUBLIC_PAGE_SIZE);
}

function normalizeOffset(offset: number | undefined) {
  if (!Number.isFinite(offset) || !offset) return 0;
  return Math.max(Math.trunc(offset), 0);
}

function composeThaiName(u: {
  name: string;
  prefixTh: string | null;
  firstNameTh: string | null;
  lastNameTh: string | null;
}): string {
  if (!u.firstNameTh && !u.lastNameTh) return u.name;
  const prefix = u.prefixTh || "";
  return `${prefix}${u.firstNameTh || ""} ${u.lastNameTh || ""}`.trim();
}

function composeEnglishName(u: {
  prefixEn: string | null;
  firstNameEn: string | null;
  lastNameEn: string | null;
}): string | null {
  const parts = [u.prefixEn, u.firstNameEn, u.lastNameEn].filter(Boolean);
  return parts.length > 0 ? parts.join(" ") : null;
}

/**
 * List published abstracts with optional filtering.
 * Search matches title (TH/EN), keywords, and paper code.
 */
export async function getPublicAbstracts(opts: {
  trackId?: string;
  search?: string;
  limit?: number;
  offset?: number;
}): Promise<PublicAbstractListItem[]> {
  const conditions = [eq(submissions.isPublished, true)];
  if (opts.trackId) conditions.push(eq(submissions.trackId, opts.trackId));
  if (opts.search) {
    const term = `%${opts.search}%`;
    conditions.push(
      or(
        ilike(submissions.title, term),
        ilike(submissions.titleEn, term),
        ilike(submissions.keywords, term),
        ilike(submissions.keywordsEn, term),
        ilike(submissions.paperCode, term)
      )!
    );
  }

  const rows = await db
    .select({
      id: submissions.id,
      paperCode: submissions.paperCode,
      titleTh: submissions.title,
      titleEn: submissions.titleEn,
      keywordsTh: submissions.keywords,
      keywordsEn: submissions.keywordsEn,
      trackId: tracks.id,
      trackName: tracks.name,
      authorName: user.name,
      authorPrefixTh: user.prefixTh,
      authorFirstTh: user.firstNameTh,
      authorLastTh: user.lastNameTh,
      authorPrefixEn: user.prefixEn,
      authorFirstEn: user.firstNameEn,
      authorLastEn: user.lastNameEn,
    })
    .from(submissions)
    .leftJoin(tracks, eq(submissions.trackId, tracks.id))
    .innerJoin(user, eq(submissions.authorId, user.id))
    .where(and(...conditions))
    .orderBy(asc(submissions.paperCode), asc(submissions.title))
    .limit(normalizeLimit(opts.limit))
    .offset(normalizeOffset(opts.offset));

  return rows.map((row) => ({
    id: row.id,
    paperCode: row.paperCode,
    titleTh: row.titleTh,
    titleEn: row.titleEn,
    keywordsTh: row.keywordsTh,
    keywordsEn: row.keywordsEn,
    track: row.trackId ? { id: row.trackId, name: row.trackName! } : null,
    mainAuthorTh: composeThaiName({
      name: row.authorName,
      prefixTh: row.authorPrefixTh,
      firstNameTh: row.authorFirstTh,
      lastNameTh: row.authorLastTh,
    }),
    mainAuthorEn: composeEnglishName({
      prefixEn: row.authorPrefixEn,
      firstNameEn: row.authorFirstEn,
      lastNameEn: row.authorLastEn,
    }),
  }));
}

export async function getPublicAbstractCount(opts: {
  trackId?: string;
  search?: string;
} = {}): Promise<number> {
  const conditions = [eq(submissions.isPublished, true)];
  if (opts.trackId) conditions.push(eq(submissions.trackId, opts.trackId));
  if (opts.search) {
    const term = `%${opts.search}%`;
    conditions.push(
      or(
        ilike(submissions.title, term),
        ilike(submissions.titleEn, term),
        ilike(submissions.keywords, term),
        ilike(submissions.keywordsEn, term),
        ilike(submissions.paperCode, term)
      )!
    );
  }

  const [row] = await db
    .select({ total: count() })
    .from(submissions)
    .where(and(...conditions));

  return Number(row?.total ?? 0);
}

/**
 * Get a single published abstract by paper code, including authors,
 * presentation schedule, and the chosen e-abstract file.
 *
 * E-abstract resolution order (PDF only — only PDFs are publicly served):
 *   1. submissions.eAbstractFileId if set AND it points at a PDF
 *   2. Latest PDF MANUSCRIPT for this submission (author-submitted)
 *   3. null — admin must upload a PDF override before any document shows
 */
export async function getPublicAbstractByPaperCode(
  paperCode: string
): Promise<PublicAbstractDetail | null> {
  const row = await db.query.submissions.findFirst({
    where: and(
      eq(submissions.paperCode, paperCode),
      eq(submissions.isPublished, true)
    ),
    columns: {
      id: true,
      paperCode: true,
      title: true,
      titleEn: true,
      abstract: true,
      abstractEn: true,
      keywords: true,
      keywordsEn: true,
      eAbstractFileId: true,
    },
    with: {
      track: { columns: { id: true, name: true } },
      author: {
        columns: {
          name: true,
          affiliation: true,
          prefixTh: true,
          firstNameTh: true,
          lastNameTh: true,
          prefixEn: true,
          firstNameEn: true,
          lastNameEn: true,
        },
      },
      coAuthors: {
        columns: {
          name: true,
          affiliation: true,
          orderIndex: true,
        },
      },
    },
  });

  if (!row) return null;

  const authors: PublicAuthorEntry[] = [
    {
      nameTh: composeThaiName({
        name: row.author.name,
        prefixTh: row.author.prefixTh,
        firstNameTh: row.author.firstNameTh,
        lastNameTh: row.author.lastNameTh,
      }),
      nameEn: composeEnglishName({
        prefixEn: row.author.prefixEn,
        firstNameEn: row.author.firstNameEn,
        lastNameEn: row.author.lastNameEn,
      }),
      affiliation: row.author.affiliation ?? null,
      isMain: true,
    },
    ...row.coAuthors
      .slice()
      .sort((a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0))
      .map((ca) => ({
        nameTh: ca.name,
        nameEn: null,
        affiliation: ca.affiliation,
        isMain: false,
      })),
  ];

  const presRows = await db
    .select({
      id: presentationAssignments.id,
      type: presentationAssignments.type,
      scheduledAt: presentationAssignments.scheduledAt,
      room: presentationAssignments.room,
      duration: presentationAssignments.duration,
      status: presentationAssignments.status,
    })
    .from(presentationAssignments)
    .where(
      and(
        eq(presentationAssignments.submissionId, row.id),
        inArray(presentationAssignments.status, PUBLISHED_PRESENTATION_STATUSES)
      )
    )
    .orderBy(asc(presentationAssignments.scheduledAt));

  const posterSlotRows = presRows.some((p) => p.type === "POSTER")
    ? await db
        .select({
          id: posterSlotJudges.id,
          startsAt: posterSlotJudges.startsAt,
          endsAt: posterSlotJudges.endsAt,
        })
        .from(posterSlotJudges)
        .where(
          and(
            eq(posterSlotJudges.submissionId, row.id),
            inArray(posterSlotJudges.status, PUBLISHED_POSTER_SLOT_STATUSES)
          )
        )
        .orderBy(asc(posterSlotJudges.startsAt), asc(posterSlotJudges.endsAt))
    : [];

  const presentations: PublicPresentationSlot[] = presRows.map((p) => ({
    id: p.id,
    type: p.type,
    scheduledAt:
      p.type === "POSTER"
        ? getPosterScheduleSortAt(posterSlotRows, p.scheduledAt)?.toISOString() ?? null
        : p.scheduledAt?.toISOString() ?? null,
    room: p.room,
    duration: p.type === "POSTER" && posterSlotRows.length > 0 ? null : p.duration,
    status: p.status,
    posterSlots:
      p.type === "POSTER"
        ? sortPosterScheduleSlots(posterSlotRows).map((slot) => ({
            id: slot.id,
            startsAt: slot.startsAt.toISOString(),
            endsAt: slot.endsAt.toISOString(),
            room: p.room,
          }))
        : [],
  }));

  let eAbstractFile: PublicAbstractDetail["eAbstractFile"] = null;
  if (row.eAbstractFileId) {
    const [picked] = await db
      .select({
        id: storedFiles.id,
        originalName: storedFiles.originalName,
        mimeType: storedFiles.mimeType,
      })
      .from(storedFiles)
      .where(eq(storedFiles.id, row.eAbstractFileId))
      .limit(1);
    // Only honour the explicit pick if it's actually a PDF.
    if (picked && isPdfMime(picked.mimeType)) eAbstractFile = picked;
  }
  if (!eAbstractFile) {
    const [fallback] = await db
      .select({
        id: storedFiles.id,
        originalName: storedFiles.originalName,
        mimeType: storedFiles.mimeType,
      })
      .from(storedFiles)
      .where(
        and(
          eq(storedFiles.submissionId, row.id),
          eq(storedFiles.kind, "MANUSCRIPT"),
          eq(storedFiles.mimeType, E_ABSTRACT_MIME)
        )
      )
      .orderBy(desc(storedFiles.uploadedAt))
      .limit(1);
    if (fallback) eAbstractFile = fallback;
  }

  return {
    id: row.id,
    paperCode: row.paperCode,
    titleTh: row.title,
    titleEn: row.titleEn,
    abstractTh: row.abstract,
    abstractEn: row.abstractEn,
    keywordsTh: row.keywords,
    keywordsEn: row.keywordsEn,
    track: row.track ? { id: row.track.id, name: row.track.name } : null,
    authors,
    presentations,
    eAbstractFile,
  };
}

/**
 * Public program: scheduled presentations whose submission is published.
 */
export async function getPublicProgram(opts: {
  trackId?: string;
  type?: "ORAL" | "POSTER";
  limit?: number;
  offset?: number;
}): Promise<PublicProgramItem[]> {
  const conditions = [
    eq(submissions.isPublished, true),
    or(
      isNotNull(presentationAssignments.scheduledAt),
      eq(presentationAssignments.type, "POSTER")
    )!,
    inArray(presentationAssignments.status, PUBLISHED_PRESENTATION_STATUSES),
  ];
  if (opts.trackId) conditions.push(eq(submissions.trackId, opts.trackId));
  if (opts.type) conditions.push(eq(presentationAssignments.type, opts.type));

  const rows = await db
    .select({
      presentationId: presentationAssignments.id,
      submissionId: submissions.id,
      paperCode: submissions.paperCode,
      titleTh: submissions.title,
      titleEn: submissions.titleEn,
      type: presentationAssignments.type,
      scheduledAt: presentationAssignments.scheduledAt,
      room: presentationAssignments.room,
      duration: presentationAssignments.duration,
      trackId: tracks.id,
      trackName: tracks.name,
      authorName: user.name,
      authorPrefixTh: user.prefixTh,
      authorFirstTh: user.firstNameTh,
      authorLastTh: user.lastNameTh,
      authorPrefixEn: user.prefixEn,
      authorFirstEn: user.firstNameEn,
      authorLastEn: user.lastNameEn,
    })
    .from(presentationAssignments)
    .innerJoin(submissions, eq(presentationAssignments.submissionId, submissions.id))
    .innerJoin(user, eq(submissions.authorId, user.id))
    .leftJoin(tracks, eq(submissions.trackId, tracks.id))
    .where(and(...conditions))
    .orderBy(
      asc(presentationAssignments.scheduledAt),
      asc(presentationAssignments.room)
    )
    .limit(normalizeLimit(opts.limit))
    .offset(normalizeOffset(opts.offset));

  const posterSubmissionIds = rows
    .filter((row) => row.type === "POSTER")
    .map((row) => row.submissionId);
  const posterSlotRows =
    posterSubmissionIds.length > 0
      ? await db
          .select({
            id: posterSlotJudges.id,
            submissionId: posterSlotJudges.submissionId,
            startsAt: posterSlotJudges.startsAt,
            endsAt: posterSlotJudges.endsAt,
          })
          .from(posterSlotJudges)
          .where(
            and(
              inArray(posterSlotJudges.submissionId, posterSubmissionIds),
              inArray(posterSlotJudges.status, PUBLISHED_POSTER_SLOT_STATUSES)
            )
          )
          .orderBy(asc(posterSlotJudges.startsAt), asc(posterSlotJudges.endsAt))
      : [];

  const posterSlotsBySubmission = new Map<string, typeof posterSlotRows>();
  for (const slot of posterSlotRows) {
    const slots = posterSlotsBySubmission.get(slot.submissionId) ?? [];
    slots.push(slot);
    posterSlotsBySubmission.set(slot.submissionId, slots);
  }

  return rows.map((row) => {
    const rawPosterSlots =
      row.type === "POSTER" ? posterSlotsBySubmission.get(row.submissionId) ?? [] : [];
    const posterSlots = sortPosterScheduleSlots(rawPosterSlots).map((slot) => ({
      id: slot.id,
      startsAt: slot.startsAt.toISOString(),
      endsAt: slot.endsAt.toISOString(),
      room: row.room,
    }));
    const scheduledAt =
      row.type === "POSTER"
        ? getPosterScheduleSortAt(posterSlots, row.scheduledAt)?.toISOString() ?? null
        : row.scheduledAt?.toISOString() ?? null;

    return {
      presentationId: row.presentationId,
      submissionId: row.submissionId,
      paperCode: row.paperCode,
      titleTh: row.titleTh,
      titleEn: row.titleEn,
      type: row.type,
      scheduledAt,
      room: row.room,
      duration: row.type === "POSTER" && posterSlots.length > 0 ? null : row.duration,
      posterSlots,
      track: row.trackId ? { id: row.trackId, name: row.trackName! } : null,
      mainAuthorTh: composeThaiName({
        name: row.authorName,
        prefixTh: row.authorPrefixTh,
        firstNameTh: row.authorFirstTh,
        lastNameTh: row.authorLastTh,
      }),
      mainAuthorEn: composeEnglishName({
        prefixEn: row.authorPrefixEn,
        firstNameEn: row.authorFirstEn,
        lastNameEn: row.authorLastEn,
      }),
    };
  });
}

export async function getPublicProgramCount(opts: {
  trackId?: string;
  type?: "ORAL" | "POSTER";
} = {}): Promise<number> {
  const conditions = [
    eq(submissions.isPublished, true),
    isNotNull(presentationAssignments.scheduledAt),
    inArray(presentationAssignments.status, PUBLISHED_PRESENTATION_STATUSES),
  ];
  if (opts.trackId) conditions.push(eq(submissions.trackId, opts.trackId));
  if (opts.type) conditions.push(eq(presentationAssignments.type, opts.type));

  const [row] = await db
    .select({ total: count() })
    .from(presentationAssignments)
    .innerJoin(submissions, eq(presentationAssignments.submissionId, submissions.id))
    .where(and(...conditions));

  return Number(row?.total ?? 0);
}

function mapTemplate(row: {
  id: string;
  slug: string | null;
  name: string;
  nameEn: string | null;
  description: string | null;
  descriptionEn: string | null;
  mimeType: string | null;
  orderIndex: number;
}): PublicDocument {
  return {
    id: row.id,
    slug: row.slug,
    nameTh: row.name,
    nameEn: row.nameEn,
    descriptionTh: row.description,
    descriptionEn: row.descriptionEn,
    mimeType: row.mimeType,
    orderIndex: row.orderIndex,
  };
}

const PUBLIC_TEMPLATE_COLUMNS = {
  id: templates.id,
  slug: templates.slug,
  name: templates.name,
  nameEn: templates.nameEn,
  description: templates.description,
  descriptionEn: templates.descriptionEn,
  mimeType: templates.mimeType,
  orderIndex: templates.orderIndex,
};

export async function getPublicDocuments(): Promise<PublicDocument[]> {
  const rows = await db
    .select(PUBLIC_TEMPLATE_COLUMNS)
    .from(templates)
    .where(eq(templates.isPublic, true))
    .orderBy(asc(templates.orderIndex), asc(templates.name));
  return rows.map(mapTemplate);
}

export async function getWelcomeDocument(): Promise<PublicDocument | null> {
  const [row] = await db
    .select(PUBLIC_TEMPLATE_COLUMNS)
    .from(templates)
    .where(and(eq(templates.isPublic, true), eq(templates.slug, "welcome")))
    .limit(1);
  return row ? mapTemplate(row) : null;
}

/** Tracks that have at least one published submission — for filter dropdowns. */
export async function getPublicTracks(): Promise<PublicTrack[]> {
  const rows = await db
    .selectDistinct({ id: tracks.id, name: tracks.name })
    .from(tracks)
    .innerJoin(submissions, eq(submissions.trackId, tracks.id))
    .where(eq(submissions.isPublished, true))
    .orderBy(asc(tracks.name));
  return rows;
}

/**
 * Permission check for the public file proxy.
 * Returns the storedKey if the file is visible publicly, otherwise null.
 *
 * A file is public if either:
 *   - it belongs to a submission with isPublished = true AND its kind is one of
 *     MANUSCRIPT / CAMERA_READY / E_ABSTRACT (or it's the chosen eAbstractFileId), OR
 *   - it's referenced by a template row with isPublic = true.
 */
export async function getPublicFileKey(
  storedFileId: string
): Promise<{ storedKey: string; mimeType: string; originalName: string } | null> {
  const [file] = await db
    .select({
      id: storedFiles.id,
      storedKey: storedFiles.storedKey,
      mimeType: storedFiles.mimeType,
      originalName: storedFiles.originalName,
      kind: storedFiles.kind,
      submissionId: storedFiles.submissionId,
    })
    .from(storedFiles)
    .where(eq(storedFiles.id, storedFileId))
    .limit(1);

  if (!file) return null;

  if (file.submissionId) {
    const [sub] = await db
      .select({
        isPublished: submissions.isPublished,
        eAbstractFileId: submissions.eAbstractFileId,
      })
      .from(submissions)
      .where(eq(submissions.id, file.submissionId))
      .limit(1);
    if (
      sub &&
      isSubmissionFilePubliclyVisible({
        fileId: file.id,
        fileKind: file.kind,
        fileMimeType: file.mimeType,
        submissionPublished: sub.isPublished,
        submissionEAbstractFileId: sub.eAbstractFileId,
      })
    ) {
      return {
        storedKey: file.storedKey,
        mimeType: file.mimeType,
        originalName: file.originalName,
      };
    }
  }

  // Otherwise check if it's referenced by a public template.
  const [tpl] = await db
    .select({ id: templates.id })
    .from(templates)
    .where(and(eq(templates.fileKey, file.storedKey), eq(templates.isPublic, true)))
    .limit(1);
  if (tpl) {
    return {
      storedKey: file.storedKey,
      mimeType: file.mimeType,
      originalName: file.originalName,
    };
  }

  return null;
}

/**
 * Public file lookup by template id. Used for /api/public/documents/:id/file
 * since templates store files via `fileKey` (not the `stored_files` table).
 */
export async function getPublicTemplateFile(
  templateId: string
): Promise<{
  storedKey: string;
  mimeType: string;
  originalName: string;
} | null> {
  const [row] = await db
    .select({
      id: templates.id,
      name: templates.name,
      fileKey: templates.fileKey,
      mimeType: templates.mimeType,
      isPublic: templates.isPublic,
    })
    .from(templates)
    .where(eq(templates.id, templateId))
    .limit(1);
  if (!row || !row.isPublic) return null;
  // Derive a friendly download name from the template name + file extension.
  const ext = row.fileKey.includes(".")
    ? row.fileKey.slice(row.fileKey.lastIndexOf("."))
    : "";
  return {
    storedKey: row.fileKey,
    mimeType: row.mimeType ?? "application/octet-stream",
    originalName: `${row.name}${ext}`,
  };
}
