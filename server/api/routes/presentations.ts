import { OpenAPIHono } from "@hono/zod-openapi";
import { db } from "@/server/db";
import {
  presentationAssignments,
  presentationCommitteeAssignments,
  presentationEvaluations,
  posterSlotJudges,
  settings,
  submissions,
  user,
  userRoles,
} from "@/server/db/schema";
import { eq, and, desc, inArray } from "drizzle-orm";
import { authMiddleware } from "../middleware/auth";
import type { AuthEnv } from "../middleware/auth";
import { z } from "zod";
import { getTrackRoleIds, hasTrackRole, hasRole } from "@/lib/permissions";
import {
  getPosterPlannerPageData,
  getPosterSessionSettings,
} from "@/server/poster-planner-data";
import type { ServerAuthUser } from "@/server/auth-helpers";
import {
  getPresentationRubric,
  savePresentationRubric,
  type PresentationRubricCriterion,
} from "@/server/presentation-rubrics";

const app = new OpenAPIHono<AuthEnv>();

const POSTER_SESSION_ROOM_KEY = "posterSessionRoom";
const POSTER_SESSION_SLOTS_KEY = "posterSessionSlotTemplates";

app.use("/*", authMiddleware);

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

  return hasTrackRole(currentUser, submission.trackId, "PROGRAM_CHAIR");
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

async function canManageTrack(
  currentUser: AuthEnv["Variables"]["user"],
  trackId: string
) {
  if (hasRole(currentUser, "ADMIN")) return true;
  return hasTrackRole(currentUser, trackId, "PROGRAM_CHAIR");
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

const posterSlotTemplateSchema = z.object({
  startsAt: z.string(),
  endsAt: z.string(),
});

const posterSessionSchema = z.object({
  room: z.string().trim().max(100).nullable().optional(),
  slotTemplates: z.array(posterSlotTemplateSchema).default([]),
});

function normalizePosterSlotTemplates(
  templates: Array<{ startsAt: string; endsAt: string }>
) {
  return templates
    .map((template) => {
      const startsAt = new Date(template.startsAt);
      const endsAt = new Date(template.endsAt);
      if (
        Number.isNaN(startsAt.getTime()) ||
        Number.isNaN(endsAt.getTime()) ||
        startsAt >= endsAt
      ) {
        return null;
      }

      return {
        startsAt: startsAt.toISOString(),
        endsAt: endsAt.toISOString(),
      };
    })
    .filter((template): template is { startsAt: string; endsAt: string } => template !== null)
    .sort(
      (a, b) =>
        new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime() ||
        new Date(a.endsAt).getTime() - new Date(b.endsAt).getTime()
    )
    .filter((template, index, array) => {
      if (index === 0) return true;
      const previous = array[index - 1];
      return (
        previous.startsAt !== template.startsAt || previous.endsAt !== template.endsAt
      );
    });
}

async function savePosterSessionSettings(input: {
  room?: string | null;
  slotTemplates?: Array<{ startsAt: string; endsAt: string }>;
}) {
  const now = new Date();
  const slotTemplates = normalizePosterSlotTemplates(input.slotTemplates ?? []);
  const room = input.room?.trim() ?? "";

  await Promise.all([
    db
      .insert(settings)
      .values({
        key: POSTER_SESSION_ROOM_KEY,
        value: room,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: settings.key,
        set: { value: room, updatedAt: now },
      }),
    db
      .insert(settings)
      .values({
        key: POSTER_SESSION_SLOTS_KEY,
        value: slotTemplates,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: settings.key,
        set: { value: slotTemplates, updatedAt: now },
      }),
  ]);

  return getPosterSessionSettings();
}

app.get("/", async (c) => {
  const currentUser = c.get("user");
  const typeFilter = c.req.query("type") as "ORAL" | "POSTER" | undefined;
  let whereClause = typeFilter
    ? eq(presentationAssignments.type, typeFilter)
    : undefined;

  if (!hasRole(currentUser, "ADMIN")) {
    const presentationIds = new Set<string>();

    const chairedTrackIds = getTrackRoleIds(currentUser, "PROGRAM_CHAIR");
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
        columns: { id: true, paperCode: true, title: true },
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
  const type = (c.req.query("type") as "ORAL" | "POSTER" | undefined) ?? "ORAL";
  const criteria = await getPresentationRubric(type);
  return c.json({ criteria });
});

app.put("/criteria", async (c) => {
  const currentUser = c.get("user");
  if (!hasRole(currentUser, "ADMIN")) {
    return c.json({ error: "Forbidden" }, 403);
  }

  const body = await c.req.json();
  const levelSchema = z.object({
    level: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]),
    titleTh: z.string().min(1),
    titleEn: z.string().min(1),
    descriptionTh: z.string().min(1),
    descriptionEn: z.string().min(1),
  });
  const criterionSchema = z.object({
    id: z.string().min(1),
    nameTh: z.string().min(1),
    nameEn: z.string().min(1),
    descriptionTh: z.string().min(1),
    descriptionEn: z.string().min(1),
    totalPoints: z.number().min(0),
    levels: z.array(levelSchema).length(5),
  });
  const schema = z.object({
    type: z.enum(["ORAL", "POSTER"]),
    criteria: z.array(criterionSchema).min(1),
  });

  const parsed = schema.safeParse(body);
  if (!parsed.success) return c.json({ error: "Validation error" }, 400);

  const criteria = await savePresentationRubric(
    parsed.data.type,
    parsed.data.criteria as PresentationRubricCriterion[]
  );
  return c.json({ criteria });
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

app.get("/poster-planner", async (c) => {
  const currentUser = c.get("user");

  if (!hasRole(currentUser, "ADMIN", "PROGRAM_CHAIR")) {
    return c.json({ error: "Forbidden" }, 403);
  }

  const data = await getPosterPlannerPageData(currentUser as ServerAuthUser);
  return c.json(data);
});

// ── Poster Slot-Judge Endpoints ──

app.post("/poster-slots", async (c) => {
  const currentUser = c.get("user");
  const body = await c.req.json();
  const schema = z.object({
    submissionId: z.string().uuid(),
    judgeId: z.string().min(1),
    startsAt: z.string(),
    endsAt: z.string(),
  });

  const parsed = schema.safeParse(body);
  if (!parsed.success) return c.json({ error: "Validation error" }, 400);

  if (!(await canManageSubmissionPresentation(currentUser, parsed.data.submissionId))) {
    return c.json({ error: "Forbidden" }, 403);
  }

  const startsAt = new Date(parsed.data.startsAt);
  const endsAt = new Date(parsed.data.endsAt);
  if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime()) || startsAt >= endsAt) {
    return c.json({ error: "Invalid time range" }, 400);
  }

  const [slot] = await db
    .insert(posterSlotJudges)
    .values({
      submissionId: parsed.data.submissionId,
      judgeId: parsed.data.judgeId,
      startsAt,
      endsAt,
      status: "PLANNED",
    })
    .returning();

  return c.json({ slot }, 201);
});

