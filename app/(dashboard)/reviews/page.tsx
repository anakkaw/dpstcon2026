import { redirect } from "next/navigation";
import { eq, inArray } from "drizzle-orm";
import { hasRole } from "@/lib/permissions";
import { getServerAuthContext } from "@/server/auth-helpers";
import { db } from "@/server/db";
import { reviewAssignments, user, userRoles } from "@/server/db/schema";
import { ReviewsPageClient, type AssignmentData, type ReviewerUser } from "./reviews-page-client";

async function loadInitialAssignments(
  currentUser: NonNullable<Awaited<ReturnType<typeof getServerAuthContext>>>["user"]
): Promise<AssignmentData[]> {
  const isAdmin = hasRole(currentUser, "ADMIN", "PROGRAM_CHAIR");
  const whereClause = isAdmin ? undefined : eq(reviewAssignments.reviewerId, currentUser.id);

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

  const reviewerRoleRows = await db
    .select({ userId: userRoles.userId })
    .from(userRoles)
    .where(eq(userRoles.role, "REVIEWER"));

  const reviewerIds = Array.from(new Set(reviewerRoleRows.map((row) => row.userId)));
  if (reviewerIds.length === 0) {
    return [];
  }

  return db
    .select({ id: user.id, name: user.name, email: user.email })
    .from(user)
    .where(inArray(user.id, reviewerIds));
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
