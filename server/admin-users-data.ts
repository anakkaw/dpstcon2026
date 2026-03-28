import { desc, inArray } from "drizzle-orm";
import { db } from "@/server/db";
import { user, userRoles } from "@/server/db/schema";

export interface AdminUserData {
  id: string;
  name: string;
  email: string;
  role: string;
  roles: string[];
  affiliation: string | null;
  bio: string | null;
  prefixTh: string | null;
  prefixEn: string | null;
  firstNameTh: string | null;
  lastNameTh: string | null;
  firstNameEn: string | null;
  lastNameEn: string | null;
  isActive: boolean;
  inviteExpiresAt: string | null;
  createdAt: string;
}

export interface RegistrationStats {
  total: number;
  active: number;
  pending: number;
  expired: number;
}

export async function getAdminUsersPageData() {
  const users = await db.select().from(user).orderBy(desc(user.createdAt));

  const userIds = users.map((entry) => entry.id);
  const allRoles = userIds.length > 0
    ? await db
        .select({
          userId: userRoles.userId,
          role: userRoles.role,
        })
        .from(userRoles)
        .where(inArray(userRoles.userId, userIds))
    : [];

  const rolesMap = new Map<string, string[]>();
  for (const roleRow of allRoles) {
    const existing = rolesMap.get(roleRow.userId) || [];
    existing.push(roleRow.role);
    rolesMap.set(roleRow.userId, existing);
  }

  const now = new Date();
  let active = 0;
  let pending = 0;
  let expired = 0;

  const normalizedUsers: AdminUserData[] = users.map((entry) => {
    if (entry.isActive) {
      active++;
    } else if (entry.inviteExpiresAt && new Date(entry.inviteExpiresAt) > now) {
      pending++;
    } else {
      expired++;
    }

    return {
      ...entry,
      roles: rolesMap.get(entry.id) || [entry.role],
      inviteExpiresAt: entry.inviteExpiresAt?.toISOString() ?? null,
      createdAt: entry.createdAt.toISOString(),
    };
  });

  return {
    users: normalizedUsers,
    registrationStats: {
      total: normalizedUsers.length,
      active,
      pending,
      expired,
    } satisfies RegistrationStats,
  };
}
