import { and, desc, eq, inArray } from "drizzle-orm";
import { hasRole } from "@/lib/permissions";
import type { ServerAuthUser } from "@/server/auth-helpers";
import { db } from "@/server/db";
import {
  presentationAssignments,
  presentationCommitteeAssignments,
  presentationCriteria,
  submissions,
  user,
  userRoles,
} from "@/server/db/schema";

export type PresentationType = "ORAL" | "POSTER";

export interface PresentationData {
  id: string;
  type: string;
  status: string;
  scheduledAt: string | null;
  room: string | null;
  duration: number | null;
  submissionId: string;
  submission: {
    id: string;
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

export interface CriterionData {
  id: string;
  name: string;
  description: string | null;
  maxScore: number;
  weight: number;
}

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
      .where(and(eq(presentationCommitteeAssignments.judgeId, currentUser.id), eq(presentationAssignments.type, type)));

    assignedRows.forEach((row) => presentationIds.add(row.id));
  }

  if (hasRole(currentUser, "AUTHOR")) {
    const ownRows = await db
      .select({ id: presentationAssignments.id })
      .from(presentationAssignments)
      .innerJoin(submissions, eq(presentationAssignments.submissionId, submissions.id))
      .where(and(eq(submissions.authorId, currentUser.id), eq(presentationAssignments.type, type)));

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
        columns: { id: true, title: true },
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

  return rows.map((row) => ({
    ...row,
    scheduledAt: row.scheduledAt?.toISOString() ?? null,
  }));
}

async function getCommitteeUsers(currentUser: ServerAuthUser): Promise<CommitteeUser[]> {
  if (!hasRole(currentUser, "ADMIN")) {
    return [];
  }

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
    .where(eq(userRoles.role, "COMMITTEE"));
}

export async function getPresentationPageData(currentUser: ServerAuthUser, type: PresentationType) {
  const [presentations, criteria, committeeUsers] = await Promise.all([
    getPresentations(currentUser, type),
    db.select().from(presentationCriteria),
    getCommitteeUsers(currentUser),
  ]);

  return {
    presentations,
    criteria: criteria as CriterionData[],
    committeeUsers,
  };
}
