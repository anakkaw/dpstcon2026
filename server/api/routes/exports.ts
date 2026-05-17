import { OpenAPIHono } from "@hono/zod-openapi";
import { db } from "@/server/db";
import { authMiddleware } from "../middleware/auth";
import type { AuthEnv } from "../middleware/auth";
import { getTrackRoleIds, hasRole } from "@/lib/permissions";
import { normalizeSubmissionStatus } from "@/lib/submission-status";
import { submissions } from "@/server/db/schema";
import { asc, inArray, type SQL } from "drizzle-orm";

const app = new OpenAPIHono<AuthEnv>();
const CSV_EXPORT_BATCH_SIZE = 500;
const JSON_EXPORT_LIMIT = 1_000;

app.use("/*", authMiddleware);

function csvCell(value: string | null | undefined) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

function fetchProceedingsRows(whereClause: SQL | undefined, limit: number, offset = 0) {
  return db.query.submissions.findMany({
    where: whereClause,
    with: {
      author: { columns: { name: true, email: true, affiliation: true, prefixTh: true, firstNameTh: true, lastNameTh: true, prefixEn: true, firstNameEn: true, lastNameEn: true } },
      track: { columns: { name: true } },
      reviews: {
        columns: { recommendation: true, completedAt: true },
      },
      coAuthors: { columns: { name: true, email: true, affiliation: true } },
    },
    limit,
    offset,
    orderBy: [asc(submissions.createdAt), asc(submissions.id)],
  });
}

function proceedingsCsvRow(s: Awaited<ReturnType<typeof fetchProceedingsRows>>[number]) {
  const completedReviews = s.reviews.filter((r) => r.completedAt);
  const recommendations = completedReviews
    .map((r) => r.recommendation)
    .filter(Boolean)
    .join("; ");
  return [
    csvCell(s.id),
    csvCell(s.title),
    csvCell(s.author.name),
    csvCell(s.author.email),
    csvCell(s.author.affiliation),
    csvCell(s.track?.name),
    csvCell(normalizeSubmissionStatus(s.status)),
    csvCell(recommendations),
  ].join(",");
}

app.get("/proceedings", async (c) => {
  const currentUser = c.get("user");
  const format = c.req.query("format") || "json";

  let whereClause: SQL | undefined = undefined;

  if (!hasRole(currentUser, "ADMIN")) {
    const chairedTrackIds = getTrackRoleIds(currentUser, "PROGRAM_CHAIR");

    if (chairedTrackIds.length === 0) {
      return c.json({ error: "Forbidden" }, 403);
    }

    whereClause = inArray(submissions.trackId, chairedTrackIds);
  }

  if (format === "csv") {
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        controller.enqueue(encoder.encode("ID,Title,Author,Email,Affiliation,Track,Status,Recommendation\n"));

        let offset = 0;
        while (true) {
          const batch = await fetchProceedingsRows(whereClause, CSV_EXPORT_BATCH_SIZE, offset);
          if (batch.length === 0) break;
          controller.enqueue(
            encoder.encode(batch.map(proceedingsCsvRow).join("\n") + "\n")
          );
          if (batch.length < CSV_EXPORT_BATCH_SIZE) break;
          offset += CSV_EXPORT_BATCH_SIZE;
        }

        controller.close();
      },
    });

    return new Response(stream, {
      headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="dpstcon-proceedings.csv"` },
    });
  }

  const allSubmissions = await fetchProceedingsRows(whereClause, JSON_EXPORT_LIMIT);

  return c.json({
    exportedAt: new Date().toISOString(),
    count: allSubmissions.length,
    truncated: allSubmissions.length === JSON_EXPORT_LIMIT,
    submissions: allSubmissions.map((s) => {
      const cr = s.reviews.filter((r) => r.completedAt);
      return { id: s.id, title: s.title, abstract: s.abstract, status: normalizeSubmissionStatus(s.status), author: s.author, coAuthors: s.coAuthors, track: s.track?.name, reviewCount: cr.length, reviews: cr };
    }),
  });
});

export { app as exportRoutes };
