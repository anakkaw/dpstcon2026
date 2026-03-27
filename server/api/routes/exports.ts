import { OpenAPIHono } from "@hono/zod-openapi";
import { db } from "@/server/db";
import { authMiddleware } from "../middleware/auth";
import type { AuthEnv } from "../middleware/auth";
import { hasRole } from "@/lib/permissions";
import { tracks, submissions } from "@/server/db/schema";
import { eq, inArray } from "drizzle-orm";

const app = new OpenAPIHono<AuthEnv>();

app.use("/*", authMiddleware);

app.get("/proceedings", async (c) => {
  const currentUser = c.get("user");
  const format = c.req.query("format") || "json";

  let whereClause = undefined;

  if (!hasRole(currentUser, "ADMIN")) {
    const chairedTracks = await db
      .select({ id: tracks.id })
      .from(tracks)
      .where(eq(tracks.headUserId, currentUser.id));
    const chairedTrackIds = chairedTracks.map((track) => track.id);

    if (chairedTrackIds.length === 0) {
      return c.json({ error: "Forbidden" }, 403);
    }

    whereClause = inArray(submissions.trackId, chairedTrackIds);
  }

  const allSubmissions = await db.query.submissions.findMany({
    where: whereClause,
    with: {
      author: { columns: { name: true, email: true, affiliation: true, prefixTh: true, firstNameTh: true, lastNameTh: true, prefixEn: true, firstNameEn: true, lastNameEn: true } },
      track: { columns: { name: true } },
      reviews: {
        columns: { recommendation: true, completedAt: true },
      },
      coAuthors: { columns: { name: true, email: true, affiliation: true } },
    },
  });

  if (format === "csv") {
    const header = "ID,Title,Author,Email,Affiliation,Track,Status,Recommendation\n";
    const rows = allSubmissions
      .map((s) => {
        const cr = s.reviews.filter((r) => r.completedAt);
        const recs = cr.map((r) => r.recommendation).filter(Boolean).join("; ");
        return [s.id, `"${s.title.replace(/"/g, '""')}"`, `"${s.author.name}"`, s.author.email, `"${s.author.affiliation || ""}"`, `"${s.track?.name || ""}"`, s.status, `"${recs}"`].join(",");
      })
      .join("\n");

    return new Response(header + rows, {
      headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="dpstcon-proceedings.csv"` },
    });
  }

  return c.json({
    exportedAt: new Date().toISOString(),
    count: allSubmissions.length,
    submissions: allSubmissions.map((s) => {
      const cr = s.reviews.filter((r) => r.completedAt);
      return { id: s.id, title: s.title, abstract: s.abstract, status: s.status, author: s.author, coAuthors: s.coAuthors, track: s.track?.name, reviewCount: cr.length, reviews: cr };
    }),
  });
});

export { app as exportRoutes };
