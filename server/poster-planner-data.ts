import { and, eq, inArray } from "drizzle-orm";
import { getTrackRoleIds, hasRole } from "@/lib/permissions";
import type { ServerAuthUser } from "@/server/auth-helpers";
import { db } from "@/server/db";
import {
  posterGroupJudges,
  posterPresentationGroups,
  presentationAssignments,
  tracks,
  user,
  userRoles,
} from "@/server/db/schema";

export interface PosterPlannerGroup {
  id: string;
  name: string;
  room: string | null;
  sortOrder: number;
  track: { id: string; name: string };
  judges: {
    id: string;
    judgeOrder: number;
    judge: { id: string; name: string };
  }[];
  slots: {
    id: string;
    startsAt: string;
    endsAt: string;
    status: string;
    sortOrder: number;
    judgeId: string | null;
  }[];
  members: {
    id: string;
    submissionId: string;
    paperCode: string | null;
    title: string;
    authorName: string;
  }[];
}

export interface PosterPlannerPaper {
  presentationId: string;
  submissionId: string;
  paperCode: string | null;
  title: string;
  track: { id: string; name: string } | null;
  author: { id: string; name: string };
}

async function getScopedTrackIds(currentUser: ServerAuthUser) {
  if (hasRole(currentUser, "ADMIN")) {
    return null;
  }

  const chaired = await db
    .select({ id: tracks.id })
    .from(tracks)
    .where(eq(tracks.headUserId, currentUser.id));

  const scoped = new Set([
    ...chaired.map((row) => row.id),
    ...getTrackRoleIds(currentUser, "PROGRAM_CHAIR"),
  ]);

  return scoped.size > 0 ? Array.from(scoped) : [];
}

export async function getPosterPlannerPageData(currentUser: ServerAuthUser) {
  const scopedTrackIds = await getScopedTrackIds(currentUser);

  const groupWhere =
    scopedTrackIds === null
      ? undefined
      : scopedTrackIds.length > 0
        ? inArray(posterPresentationGroups.trackId, scopedTrackIds)
        : eq(posterPresentationGroups.trackId, "00000000-0000-0000-0000-000000000000");

  const groups = await db.query.posterPresentationGroups.findMany({
    where: groupWhere,
    with: {
      track: { columns: { id: true, name: true } },
      judges: {
        columns: { id: true, judgeOrder: true },
        with: {
          judge: { columns: { id: true, name: true } },
        },
      },
      slots: {
        columns: {
          id: true,
          startsAt: true,
          endsAt: true,
          status: true,
          sortOrder: true,
          judgeId: true,
        },
      },
      members: {
        columns: { id: true, submissionId: true },
        with: {
          submission: {
            columns: { id: true, paperCode: true, title: true },
            with: {
              author: { columns: { id: true, name: true } },
            },
          },
        },
      },
    },
    orderBy: (table, { asc }) => [asc(table.sortOrder), asc(table.createdAt)],
  });

  let committeeUsers: Array<{ id: string; name: string; trackId: string | null }> = [];

  if (hasRole(currentUser, "ADMIN", "PROGRAM_CHAIR")) {
    const roleRows = await db
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
      );

    committeeUsers = roleRows;
  }

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

  const acceptedStatuses = new Set(["ACCEPTED", "CAMERA_READY_PENDING", "CAMERA_READY_SUBMITTED"]);
  const groupedSubmissionIds = new Set(
    groups.flatMap((group) => group.members.map((member) => member.submissionId))
  );

  const ungroupedPosters = posterRows
    .filter((row) => acceptedStatuses.has(row.submission.status))
    .filter((row) => {
      if (scopedTrackIds === null) return true;
      if (!row.submission.track?.id) return false;
      return scopedTrackIds.includes(row.submission.track.id);
    })
    .filter((row) => !groupedSubmissionIds.has(row.submissionId))
    .map(
      (row): PosterPlannerPaper => ({
        presentationId: row.id,
        submissionId: row.submissionId,
        paperCode: row.submission.paperCode,
        title: row.submission.title,
        track: row.submission.track,
        author: row.submission.author,
      })
    );

  const mappedGroups: PosterPlannerGroup[] = groups.map((group) => ({
    id: group.id,
    name: group.name,
    room: group.room,
    sortOrder: group.sortOrder,
    track: group.track,
    judges: [...group.judges].sort((a, b) => a.judgeOrder - b.judgeOrder),
    slots: [...group.slots]
      .sort((a, b) => a.sortOrder - b.sortOrder || a.startsAt.getTime() - b.startsAt.getTime())
      .map((slot) => ({
        id: slot.id,
        startsAt: slot.startsAt.toISOString(),
        endsAt: slot.endsAt.toISOString(),
        status: slot.status,
        sortOrder: slot.sortOrder,
        judgeId: slot.judgeId,
      })),
    members: group.members.map((member) => ({
      id: member.id,
      submissionId: member.submissionId,
      paperCode: member.submission.paperCode,
      title: member.submission.title,
      authorName: member.submission.author.name,
    })),
  }));

  return {
    groups: mappedGroups,
    ungroupedPosters,
    committeeUsers,
  };
}

