import { and, count, eq, inArray } from "drizzle-orm";
import { db } from "@/server/db";
import { reviewAssignments, user, userRoles } from "@/server/db/schema";
import type { ServerAuthUser } from "@/server/auth-helpers";
import { getTrackRoleIds, hasRole } from "@/lib/permissions";

export interface ReviewerPoolEntry {
  id: string;
  name: string;
  email: string;
  affiliation: string | null;
  pendingLoad: number;
  activeLoad: number;
  completedLoad: number;
}

/**
 * Load the set of reviewers the current user is allowed to assign, with
 * their current workload and affiliation. Used by both `/submissions`
 * workbench and `/reviews` management view.
 *
 * - ADMIN sees every REVIEWER role.
 * - PROGRAM_CHAIR sees REVIEWERs scoped to the tracks they chair.
 * - Everyone else gets an empty array.
 */
export async function loadReviewerPool(
  currentUser: ServerAuthUser
): Promise<ReviewerPoolEntry[]> {
  if (!hasRole(currentUser, "ADMIN", "PROGRAM_CHAIR")) {
    return [];
  }

  let reviewerRoleRows: { userId: string }[] = [];
  if (hasRole(currentUser, "ADMIN")) {
    reviewerRoleRows = await db
      .select({ userId: userRoles.userId })
      .from(userRoles)
      .where(eq(userRoles.role, "REVIEWER"));
  } else {
    const chairedTrackIds = getTrackRoleIds(currentUser, "PROGRAM_CHAIR");
    if (chairedTrackIds.length === 0) return [];
    reviewerRoleRows = await db
      .select({ userId: userRoles.userId })
      .from(userRoles)
      .where(
        and(
          eq(userRoles.role, "REVIEWER"),
          inArray(userRoles.trackId, chairedTrackIds)
        )
      );
  }

  const reviewerIds = Array.from(
    new Set(reviewerRoleRows.map((row) => row.userId))
  );
  if (reviewerIds.length === 0) return [];

  const [users, loadRows] = await Promise.all([
    db
      .select({
        id: user.id,
        name: user.name,
        email: user.email,
        affiliation: user.affiliation,
      })
      .from(user)
      .where(inArray(user.id, reviewerIds)),
    db
      .select({
        reviewerId: reviewAssignments.reviewerId,
        status: reviewAssignments.status,
        total: count(),
      })
      .from(reviewAssignments)
      .where(inArray(reviewAssignments.reviewerId, reviewerIds))
      .groupBy(reviewAssignments.reviewerId, reviewAssignments.status),
  ]);

  const loadMap = new Map<
    string,
    { pending: number; active: number; completed: number }
  >();
  for (const row of loadRows) {
    const entry = loadMap.get(row.reviewerId) || {
      pending: 0,
      active: 0,
      completed: 0,
    };
    if (row.status === "PENDING") entry.pending += Number(row.total);
    else if (row.status === "ACCEPTED") entry.active += Number(row.total);
    else if (row.status === "COMPLETED") entry.completed += Number(row.total);
    loadMap.set(row.reviewerId, entry);
  }

  return users.map((u) => {
    const entry = loadMap.get(u.id);
    return {
      ...u,
      pendingLoad: entry?.pending ?? 0,
      activeLoad: entry?.active ?? 0,
      completedLoad: entry?.completed ?? 0,
    };
  });
}
