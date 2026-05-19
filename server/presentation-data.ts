import { and, asc, desc, eq, inArray, isNull, or } from "drizzle-orm";
import { hasRole } from "@/lib/permissions";
import type { ServerAuthUser } from "@/server/auth-helpers";
import { db } from "@/server/db";
import {
  posterSlotJudges,
  presentationAssignments,
  presentationCommitteeAssignments,
  submissions,
  user,
  userRoles,
} from "@/server/db/schema";
import {
  getPresentationRubric,
  type PresentationRubricCriterion,
} from "@/server/presentation-rubrics";
import {
  PUBLISHED_POSTER_SLOT_STATUSES,
  PUBLISHED_PRESENTATION_STATUSES,
} from "@/lib/presentation-status";
import {
  getPosterScheduleSortAt,
  sortPosterScheduleSlots,
} from "@/lib/poster-schedule";

export type PresentationType = "ORAL" | "POSTER";

export interface PresentationData {
  id: string;
  type: string;
  status: string;
  scheduledAt: string | null;
  room: string | null;
  duration: number | null;
  posterSlots: Array<{
    id: string;
    startsAt: string;
    endsAt: string;
  }>;
  submissionId: string;
  submission: {
    id: string;
    paperCode: string | null;
    title: string;
    author: {
      id: string;
      name: string;
      prefixTh: string | null;
      firstNameTh: string | null;
      lastNameTh: string | null;
      prefixEn: string | null;
      firstNameEn: string | null;
      lastNameEn: string | null;
    };
    track: { id: string; name: string } | null;
  };
}

export type CriterionData = PresentationRubricCriterion;

export interface CommitteeUser {
  id: string;
  name: string;
  email: string;
  prefixTh: string | null;
  firstNameTh: string | null;
  lastNameTh: string | null;
  prefixEn: string | null;
  firstNameEn: string | null;
  lastNameEn: string | null;
}

async function getManagedPresentationIds(currentUser: ServerAuthUser, type: PresentationType) {
  const presentationIds = new Set<string>();

  const chairedTrackIds = currentUser.roleAssignments
    .filter((assignment) => assignment.role === "PROGRAM_CHAIR" && assignment.trackId)
    .map((assignment) => assignment.trackId as string);

  if (chairedTrackIds.length > 0) {
    const managedRows = await db
      .select({ id: presentationAssignments.id })
      .from(presentationAssignments)
      .innerJoin(submissions, eq(presentationAssignments.submissionId, submissions.id))
      .where(and(inArray(submissions.trackId, chairedTrackIds), eq(presentationAssignments.type, type)));

    managedRows.forEach((row) => presentationIds.add(row.id));
  }

  if (hasRole(currentUser, "COMMITTEE")) {
    const assignedRows = await db
      .select({ id: presentationAssignments.id })
      .from(presentationCommitteeAssignments)
      .innerJoin(presentationAssignments, eq(presentationCommitteeAssignments.presentationId, presentationAssignments.id))
      .where(
        and(
          eq(presentationCommitteeAssignments.judgeId, currentUser.id),
          eq(presentationAssignments.type, type),
          inArray(presentationAssignments.status, PUBLISHED_PRESENTATION_STATUSES)
        )
      );

    assignedRows.forEach((row) => presentationIds.add(row.id));

    if (type === "POSTER") {
      const posterRows = await db
        .select({ id: presentationAssignments.id })
        .from(posterSlotJudges)
        .innerJoin(
          presentationAssignments,
          and(
            eq(posterSlotJudges.submissionId, presentationAssignments.submissionId),
            eq(presentationAssignments.type, "POSTER")
          )
        )
        .where(
          and(
            eq(posterSlotJudges.judgeId, currentUser.id),
            inArray(posterSlotJudges.status, PUBLISHED_POSTER_SLOT_STATUSES),
            inArray(presentationAssignments.status, PUBLISHED_PRESENTATION_STATUSES)
          )
        );
      posterRows.forEach((row) => presentationIds.add(row.id));
    }
  }

  if (hasRole(currentUser, "AUTHOR")) {
    const ownRows = await db
      .select({ id: presentationAssignments.id })
      .from(presentationAssignments)
      .innerJoin(submissions, eq(presentationAssignments.submissionId, submissions.id))
      .where(
        and(
          eq(submissions.authorId, currentUser.id),
          eq(presentationAssignments.type, type),
          inArray(presentationAssignments.status, PUBLISHED_PRESENTATION_STATUSES)
        )
      );

    ownRows.forEach((row) => presentationIds.add(row.id));
  }

  return Array.from(presentationIds);
}

