import { and, eq, inArray, isNotNull } from "drizzle-orm";
import { getPrimaryRole } from "@/lib/permissions";
import { db } from "@/server/db";
import { tracks, user, userRoles } from "@/server/db/schema";

type ChairUser = {
  id: string;
  name: string;
  email: string;
  prefixTh: string | null;
  firstNameTh: string | null;
  lastNameTh: string | null;
  prefixEn: string | null;
  firstNameEn: string | null;
  lastNameEn: string | null;
};

export async function getProgramChairTrackIds(userId: string): Promise<string[]> {
  const rows = await db
    .select({ trackId: userRoles.trackId })
    .from(userRoles)
    .where(
      and(
        eq(userRoles.userId, userId),
        eq(userRoles.role, "PROGRAM_CHAIR"),
        isNotNull(userRoles.trackId)
      )
    );

  return rows.map((row) => row.trackId).filter((trackId): trackId is string => !!trackId);
}

export async function isProgramChairForTrack(userId: string, trackId: string): Promise<boolean> {
  const assignment = await db.query.userRoles.findFirst({
    where: and(
      eq(userRoles.userId, userId),
      eq(userRoles.role, "PROGRAM_CHAIR"),
      eq(userRoles.trackId, trackId)
    ),
    columns: { id: true },
  });

  return !!assignment;
}

export async function recalculatePrimaryRole(userId: string) {
  const allRoles = await db
    .select({ role: userRoles.role })
    .from(userRoles)
    .where(eq(userRoles.userId, userId));

  const primaryRole = getPrimaryRole(allRoles.map((r) => r.role));
  await db
    .update(user)
    .set({
      role: primaryRole as "ADMIN" | "PROGRAM_CHAIR" | "REVIEWER" | "COMMITTEE" | "AUTHOR",
      updatedAt: new Date(),
    })
    .where(eq(user.id, userId));
}

export async function syncTrackProgramChairs(trackId: string, chairUserIds: string[]) {
  const normalizedChairUserIds = Array.from(
    new Set(chairUserIds.map((userId) => userId.trim()).filter(Boolean))
  );

  const existing = await db
    .select({
      id: userRoles.id,
      userId: userRoles.userId,
    })
    .from(userRoles)
    .where(
      and(
        eq(userRoles.role, "PROGRAM_CHAIR"),
        eq(userRoles.trackId, trackId)
      )
    );

  const existingUserIds = new Set(existing.map((row) => row.userId));
  const incomingUserIds = new Set(normalizedChairUserIds);

  const toAdd = normalizedChairUserIds.filter((userId) => !existingUserIds.has(userId));
  const toRemove = existing
    .filter((row) => !incomingUserIds.has(row.userId))
    .map((row) => row.userId);

  if (toAdd.length > 0) {
    await db.insert(userRoles).values(
      toAdd.map((userId) => ({
        userId,
        role: "PROGRAM_CHAIR" as const,
        trackId,
      }))
    );
  }

  if (toRemove.length > 0) {
    await db
      .delete(userRoles)
      .where(
        and(
          eq(userRoles.role, "PROGRAM_CHAIR"),
          eq(userRoles.trackId, trackId),
          inArray(userRoles.userId, toRemove)
        )
      );
  }

  const affectedUserIds = Array.from(new Set([...toAdd, ...toRemove]));
  await Promise.all(affectedUserIds.map((userId) => recalculatePrimaryRole(userId)));

  const primaryChairUserId = normalizedChairUserIds[0] ?? null;
  await db
    .update(tracks)
    .set({ headUserId: primaryChairUserId })
    .where(eq(tracks.id, trackId));
}

export async function getTrackProgramChairs(trackIds?: string[]) {
  if (trackIds && trackIds.length === 0) {
    return new Map<string, ChairUser[]>();
  }

  const rows = await db
    .select({
      trackId: userRoles.trackId,
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
    .from(userRoles)
    .innerJoin(user, eq(userRoles.userId, user.id))
    .where(
      trackIds
        ? and(
            eq(userRoles.role, "PROGRAM_CHAIR"),
            inArray(userRoles.trackId, trackIds)
          )
        : eq(userRoles.role, "PROGRAM_CHAIR")
    );

  const chairsByTrackId = new Map<string, ChairUser[]>();

  for (const row of rows) {
    if (!row.trackId) continue;
    const chairs = chairsByTrackId.get(row.trackId) ?? [];
    chairs.push({
      id: row.id,
      name: row.name,
      email: row.email,
      prefixTh: row.prefixTh,
      firstNameTh: row.firstNameTh,
      lastNameTh: row.lastNameTh,
      prefixEn: row.prefixEn,
      firstNameEn: row.firstNameEn,
      lastNameEn: row.lastNameEn,
    });
    chairsByTrackId.set(row.trackId, chairs);
  }

  return chairsByTrackId;
}
