import { and, eq, inArray } from "drizzle-orm";
import { getTrackRoleIds, hasRole } from "@/lib/permissions";
import type { ServerAuthUser } from "@/server/auth-helpers";
import { db } from "@/server/db";
import {
  posterSlotJudges,
  presentationAssignments,
  settings,
  user,
  userRoles,
} from "@/server/db/schema";

const POSTER_SESSION_ROOM_KEY = "posterSessionRoom";
const POSTER_SESSION_SLOTS_KEY = "posterSessionSlotTemplates";

export interface PosterSessionSlotTemplate {
  id: string;
  startsAt: string;
  endsAt: string;
}

export interface PosterPlannerSessionSettings {
  room: string;
  slotTemplates: PosterSessionSlotTemplate[];
}

export interface PosterSlotJudge {
  id: string;
  judgeId: string;
  judgeName: string;
  startsAt: string;
  endsAt: string;
  status: string;
}

export interface PosterPlannerSubmission {
  submissionId: string;
  paperCode: string | null;
  title: string;
  track: { id: string; name: string } | null;
  author: { id: string; name: string };
  slotJudges: PosterSlotJudge[];
}

function createSlotTemplateId(startsAt: string, endsAt: string) {
  return `${startsAt}__${endsAt}`;
}

export async function getPosterSessionSettings(): Promise<PosterPlannerSessionSettings> {
  const rows = await db
    .select({
      key: settings.key,
      value: settings.value,
    })
    .from(settings)
    .where(inArray(settings.key, [POSTER_SESSION_ROOM_KEY, POSTER_SESSION_SLOTS_KEY]));

  const roomRow = rows.find((row) => row.key === POSTER_SESSION_ROOM_KEY);
  const slotRow = rows.find((row) => row.key === POSTER_SESSION_SLOTS_KEY);

  const room = typeof roomRow?.value === "string" ? roomRow.value : "";
  const slotTemplates = Array.isArray(slotRow?.value)
    ? slotRow.value
        .map((item) => {
          if (
            !item ||
            typeof item !== "object" ||
            typeof item.startsAt !== "string" ||
            typeof item.endsAt !== "string"
          ) {
            return null;
          }

          const startsAt = new Date(item.startsAt);
          const endsAt = new Date(item.endsAt);
          if (
            Number.isNaN(startsAt.getTime()) ||
            Number.isNaN(endsAt.getTime()) ||
            startsAt >= endsAt
          ) {
            return null;
          }

          return {
            id: createSlotTemplateId(item.startsAt, item.endsAt),
            startsAt: item.startsAt,
            endsAt: item.endsAt,
          };
        })
        .filter((item): item is PosterSessionSlotTemplate => item !== null)
        .sort(
          (a, b) =>
            new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime() ||
            new Date(a.endsAt).getTime() - new Date(b.endsAt).getTime()
        )
    : [];

  return { room, slotTemplates };
}

async function getScopedTrackIds(currentUser: ServerAuthUser) {
  if (hasRole(currentUser, "ADMIN")) {
    return null;
  }

  const scoped = new Set(getTrackRoleIds(currentUser, "PROGRAM_CHAIR"));
  return scoped.size > 0 ? Array.from(scoped) : [];
}

