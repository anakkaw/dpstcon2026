import { db } from "@/server/db";
import { tracks, user } from "@/server/db/schema";
import { getTrackProgramChairs } from "@/server/track-chairs";

export interface AdminTrackChair {
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

export interface AdminTrackData {
  id: string;
  name: string;
  description: string | null;
  chairUserIds: string[];
  chairs: AdminTrackChair[];
}

export interface AdminTrackUser {
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

export async function getAdminTracksPageData() {
  const allTracks = await db.select().from(tracks);
  const chairsByTrackId = await getTrackProgramChairs(allTracks.map((track) => track.id));

  const allUsers = await db
    .select({
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
    .from(user);

  return {
    tracks: allTracks.map((track) => {
      const chairs = chairsByTrackId.get(track.id) ?? [];
      return {
        ...track,
        chairUserIds: chairs.map((chair) => chair.id),
        chairs,
      };
    }) as AdminTrackData[],
    users: allUsers as AdminTrackUser[],
  };
}
