import { db } from "@/server/db";

function verifyCronSecret(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = req.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}

export async function POST(req: Request) {
  if (!verifyCronSecret(req)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { format, requestedBy } = await req.json();

    const allSubmissions = await db.query.submissions.findMany({
      with: {
        author: { columns: { name: true, email: true, affiliation: true } },
        track: { columns: { name: true } },
        reviews: { columns: { recommendation: true, completedAt: true } },
      },
    });

    console.log(`[generate-export] Exporting ${allSubmissions.length} submissions in ${format} format`);

    return Response.json({ ok: true, count: allSubmissions.length });
  } catch (error) {
    console.error("[generate-export] Error:", error);
    return Response.json({ error: "Export failed" }, { status: 500 });
  }
}