app.patch("/poster-slots/:slotId", async (c) => {
  const currentUser = c.get("user");
  const { slotId } = c.req.param();
  const body = await c.req.json();
  const schema = z.object({
    judgeId: z.string().min(1).optional(),
    status: z.enum(["PLANNED", "CONFIRMED", "COMPLETED"]).optional(),
  });

  const parsed = schema.safeParse(body);
  if (!parsed.success) return c.json({ error: "Validation error" }, 400);

  const existing = await db.query.posterSlotJudges.findFirst({
    where: eq(posterSlotJudges.id, slotId),
    columns: { submissionId: true },
  });
  if (!existing) return c.json({ error: "Not found" }, 404);
  if (!(await canManageSubmissionPresentation(currentUser, existing.submissionId))) {
    return c.json({ error: "Forbidden" }, 403);
  }

  const [updated] = await db
    .update(posterSlotJudges)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(posterSlotJudges.id, slotId))
    .returning();

  return c.json({ slot: updated });
});

app.delete("/poster-slots/:slotId", async (c) => {
  const currentUser = c.get("user");
  const { slotId } = c.req.param();

  const existing = await db.query.posterSlotJudges.findFirst({
    where: eq(posterSlotJudges.id, slotId),
    columns: { submissionId: true },
  });
  if (!existing) return c.json({ error: "Not found" }, 404);
  if (!(await canManageSubmissionPresentation(currentUser, existing.submissionId))) {
    return c.json({ error: "Forbidden" }, 403);
  }

  await db.delete(posterSlotJudges).where(eq(posterSlotJudges.id, slotId));

  return c.json({ ok: true });
});

app.put("/poster-session", async (c) => {
  const currentUser = c.get("user");
  if (!hasRole(currentUser, "ADMIN", "PROGRAM_CHAIR")) {
    return c.json({ error: "Forbidden" }, 403);
  }

  const body = await c.req.json();
  const parsed = posterSessionSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: "Validation error" }, 400);

  const normalized = normalizePosterSlotTemplates(parsed.data.slotTemplates);
  if (normalized.length !== parsed.data.slotTemplates.length) {
    return c.json({ error: "Invalid slot template range" }, 400);
  }

  const sessionSettings = await savePosterSessionSettings({
    room: parsed.data.room ?? "",
    slotTemplates: parsed.data.slotTemplates,
  });

  return c.json({ sessionSettings });
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

  const isAdmin = hasRole(currentUser, "ADMIN");
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
    const chairedTrackIds = getTrackRoleIds(currentUser, "PROGRAM_CHAIR");
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
      submission: { columns: { id: true, paperCode: true, title: true }, with: { author: { columns: { name: true, prefixTh: true, firstNameTh: true, lastNameTh: true, prefixEn: true, firstNameEn: true, lastNameEn: true } }, track: { columns: { id: true, name: true } } } },
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
    getPresentationRubric("ORAL"),
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