async function getPresentations(currentUser: ServerAuthUser, type: PresentationType): Promise<PresentationData[]> {
  let whereClause = eq(presentationAssignments.type, type);

  if (!hasRole(currentUser, "ADMIN")) {
    const managedPresentationIds = await getManagedPresentationIds(currentUser, type);

    if (managedPresentationIds.length === 0) {
      return [];
    }

    whereClause = inArray(presentationAssignments.id, managedPresentationIds);
  }

  const rows = await db.query.presentationAssignments.findMany({
    where: whereClause,
    with: {
      submission: {
        columns: { id: true, paperCode: true, title: true },
        with: {
          author: {
            columns: {
              id: true,
              name: true,
              prefixTh: true,
              firstNameTh: true,
              lastNameTh: true,
              prefixEn: true,
              firstNameEn: true,
              lastNameEn: true,
            },
          },
          track: { columns: { id: true, name: true } },
        },
      },
    },
    orderBy: [desc(presentationAssignments.scheduledAt)],
  });

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
          .where(inArray(posterSlotJudges.submissionId, posterSubmissionIds))
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
    }));

    return {
      ...row,
      scheduledAt:
        row.type === "POSTER"
          ? getPosterScheduleSortAt(posterSlots, row.scheduledAt)?.toISOString() ?? null
          : row.scheduledAt?.toISOString() ?? null,
      duration: row.type === "POSTER" && posterSlots.length > 0 ? null : row.duration,
      posterSlots,
    };
  });
}

async function getCommitteeUsers(currentUser: ServerAuthUser): Promise<CommitteeUser[]> {
  if (!hasRole(currentUser, "ADMIN", "PROGRAM_CHAIR")) {
    return [];
  }

  const chairedTrackIds = currentUser.roleAssignments
    .filter(
      (assignment) => assignment.role === "PROGRAM_CHAIR" && assignment.trackId
    )
    .map((assignment) => assignment.trackId as string);

  if (!hasRole(currentUser, "ADMIN") && chairedTrackIds.length === 0) {
    return [];
  }

  const whereClause = hasRole(currentUser, "ADMIN")
    ? eq(userRoles.role, "COMMITTEE")
    : and(
        eq(userRoles.role, "COMMITTEE"),
        or(isNull(userRoles.trackId), inArray(userRoles.trackId, chairedTrackIds))
      );

  return db
    .selectDistinct({
      id: user.id,
      name: user.name,
      email: user.email,
      prefixTh: user.prefixTh,
      firstNameTh: user.firstNameTh,
      lastNameTh: user.lastNameTh,
      prefixEn: user.prefixEn,
      firstNameEn: user.firstNameEn,
      lastNameEn: user.lastNameEn,
    })
    .from(user)
    .innerJoin(userRoles, eq(user.id, userRoles.userId))
    .where(whereClause);
}

export async function getPresentationPageData(currentUser: ServerAuthUser, type: PresentationType) {
  const [presentations, criteria, committeeUsers] = await Promise.all([
    getPresentations(currentUser, type),
    getPresentationRubric(type),
    getCommitteeUsers(currentUser),
  ]);

  return {
    presentations,
    criteria,
    committeeUsers,
  };
}
