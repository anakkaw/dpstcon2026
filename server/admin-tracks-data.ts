import { db } from "@/server/db";
import { tracks, user } from "@/server/db/schema";
import { eq } from "drizzle-orm";

export interface AdminTrackData {
  id: string;
  name: string;
  description: string | null;
  headUserId: string | null;
  head: {
    id: string;
    name: string;
    email: string;
    prefixTh: string | null;
    firstNameTh: string | null;
    lastNameTh: string | null;
    prefixEn: string | null;
    firstNameEn: string | null;
    lastNameEn: string | null;
  } | null;
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
  const allTracks = await db.query.tracks.findMany({
    with: {
      head: {
        columns: {
          id: true,
          name: true,
          email: true,
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
    .from(user)
    .where(eq(user.isActive, true));

  return {
    tracks: allTracks as AdminTrackData[],
    users: allUsers as AdminTrackUser[],
  };
}