export async function getPosterPlannerPageData(currentUser: ServerAuthUser) {
  // Run independent queries in parallel
  const [scopedTrackIds, sessionSettings] = await Promise.all([
    getScopedTrackIds(currentUser),
    getPosterSessionSettings(),
  ]);

  // Build WHERE conditions to push filters into the DB query
  const acceptedStatuses = ["ACCEPTED", "CAMERA_READY_PENDING", "CAMERA_READY_SUBMITTED"] as const;

  const posterRows = await db.query.presentationAssignments.findMany({
    where: eq(presentationAssignments.type, "POSTER"),
    with: {
      submission: {
        columns: { id: true, title: true, paperCode: true, status: true },
        with: {
          author: { columns: { id: true, name: true } },
          track: { columns: { id: true, name: true } },
        },
      },
    },
    orderBy: (table, { asc }) => [asc(table.submissionId)],
  });

  // Filter in-memory (Drizzle relational queries don't support nested WHERE on related table)
  const filteredPosters = posterRows.filter((row) => {
    if (!(acceptedStatuses as readonly string[]).includes(row.submission.status)) return false;
    if (scopedTrackIds === null) return true;
    if (!row.submission.track?.id) return false;
    return scopedTrackIds.includes(row.submission.track.id);
  });

  // Run slot-judge and committee-user queries in parallel
  const submissionIds = filteredPosters.map((p) => p.submissionId);

  const slotJudgePromise = submissionIds.length > 0
    ? db.query.posterSlotJudges.findMany({
        where: inArray(posterSlotJudges.submissionId, submissionIds),
        with: {
          judge: { columns: { id: true, name: true } },
        },
      })
    : Promise.resolve([]);

  const committeePromise = hasRole(currentUser, "ADMIN", "PROGRAM_CHAIR")
    ? db
        .select({
          id: user.id,
          name: user.name,
          trackId: userRoles.trackId,
        })
        .from(user)
        .innerJoin(userRoles, eq(user.id, userRoles.userId))
        .where(
          scopedTrackIds === null
            ? eq(userRoles.role, "COMMITTEE")
            : and(
                eq(userRoles.role, "COMMITTEE"),
                scopedTrackIds.length > 0
                  ? inArray(userRoles.trackId, scopedTrackIds)
                  : eq(userRoles.trackId, "00000000-0000-0000-0000-000000000000")
              )
        )
    : Promise.resolve([]);

  const [slotJudgeRows, committeeUsers] = await Promise.all([slotJudgePromise, committeePromise]);

  // Group slot judges by submission
  const slotJudgesBySubmission = new Map<string, PosterSlotJudge[]>();
  for (const sj of slotJudgeRows) {
    const list = slotJudgesBySubmission.get(sj.submissionId) || [];
    list.push({
      id: sj.id,
      judgeId: sj.judgeId,
      judgeName: sj.judge.name,
      startsAt: sj.startsAt.toISOString(),
      endsAt: sj.endsAt.toISOString(),
      status: sj.status,
    });
    slotJudgesBySubmission.set(sj.submissionId, list);
  }

  const posterSubmissions: PosterPlannerSubmission[] = filteredPosters.map((row) => ({
    submissionId: row.submissionId,
    paperCode: row.submission.paperCode,
    title: row.submission.title,
    track: row.submission.track,
    author: row.submission.author,
    slotJudges: slotJudgesBySubmission.get(row.submissionId) || [],
  }));

  return {
    sessionSettings,
    posterSubmissions,
    committeeUsers,
  };
}

export interface AuthorPosterSlot {
  submissionId: string;
  title: string;
  paperCode: string | null;
  room: string;
  trackName: string;
  slotJudges: {
    judgeName: string;
    startsAt: string;
    endsAt: string;
    status: string;
  }[];
}

export async function getPosterSlotsForAuthor(
  authorId: string
): Promise<AuthorPosterSlot[]> {
  const sessionSettings = await getPosterSessionSettings();

  const posterRows = await db.query.presentationAssignments.findMany({
    where: eq(presentationAssignments.type, "POSTER"),
    with: {
      submission: {
        columns: { id: true, title: true, paperCode: true },
        with: {
          author: { columns: { id: true } },
          track: { columns: { id: true, name: true } },
          posterSlotJudges: {
            with: { judge: { columns: { name: true } } },
          },
        },
      },
    },
  });

  return posterRows
    .filter((row) => row.submission.author.id === authorId)
    .map((row) => ({
      submissionId: row.submissionId,
      title: row.submission.title,
      paperCode: row.submission.paperCode,
      room: sessionSettings.room || "",
      trackName: row.submission.track?.name || "",
      slotJudges: row.submission.posterSlotJudges.map((sj) => ({
        judgeName: sj.judge.name,
        startsAt: sj.startsAt.toISOString(),
        endsAt: sj.endsAt.toISOString(),
        status: sj.status,
      })),
    }));
}

export interface CommitteePosterSlot {
  slotId: string;
  submissionId: string;
  title: string;
  paperCode: string | null;
  authorName: string;
  room: string;
  trackName: string;
  startsAt: string;
  endsAt: string;
  status: string;
}

export async function getPosterSlotsForCommittee(
  committeeId: string
): Promise<CommitteePosterSlot[]> {
  const sessionSettings = await getPosterSessionSettings();

  const slotRows = await db.query.posterSlotJudges.findMany({
    where: eq(posterSlotJudges.judgeId, committeeId),
    with: {
      submission: {
        columns: { id: true, title: true, paperCode: true },
        with: {
          author: { columns: { name: true } },
          track: { columns: { name: true } },
        },
      },
    },
  });

  return slotRows.map((row) => ({
    slotId: row.id,
    submissionId: row.submissionId,
    title: row.submission.title,
    paperCode: row.submission.paperCode,
    authorName: row.submission.author.name,
    room: sessionSettings.room || "",
    trackName: row.submission.track?.name || "",
    startsAt: row.startsAt.toISOString(),
    endsAt: row.endsAt.toISOString(),
    status: row.status,
  }));
}
