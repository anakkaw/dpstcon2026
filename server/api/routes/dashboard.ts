import { OpenAPIHono } from "@hono/zod-openapi";
import { db } from "@/server/db";
import { submissions, reviews, reviewAssignments, userRoles } from "@/server/db/schema";
import { eq, count, inArray, and } from "drizzle-orm";
import { authMiddleware } from "../middleware/auth";
import type { AuthEnv } from "../middleware/auth";
import { getTrackRoleIds, hasRole } from "@/lib/permissions";

const app = new OpenAPIHono<AuthEnv>();

app.use("/*", authMiddleware);

app.get("/", async (c) => {
  const currentUser = c.get("user");

  // Build combined stats based on all user roles
  const stats: Record<string, unknown> = {};

  // Author stats
  if (hasRole(currentUser, "AUTHOR")) {
    const mySubmissions = await db
      .select({ status: submissions.status, count: count() })
      .from(submissions)
      .where(eq(submissions.authorId, currentUser.id))
      .groupBy(submissions.status);

    stats.author = {
      totalSubmissions: mySubmissions.reduce((s, r) => s + Number(r.count), 0),
      byStatus: Object.fromEntries(mySubmissions.map((s) => [s.status, Number(s.count)])),
    };
  }

  // Reviewer stats
  if (hasRole(currentUser, "REVIEWER")) {
    const myAssignments = await db
      .select({ status: reviewAssignments.status, count: count() })
      .from(reviewAssignments)
      .where(eq(reviewAssignments.reviewerId, currentUser.id))
      .groupBy(reviewAssignments.status);

    stats.reviewer = {
      totalAssignments: myAssignments.reduce((s, r) => s + Number(r.count), 0),
      completed: Number(myAssignments.find((a) => a.status === "COMPLETED")?.count || 0),
      pending: Number(
        myAssignments
          .filter((a) => ["PENDING", "ACCEPTED"].includes(a.status))
          .reduce((s, r) => s + Number(r.count), 0)
      ),
    };
  }

  // Admin/Chair/Committee stats — run all queries in parallel
  if (hasRole(currentUser, "ADMIN", "PROGRAM_CHAIR", "COMMITTEE")) {
    let scopeTrackIds: string[] | null = null;

    if (!hasRole(currentUser, "ADMIN")) {
      const chairedTrackIds = getTrackRoleIds(currentUser, "PROGRAM_CHAIR");
      const committeeTrackIds = getTrackRoleIds(currentUser, "COMMITTEE");
      scopeTrackIds = Array.from(
        new Set([
          ...chairedTrackIds,
          ...committeeTrackIds,
        ])
      );

      if (scopeTrackIds.length === 0) {
        return c.json({
          roles: currentUser.roles,
          stats,
        });
      }
    }

    const [[subCount], statusBreakdown, [revCount], [reviewerCount]] = await Promise.all([
      db
        .select({ total: count() })
        .from(submissions)
        .where(scopeTrackIds ? inArray(submissions.trackId, scopeTrackIds) : undefined),
      db
        .select({ status: submissions.status, count: count() })
        .from(submissions)
        .where(scopeTrackIds ? inArray(submissions.trackId, scopeTrackIds) : undefined)
        .groupBy(submissions.status),
      db
        .select({ total: count() })
        .from(reviews)
        .innerJoin(submissions, eq(reviews.submissionId, submissions.id))
        .where(scopeTrackIds ? inArray(submissions.trackId, scopeTrackIds) : undefined),
      db
        .select({ total: count() })
        .from(userRoles)
        .where(
          scopeTrackIds
            ? and(
                eq(userRoles.role, "REVIEWER"),
                inArray(userRoles.trackId, scopeTrackIds)
              )
            : eq(userRoles.role, "REVIEWER")
        ),
    ]);

    stats.admin = {
      totalSubmissions: Number(subCount?.total || 0),
      totalReviewers: Number(reviewerCount?.total || 0),
      totalReviews: Number(revCount?.total || 0),
      submissionsByStatus: Object.fromEntries(
        statusBreakdown.map((s) => [s.status, Number(s.count)])
      ),
    };
  }

  return c.json({
    roles: currentUser.roles,
    stats,
  });
});

export { app as dashboardRoutes };
