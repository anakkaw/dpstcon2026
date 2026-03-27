import { OpenAPIHono } from "@hono/zod-openapi";
import { db } from "@/server/db";
import {
  presentationAssignments,
  presentationCommitteeAssignments,
  presentationCriteria,
  presentationEvaluations,
  submissions,
  tracks,
  userRoles,
} from "@/server/db/schema";
import { eq, and, desc, inArray } from "drizzle-orm";
import { authMiddleware } from "../middleware/auth";
import type { AuthEnv } from "../middleware/auth";
import { z } from "zod";
import { hasRole } from "@/lib/permissions";

const app = new OpenAPIHono<AuthEnv>();

app.use("/*", authMiddleware);

async function getChairedTrackIds(userId: string) {
  const rows = await db
    .select({ id: tracks.id })
    .from(tracks)
    .where(eq(tracks.headUserId, userId));

  return rows.map((row) => row.id);
}

async function canManageSubmissionPresentation(
  currentUser: AuthEnv["Variables"]["user"],
  submissionId: string
) {
  if (hasRole(currentUser, "ADMIN")) return true;

  const submission = await db.query.submissions.findFirst({
    where: eq(submissions.id, submissionId),
    columns: { trackId: true },
  });

  if (!submission?.trackId) return false;

  const track = await db.query.tracks.findFirst({
    where: eq(tracks.id, submission.trackId),
    columns: { headUserId: true },
  });

  return track?.headUserId === currentUser.id;
}

async function canManagePresentation(
  currentUser: AuthEnv["Variables"]["user"],
  presentationId: string
) {
  if (hasRole(currentUser, "ADMIN")) return true;

  const presentation = await db.query.presentationAssignments.findFirst({
    where: eq(presentationAssignments.id, presentationId),
    columns: { submissionId: true },
  });

  if (!presentation) return false;
  return canManageSubmissionPresentation(currentUser, presentation.submissionId);
}

function parseScheduledAt(value: string | null | undefined) {
  if (value == null || value === "") {
    return { value: null as Date | null };
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return { error: "Invalid scheduledAt" as const };
  }

  return { value: parsed };
}

