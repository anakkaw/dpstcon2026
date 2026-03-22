import { OpenAPIHono } from "@hono/zod-openapi";
import { db } from "@/server/db";
import {
  presentationAssignments,
  presentationCommitteeAssignments,
  presentationCriteria,
  presentationEvaluations,
} from "@/server/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { authMiddleware, requireRole } from "../middleware/auth";
import { z } from "zod";

const app = new OpenAPIHono();

app.use("/*", authMiddleware);

app.get("/", async (c) => {
  const typeFilter = c.req.query("type") as "ORAL" | "POSTER" | undefined;
  const presentations = await db.query.presentationAssignments.findMany({
    where: typeFilter ? eq(presentationAssignments.type, typeFilter) : undefined,
    with: {
      submission: {
        columns: { id: true, title: true },
        with: {
          author: { columns: { id: true, name: true } },
          track: { columns: { id: true, name: true } },
        },
      },
    },
    orderBy: [desc(presentationAssignments.scheduledAt)],
  });
  return c.json({ presentations });
});

app.get("/criteria", async (c) => {
  const criteria = await db.select().from(presentationCriteria);
  return c.json({ criteria });
});

app.post("/criteria", requireRole("ADMIN", "PROGRAM_CHAIR"), async (c) => {
  const body = await c.req.json();
  const schema = z.object({
    name: z.string().min(1),
    description: z.string().optional(),
    maxScore: z.number().min(1).default(10),
    weight: z.number().min(1).default(1),
  });

  const parsed = schema.safeParse(body);
  if (!parsed.success) return c.json({ error: "Validation error" }, 400);

  const [criterion] = await db.insert(presentationCriteria).values(parsed.data).returning();
  return c.json({ criterion }, 201);
});

app.post("/schedule", requireRole("ADMIN", "PROGRAM_CHAIR"), async (c) => {
  const body = await c.req.json();
  const schema = z.object({
    submissionId: z.string().uuid(),
    type: z.enum(["POSTER", "ORAL"]),
    scheduledAt: z.string().optional(),
    room: z.string().optional(),
    duration: z.number().optional(),
  });

  const parsed = schema.safeParse(body);
  if (!parsed.success) return c.json({ error: "Validation error" }, 400);

  const [assignment] = await db
    .insert(presentationAssignments)
    .values({
      submissionId: parsed.data.submissionId,
      type: parsed.data.type,
      scheduledAt: parsed.data.scheduledAt ? new Date(parsed.data.scheduledAt) : undefined,
      room: parsed.data.room,
      duration: parsed.data.duration,
      status: parsed.data.scheduledAt ? "SCHEDULED" : "PENDING",
    })
    .returning();

  return c.json({ assignment }, 201);
});

app.patch("/:id/schedule", requireRole("ADMIN", "PROGRAM_CHAIR"), async (c) => {
  const { id } = c.req.param();
  const body = await c.req.json();

  const schema = z.object({
    scheduledAt: z.string().optional(),
    room: z.string().optional(),
    duration: z.number().optional(),
  });

  const parsed = schema.safeParse(body);
  if (!parsed.success) return c.json({ error: "Validation error" }, 400);

  const [updated] = await db
    .update(presentationAssignments)
    .set({
      scheduledAt: parsed.data.scheduledAt ? new Date(parsed.data.scheduledAt) : undefined,
      room: parsed.data.room,
      duration: parsed.data.duration,
      status: parsed.data.scheduledAt ? "SCHEDULED" : "PENDING",
    })
    .where(eq(presentationAssignments.id, id))
    .returning();

  if (!updated) return c.json({ error: "Not found" }, 404);
  return c.json({ presentation: updated });
});

// M9: Validate judgeIds with Zod
app.patch("/:id/committee", requireRole("ADMIN", "PROGRAM_CHAIR"), async (c) => {
  const { id } = c.req.param();
  const body = await c.req.json();

  const schema = z.object({
    judgeIds: z.array(z.string().min(1)),
  });

  const parsed = schema.safeParse(body);
  if (!parsed.success) return c.json({ error: "judgeIds ต้องเป็น array ของ string" }, 400);

  const { judgeIds } = parsed.data;

  await db.delete(presentationCommitteeAssignments).where(eq(presentationCommitteeAssignments.presentationId, id));

  if (judgeIds.length > 0) {
    await db.insert(presentationCommitteeAssignments).values(judgeIds.map((judgeId) => ({ presentationId: id, judgeId })));
  }

  return c.json({ ok: true, count: judgeIds.length });
});

// H5: Verify user is an assigned committee judge before allowing evaluation
app.post("/:id/evaluations", async (c) => {
  const { id } = c.req.param();
  const currentUser = c.get("user" as never) as { id: string; role: string; roles: string[] };
  const body = await c.req.json();

  const schema = z.object({ scores: z.record(z.string(), z.number()), comments: z.string().optional() });
  const parsed = schema.safeParse(body);
  if (!parsed.success) return c.json({ error: "Validation error" }, 400);

  // Verify user is assigned as committee judge for this presentation
  const isAssignedJudge = await db.query.presentationCommitteeAssignments.findFirst({
    where: and(
      eq(presentationCommitteeAssignments.presentationId, id),
      eq(presentationCommitteeAssignments.judgeId, currentUser.id)
    ),
  });

  const isAdmin = currentUser.roles?.includes("ADMIN") || currentUser.role === "ADMIN";
  if (!isAssignedJudge && !isAdmin) {
    return c.json({ error: "คุณไม่ได้รับมอบหมายให้ประเมินการนำเสนอนี้" }, 403);
  }

  const existing = await db.query.presentationEvaluations.findFirst({
    where: and(eq(presentationEvaluations.presentationId, id), eq(presentationEvaluations.judgeId, currentUser.id)),
  });

  if (existing) {
    await db.update(presentationEvaluations).set({ scores: parsed.data.scores, comments: parsed.data.comments }).where(eq(presentationEvaluations.id, existing.id));
    return c.json({ ok: true, updated: true });
  }

  const [evaluation] = await db
    .insert(presentationEvaluations)
    .values({ presentationId: id, judgeId: currentUser.id, scores: parsed.data.scores, comments: parsed.data.comments })
    .returning();

  return c.json({ evaluation }, 201);
});

app.get("/scoring-dashboard", requireRole("ADMIN", "PROGRAM_CHAIR"), async (c) => {
  // Fetch all three independent datasets in parallel
  const [presentations, evaluations, criteria] = await Promise.all([
    db.query.presentationAssignments.findMany({
      with: {
        submission: { columns: { id: true, title: true }, with: { author: { columns: { name: true } }, track: { columns: { id: true, name: true } } } },
      },
    }),
    db.query.presentationEvaluations.findMany({
      with: { judge: { columns: { id: true, name: true } } },
    }),
    db.select().from(presentationCriteria),
  ]);

  const scoresByPresentation: Record<string, typeof evaluations> = {};
  for (const ev of evaluations) {
    if (!scoresByPresentation[ev.presentationId]) scoresByPresentation[ev.presentationId] = [];
    scoresByPresentation[ev.presentationId].push(ev);
  }

  return c.json({
    presentations: presentations.map((p) => ({ ...p, evaluations: scoresByPresentation[p.id] || [] })),
    criteria,
  });
});

export { app as presentationRoutes };