export async function getPosterGroupsForAuthor(authorId: string) {
  const memberships = await db.query.posterGroupMembers.findMany({
    with: {
      group: {
        with: {
          track: { columns: { id: true, name: true } },
          judges: {
            columns: { id: true, judgeOrder: true },
            with: { judge: { columns: { id: true, name: true } } },
          },
          slots: {
            columns: {
              id: true,
              startsAt: true,
              endsAt: true,
              status: true,
              sortOrder: true,
              judgeId: true,
            },
          },
        },
      },
      submission: {
        columns: { id: true, title: true, paperCode: true },
        with: { author: { columns: { id: true, name: true } } },
      },
    },
  });

  return memberships
    .filter((membership) => membership.submission.author.id === authorId)
    .map((membership) => ({
      membershipId: membership.id,
      submissionId: membership.submission.id,
      title: membership.submission.title,
      paperCode: membership.submission.paperCode,
      groupId: membership.group.id,
      groupName: membership.group.name,
      room: membership.group.room,
      trackName: membership.group.track.name,
      judges: membership.group.judges
        .sort((a, b) => a.judgeOrder - b.judgeOrder)
        .map((judge) => judge.judge.name),
      slots: membership.group.slots
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((slot) => ({
          id: slot.id,
          startsAt: slot.startsAt.toISOString(),
          endsAt: slot.endsAt.toISOString(),
          status: slot.status,
          judgeId: slot.judgeId,
        })),
    }));
}

export async function getPosterGroupsForCommittee(committeeId: string) {
  const judgeRows = await db.query.posterGroupJudges.findMany({
    where: eq(posterGroupJudges.judgeId, committeeId),
    with: {
      group: {
        with: {
          track: { columns: { id: true, name: true } },
          members: {
            columns: { id: true, submissionId: true },
            with: {
              submission: {
                columns: { id: true, title: true, paperCode: true },
                with: { author: { columns: { id: true, name: true } } },
              },
            },
          },
          slots: {
            columns: {
              id: true,
              startsAt: true,
              endsAt: true,
              status: true,
              sortOrder: true,
              judgeId: true,
            },
          },
        },
      },
    },
  });

  return judgeRows.map((row) => ({
    groupId: row.group.id,
    groupName: row.group.name,
    room: row.group.room,
    trackName: row.group.track.name,
    judgeOrder: row.judgeOrder,
    members: row.group.members.map((member) => ({
      submissionId: member.submission.id,
      title: member.submission.title,
      paperCode: member.submission.paperCode,
      authorName: member.submission.author.name,
    })),
    slots: row.group.slots
      .filter((slot) => !slot.judgeId || slot.judgeId === committeeId)
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((slot) => ({
        id: slot.id,
        startsAt: slot.startsAt.toISOString(),
        endsAt: slot.endsAt.toISOString(),
        status: slot.status,
      })),
  }));
}
