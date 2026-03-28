import { eq } from "drizzle-orm";
import { hasRole } from "@/lib/permissions";
import type { ServerAuthUser } from "@/server/auth-helpers";
import { db } from "@/server/db";
import { trackMembers, tracks, user } from "@/server/db/schema";

export interface TrackData {
  id: string;
  name: string;
}

export interface MemberData {
  id: string;
  role: string;
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
    affiliation: string | null;
    prefixTh: string | null;
    firstNameTh: string | null;
    lastNameTh: string | null;
    prefixEn: string | null;
    firstNameEn: string | null;
    lastNameEn: string | null;
  };
}

export interface AvailableUser {
  id: string;
  name: string;
  email: string;
  role: string;
  affiliation: string | null;
  prefixTh: string | null;
  firstNameTh: string | null;
  lastNameTh: string | null;
  prefixEn: string | null;
  firstNameEn: string | null;
  lastNameEn: string | null;
}

async function getAccessibleTracks(currentUser: ServerAuthUser): Promise<TrackData[]> {
  if (hasRole(currentUser, "ADMIN")) {
    return db.select({ id: tracks.id, name: tracks.name }).from(tracks);
  }

  return db
    .select({ id: tracks.id, name: tracks.name })
    .from(tracks)
    .where(eq(tracks.headUserId, currentUser.id));
}

async function getTrackMembers(trackId: string): Promise<MemberData[]> {
  return db.query.trackMembers.findMany({
    where: eq(trackMembers.trackId, trackId),
    with: {
      user: {
        columns: {
          id: true,
          name: true,
          email: true,
          role: true,
          affiliation: true,
          prefixTh: true,
          firstNameTh: true,
          lastNameTh: true,
          prefixEn: true,
          firstNameEn: true,
          lastNameEn: true,
        },
      },
    },
  });
}

async function getAvailableUsers(trackId: string): Promise<AvailableUser[]> {
  const allUsers = await db
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      affiliation: user.affiliation,
      prefixTh: user.prefixTh,
      firstNameTh: user.firstNameTh,
      lastNameTh: user.lastNameTh,
      prefixEn: user.prefixEn,
      firstNameEn: user.firstNameEn,
      lastNameEn: user.lastNameEn,
    })
    .from(user);

  const existingMembers = await db
    .select({ userId: trackMembers.userId })
    .from(trackMembers)
    .where(eq(trackMembers.trackId, trackId));

  const memberIds = new Set(existingMembers.map((member) => member.userId));
  return allUsers.filter((entry) => !memberIds.has(entry.id));
}

export async function getTrackTeamPageData(currentUser: ServerAuthUser) {
  const tracks = await getAccessibleTracks(currentUser);
  const selectedTrackId = tracks[0]?.id ?? "";

  if (!selectedTrackId) {
    return {
      tracks,
      selectedTrackId,
      members: [] as MemberData[],
      available: [] as AvailableUser[],
    };
  }

  const [members, available] = await Promise.all([
    getTrackMembers(selectedTrackId),
    getAvailableUsers(selectedTrackId),
  ]);

  return {
    tracks,
    selectedTrackId,
    members,
    available,
  };
}
