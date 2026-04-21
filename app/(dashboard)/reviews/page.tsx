import { redirect } from "next/navigation";
import { eq, inArray, and, count } from "drizzle-orm";
import { getTrackRoleIds, hasRole } from "@/lib/permissions";
import { getServerAuthContext } from "@/server/auth-helpers";
import { db } from "@/server/db";
import { reviewAssignments, submissions, user, userRoles } from "@/server/db/schema";
import { ReviewsPageClient, type AssignmentData, type ReviewerUser } from "./reviews-page-client";

async function loadInitialAssignments(
  currentUser: NonNullable<Awaited<ReturnType<typeof getServerAuthContext>>>["user"]
): Promise<AssignmentData[]> {
  const isAdmin = hasRole(currentUser, "ADMIN");

  let whereClause = undefined;
  if (!isAdmin) {
    const assignmentIds = new Set<string>();

    if (hasRole(currentUser, "REVIEWER")) {
      const ownAssignments = await db
        .select({ id: reviewAssignments.id })
        .from(reviewAssignments)
        .where(eq(reviewAssignments.reviewerId, currentUser.id));

      ownAssignments.forEach((assignment) => assignmentIds.add(assignment.id));
    }

    const chairedTrackIds = getTrackRoleIds(currentUser, "PROGRAM_CHAIR");

    if (chairedTrackIds.length > 0) {
      const managedAssignments = await db
        .select({ id: reviewAssignments.id })
        .from(reviewAssignments)
        .innerJoin(
          submissions,
          eq(reviewAssignments.submissionId, submissions.id)
        )
        .where(inArray(submissions.trackId, chairedTrackIds));

      managedAssignments.forEach((assignment) => assignmentIds.add(assignment.id));
    }

    if (assignmentIds.size === 0) {
      return [];
    }

    whereClause = inArray(reviewAssignments.id, Array.from(assignmentIds));
  }

  const assignments = await db.query.reviewAssignments.findMany({
    where: whereClause,
    with: {
      submission: {
        columns: { id: true, title: true, abstract: true, status: true },
        with: {
          author: { columns: { id: true, name: true } },
          track: { columns: { id: true, name: true } },
        },
      },
      reviewer: { columns: { id: true, name: true } },
    },
  });

  return assignments.map((assignment) => ({
    ...assignment,
    assignedAt: assignment.assignedAt.toISOString(),
    dueDate: assignment.dueDate?.toISOString() || null,
  }));
}

async function loadInitialReviewerUsers(
  currentUser: NonNullable<Awaited<ReturnType<typeof getServerAuthContext>>>["user"]
): Promise<ReviewerUser[]> {
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

    if (chairedTrackIds.length === 0) {
      return [];
    }

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

  const reviewerIds = Array.from(new Set(reviewerRoleRows.map((row) => row.userId)));
  if (reviewerIds.length === 0) {
    return [];
  }

  const [users, loadRows] = await Promise.all([
    db
      .select({ id: user.id, name: user.name, email: user.email })
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

  const loadMap = new Map<string, { active: number; completed: number }>();
  for (const row of loadRows) {
    const entry = loadMap.get(row.reviewerId) || { active: 0, completed: 0 };
    if (row.status === "PENDING" || row.status === "ACCEPTED") {
      entry.active += Number(row.total);
    } else if (row.status === "COMPLETED") {
      entry.completed += Number(row.total);
    }
    loadMap.set(row.reviewerId, entry);
  }
  return users.map((u) => {
    const entry = loadMap.get(u.id);
    return { ...u, activeLoad: entry?.active ?? 0, completedLoad: entry?.completed ?? 0 };
  });
}

export default async function ReviewsPage() {
  const authContext = await getServerAuthContext();
  if (!authContext?.user.isActive) redirect("/login");

  const [initialAssignments, initialReviewerUsers] = await Promise.all([
    loadInitialAssignments(authContext.user),
    loadInitialReviewerUsers(authContext.user),
  ]);

  return (
    <ReviewsPageClient
      initialAssignments={initialAssignments}
      initialReviewerUsers={initialReviewerUsers}
    />
  );
}
