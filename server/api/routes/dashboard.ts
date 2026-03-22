import { OpenAPIHono } from "@hono/zod-openapi";
import { db } from "@/server/db";
import { submissions, reviews, reviewAssignments, userRoles } from "@/server/db/schema";
import { eq, count } from "drizzle-orm";
import { authMiddleware } from "../middleware/auth";
import type { SessionUser } from "../middleware/auth";
import { hasRole } from "@/lib/permissions";

const app = new OpenAPIHono();

app.use("/*", authMiddleware);

app.get("/", async (c) => {
  const currentUser = c.get("user" as never) as SessionUser;

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
    const [[subCount], statusBreakdown, [revCount], [reviewerCount]] = await Promise.all([
      db.select({ total: count() }).from(submissions),
      db
        .select({ status: submissions.status, count: count() })
        .from(submissions)
        .groupBy(submissions.status),
      db.select({ total: count() }).from(reviews),
      db
        .select({ total: count() })
        .from(userRoles)
        .where(eq(userRoles.role, "REVIEWER")),
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