app.get("/", async (c) => {
  const currentUser = c.get("user");
  const typeFilter = c.req.query("type") as "ORAL" | "POSTER" | undefined;
  let whereClause = typeFilter
    ? eq(presentationAssignments.type, typeFilter)
    : undefined;

  if (!hasRole(currentUser, "ADMIN")) {
    const presentationIds = new Set<string>();

    const chairedTrackIds = await getChairedTrackIds(currentUser.id);
    if (chairedTrackIds.length > 0) {
      const managedRows = await db
        .select({ id: presentationAssignments.id })
        .from(presentationAssignments)
        .innerJoin(
          submissions,
          eq(presentationAssignments.submissionId, submissions.id)
        )
        .where(
          and(
            inArray(submissions.trackId, chairedTrackIds),
            typeFilter
              ? eq(presentationAssignments.type, typeFilter)
              : undefined
          )
        );

      managedRows.forEach((row) => presentationIds.add(row.id));
    }

    if (hasRole(currentUser, "COMMITTEE")) {
      const assignedRows = await db
        .select({ id: presentationAssignments.id })
        .from(presentationCommitteeAssignments)
        .innerJoin(
          presentationAssignments,
          eq(
            presentationCommitteeAssignments.presentationId,
            presentationAssignments.id
          )
        )
        .where(
          and(
            eq(presentationCommitteeAssignments.judgeId, currentUser.id),
            typeFilter
              ? eq(presentationAssignments.type, typeFilter)
              : undefined
          )
        );

      assignedRows.forEach((row) => presentationIds.add(row.id));
    }

    if (hasRole(currentUser, "AUTHOR")) {
      const ownRows = await db
        .select({ id: presentationAssignments.id })
        .from(presentationAssignments)
        .innerJoin(
          submissions,
          eq(presentationAssignments.submissionId, submissions.id)
        )
        .where(
          and(
            eq(submissions.authorId, currentUser.id),
            typeFilter
              ? eq(presentationAssignments.type, typeFilter)
              : undefined
          )
        );

      ownRows.forEach((row) => presentationIds.add(row.id));
    }

    if (presentationIds.size === 0) {
      return c.json({ presentations: [] });
    }

    whereClause = inArray(
      presentationAssignments.id,
      Array.from(presentationIds)
    );
  }

  const presentations = await db.query.presentationAssignments.findMany({
    where: whereClause,
    with: {
      submission: {
        columns: { id: true, title: true },
        with: {
          author: { columns: { id: true, name: true, prefixTh: true, firstNameTh: true, lastNameTh: true, prefixEn: true, firstNameEn: true, lastNameEn: true } },
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

app.post("/criteria", async (c) => {
  const currentUser = c.get("user");
  if (!hasRole(currentUser, "ADMIN")) {
    return c.json({ error: "Forbidden" }, 403);
  }

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

app.post("/schedule", async (c) => {
  const currentUser = c.get("user");
  const body = await c.req.json();
  const schema = z.object({
    submissionId: z.string().uuid(),
    type: z.enum(["POSTER", "ORAL"]),
    scheduledAt: z.string().nullable().optional(),
    room: z.string().nullable().optional(),
    duration: z.number().nullable().optional(),
  });

  const parsed = schema.safeParse(body);
  if (!parsed.success) return c.json({ error: "Validation error" }, 400);

  const scheduledAt = parseScheduledAt(parsed.data.scheduledAt);
  if ("error" in scheduledAt) return c.json({ error: scheduledAt.error }, 400);

  if (!(await canManageSubmissionPresentation(currentUser, parsed.data.submissionId))) {
    return c.json({ error: "Forbidden" }, 403);
  }

  const existing = await db.query.presentationAssignments.findFirst({
    where: and(
      eq(presentationAssignments.submissionId, parsed.data.submissionId),
      eq(presentationAssignments.type, parsed.data.type)
    ),
  });

  if (existing) {
    const [updated] = await db
      .update(presentationAssignments)
      .set({
        scheduledAt: scheduledAt.value,
        room: parsed.data.room ?? null,
        duration: parsed.data.duration ?? null,
        status: scheduledAt.value ? "SCHEDULED" : "PENDING",
      })
      .where(eq(presentationAssignments.id, existing.id))
      .returning();

    return c.json({ assignment: updated });
  }

  const [assignment] = await db
    .insert(presentationAssignments)
    .values({
      submissionId: parsed.data.submissionId,
      type: parsed.data.type,
      scheduledAt: scheduledAt.value,
      room: parsed.data.room ?? null,
      duration: parsed.data.duration ?? null,
      status: scheduledAt.value ? "SCHEDULED" : "PENDING",
    })
    .returning();

  return c.json({ assignment }, 201);
});

app.patch("/:id/schedule", async (c) => {
  const currentUser = c.get("user");
  const { id } = c.req.param();
  const body = await c.req.json();

  const schema = z.object({
    scheduledAt: z.string().nullable().optional(),
    room: z.string().nullable().optional(),
    duration: z.number().nullable().optional(),
  });

  const parsed = schema.safeParse(body);
  if (!parsed.success) return c.json({ error: "Validation error" }, 400);

  const scheduledAt = parseScheduledAt(parsed.data.scheduledAt);
  if ("error" in scheduledAt) return c.json({ error: scheduledAt.error }, 400);

  if (!(await canManagePresentation(currentUser, id))) {
    return c.json({ error: "Forbidden" }, 403);
  }

  const [updated] = await db
    .update(presentationAssignments)
    .set({
      scheduledAt: scheduledAt.value,
      room: parsed.data.room ?? null,
      duration: parsed.data.duration ?? null,
      status: scheduledAt.value ? "SCHEDULED" : "PENDING",
    })
    .where(eq(presentationAssignments.id, id))
    .returning();

  if (!updated) return c.json({ error: "Not found" }, 404);
  return c.json({ presentation: updated });
});

// M9: Validate judgeIds with Zod
app.patch("/:id/committee", async (c) => {
  const currentUser = c.get("user");
  const { id } = c.req.param();
  const body = await c.req.json();

  const schema = z.object({
    judgeIds: z.array(z.string().min(1)),
  });

  const parsed = schema.safeParse(body);
  if (!parsed.success) return c.json({ error: "judgeIds ต้องเป็น array ของ string" }, 400);

  const { judgeIds } = parsed.data;

  if (!(await canManagePresentation(currentUser, id))) {
    return c.json({ error: "Forbidden" }, 403);
  }

  const presentation = await db.query.presentationAssignments.findFirst({
    where: eq(presentationAssignments.id, id),
    columns: { submissionId: true },
  });
  if (!presentation) return c.json({ error: "Not found" }, 404);

  const submission = await db.query.submissions.findFirst({
    where: eq(submissions.id, presentation.submissionId),
    columns: { trackId: true },
  });

  let allowedJudgeIds: string[] = [];
  if (hasRole(currentUser, "ADMIN")) {
    const rows = await db
      .select({ userId: userRoles.userId })
      .from(userRoles)
      .where(eq(userRoles.role, "COMMITTEE"));
    allowedJudgeIds = Array.from(new Set(rows.map((row) => row.userId)));
  } else if (submission?.trackId) {
    const rows = await db
      .select({ userId: userRoles.userId })
      .from(userRoles)
      .where(
        and(
          eq(userRoles.role, "COMMITTEE"),
          eq(userRoles.trackId, submission.trackId)
        )
      );
    allowedJudgeIds = Array.from(new Set(rows.map((row) => row.userId)));
  }

  if (!judgeIds.every((judgeId) => allowedJudgeIds.includes(judgeId))) {
    return c.json({ error: "Invalid committee assignment" }, 400);
  }

  await db.delete(presentationCommitteeAssignments).where(eq(presentationCommitteeAssignments.presentationId, id));

  if (judgeIds.length > 0) {
    await db.insert(presentationCommitteeAssignments).values(judgeIds.map((judgeId) => ({ presentationId: id, judgeId })));
  }

  return c.json({ ok: true, count: judgeIds.length });
});

// H5: Verify user is an assigned committee judge before allowing evaluation
app.post("/:id/evaluations", async (c) => {
  const { id } = c.req.param();
  const currentUser = c.get("user");
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

app.get("/scoring-dashboard", async (c) => {
  const currentUser = c.get("user");
  let whereClause = undefined;

  if (!hasRole(currentUser, "ADMIN")) {
    const chairedTrackIds = await getChairedTrackIds(currentUser.id);
    if (chairedTrackIds.length === 0) {
      return c.json({ error: "Forbidden" }, 403);
    }

    const presentationIds = await db
      .select({ id: presentationAssignments.id })
      .from(presentationAssignments)
      .innerJoin(
        submissions,
        eq(presentationAssignments.submissionId, submissions.id)
      )
      .where(inArray(submissions.trackId, chairedTrackIds));

    if (presentationIds.length === 0) {
      return c.json({ presentations: [], criteria: [] });
    }

    whereClause = inArray(
      presentationAssignments.id,
      presentationIds.map((row) => row.id)
    );
  }

  const presentations = await db.query.presentationAssignments.findMany({
    where: whereClause,
    with: {
      submission: { columns: { id: true, title: true }, with: { author: { columns: { name: true, prefixTh: true, firstNameTh: true, lastNameTh: true, prefixEn: true, firstNameEn: true, lastNameEn: true } }, track: { columns: { id: true, name: true } } } },
    },
  });
  const presentationIds = presentations.map((presentation) => presentation.id);
  const [evaluations, criteria] = await Promise.all([
    presentationIds.length > 0
      ? db.query.presentationEvaluations.findMany({
          where: inArray(presentationEvaluations.presentationId, presentationIds),
          with: { judge: { columns: { id: true, name: true } } },
        })
      : Promise.resolve([]),
    db.select().from(presentationCriteria),
  ]);

  const scoresByPresentation: Record<string, (typeof evaluations)[number][]> = {};
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
