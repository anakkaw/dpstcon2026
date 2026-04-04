import { OpenAPIHono } from "@hono/zod-openapi";
import { db } from "@/server/db";
import {
  presentationAssignments,
  presentationCommitteeAssignments,
  presentationCriteria,
  presentationEvaluations,
  posterGroupJudges,
  posterGroupMembers,
  posterGroupSlots,
  posterPresentationGroups,
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

app.get("/poster-planner", async (c) => {
  const currentUser = c.get("user");

  if (!hasRole(currentUser, "ADMIN", "PROGRAM_CHAIR")) {
    return c.json({ error: "Forbidden" }, 403);
  }

  const data = await getPosterPlannerPageData(currentUser as ServerAuthUser);
  return c.json(data);
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

app.post("/poster-groups", async (c) => {
  const currentUser = c.get("user");
  const body = await c.req.json();
  const schema = z.object({
    trackId: z.string().uuid(),
    name: z.string().trim().min(1).max(255),
  });

  const parsed = schema.safeParse(body);
  if (!parsed.success) return c.json({ error: "Validation error" }, 400);

  if (!(await canManageTrack(currentUser, parsed.data.trackId))) {
    return c.json({ error: "Forbidden" }, 403);
  }

  const [group] = await db
    .insert(posterPresentationGroups)
    .values({
      trackId: parsed.data.trackId,
      name: parsed.data.name,
    })
    .returning();

  return c.json({ group }, 201);
});

app.patch("/poster-groups/:groupId", async (c) => {
  const currentUser = c.get("user");
  const { groupId } = c.req.param();
  const body = await c.req.json();
  const schema = z.object({
    name: z.string().trim().min(1).max(255).optional(),
  });

  const parsed = schema.safeParse(body);
  if (!parsed.success) return c.json({ error: "Validation error" }, 400);

  const group = await db.query.posterPresentationGroups.findFirst({
    where: eq(posterPresentationGroups.id, groupId),
    columns: { trackId: true },
  });

  if (!group) return c.json({ error: "Not found" }, 404);
  if (!(await canManageTrack(currentUser, group.trackId))) {
    return c.json({ error: "Forbidden" }, 403);
  }

  const [updated] = await db
    .update(posterPresentationGroups)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(posterPresentationGroups.id, groupId))
    .returning();

  return c.json({ group: updated });
});

app.post("/poster-groups/:groupId/members", async (c) => {
  const currentUser = c.get("user");
  const { groupId } = c.req.param();
  const body = await c.req.json();
  const schema = z.object({
    submissionIds: z.array(z.string().uuid()).min(1),
  });

  const parsed = schema.safeParse(body);
  if (!parsed.success) return c.json({ error: "Validation error" }, 400);

  const group = await db.query.posterPresentationGroups.findFirst({
    where: eq(posterPresentationGroups.id, groupId),
    columns: { id: true, trackId: true },
  });

  if (!group) return c.json({ error: "Not found" }, 404);
  if (!(await canManageTrack(currentUser, group.trackId))) {
    return c.json({ error: "Forbidden" }, 403);
  }

  const targetSubmissions = await db.query.submissions.findMany({
    where: inArray(submissions.id, parsed.data.submissionIds),
    columns: { id: true, trackId: true, status: true },
  });

  const acceptedStatuses = new Set(["ACCEPTED", "CAMERA_READY_PENDING", "CAMERA_READY_SUBMITTED"]);
  const invalidSubmission = targetSubmissions.find(
    (submission) =>
      submission.trackId !== group.trackId || !acceptedStatuses.has(submission.status)
  );

  if (invalidSubmission) {
    return c.json({ error: "Invalid poster selection" }, 400);
  }

  const existingMembers = await db.query.posterGroupMembers.findMany({
    where: inArray(posterGroupMembers.submissionId, parsed.data.submissionIds),
    columns: { submissionId: true },
  });

  const existingSubmissionIds = new Set(existingMembers.map((member) => member.submissionId));
  const values = parsed.data.submissionIds
    .filter((submissionId) => !existingSubmissionIds.has(submissionId))
    .map((submissionId) => ({ groupId, submissionId }));

  if (values.length > 0) {
    await db.insert(posterGroupMembers).values(values);
  }

  return c.json({ ok: true, count: values.length });
});

app.delete("/poster-groups/:groupId/members/:memberId", async (c) => {
  const currentUser = c.get("user");
  const { groupId, memberId } = c.req.param();

  const group = await db.query.posterPresentationGroups.findFirst({
    where: eq(posterPresentationGroups.id, groupId),
    columns: { trackId: true },
  });

  if (!group) return c.json({ error: "Not found" }, 404);
  if (!(await canManageTrack(currentUser, group.trackId))) {
    return c.json({ error: "Forbidden" }, 403);
  }

  await db
    .delete(posterGroupMembers)
    .where(and(eq(posterGroupMembers.id, memberId), eq(posterGroupMembers.groupId, groupId)));

  return c.json({ ok: true });
});

app.put("/poster-groups/:groupId/judges", async (c) => {
  const currentUser = c.get("user");
  const { groupId } = c.req.param();
  const body = await c.req.json();
  const schema = z.object({
    judgeIds: z.array(z.string().min(1)).max(3),
  });

  const parsed = schema.safeParse(body);
  if (!parsed.success) return c.json({ error: "Validation error" }, 400);

  const uniqueJudgeIds = Array.from(new Set(parsed.data.judgeIds));
  if (uniqueJudgeIds.length !== parsed.data.judgeIds.length) {
    return c.json({ error: "Judges must be unique" }, 400);
  }

  const group = await db.query.posterPresentationGroups.findFirst({
    where: eq(posterPresentationGroups.id, groupId),
    columns: { trackId: true },
  });

  if (!group) return c.json({ error: "Not found" }, 404);
  if (!(await canManageTrack(currentUser, group.trackId))) {
    return c.json({ error: "Forbidden" }, 403);
  }

  const judges = uniqueJudgeIds.length
    ? await db
        .select({ id: user.id })
        .from(user)
        .innerJoin(userRoles, eq(user.id, userRoles.userId))
        .where(
          and(
            eq(userRoles.role, "COMMITTEE"),
            inArray(user.id, uniqueJudgeIds)
          )
        )
    : [];

  if (judges.length !== uniqueJudgeIds.length) {
    return c.json({ error: "Invalid committee users" }, 400);
  }

  await db.delete(posterGroupJudges).where(eq(posterGroupJudges.groupId, groupId));

  if (uniqueJudgeIds.length > 0) {
    await db.insert(posterGroupJudges).values(
      uniqueJudgeIds.map((judgeId, index) => ({
        groupId,
        judgeId,
        judgeOrder: index + 1,
      }))
    );
  }

  return c.json({ ok: true, count: uniqueJudgeIds.length });
});

app.post("/poster-groups/:groupId/slots", async (c) => {
  const currentUser = c.get("user");
  const { groupId } = c.req.param();
  const body = await c.req.json();
  const schema = z.object({
    startsAt: z.string(),
    endsAt: z.string(),
    judgeId: z.string().min(1).nullable().optional(),
    status: z.enum(["PLANNED", "CONFIRMED", "COMPLETED"]).optional(),
  });

  const parsed = schema.safeParse(body);
  if (!parsed.success) return c.json({ error: "Validation error" }, 400);

  const startsAt = new Date(parsed.data.startsAt);
  const endsAt = new Date(parsed.data.endsAt);
  if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime()) || startsAt >= endsAt) {
    return c.json({ error: "Invalid slot range" }, 400);
  }

  const sessionSettings = await getPosterSessionSettings();
  const matchesTemplate = sessionSettings.slotTemplates.some(
    (slot) => slot.startsAt === startsAt.toISOString() && slot.endsAt === endsAt.toISOString()
  );
  if (!matchesTemplate) {
    return c.json({ error: "Slot must come from the shared poster session plan" }, 400);
  }

  const group = await db.query.posterPresentationGroups.findFirst({
    where: eq(posterPresentationGroups.id, groupId),
    columns: { trackId: true },
  });
  if (!group) return c.json({ error: "Not found" }, 404);
  if (!(await canManageTrack(currentUser, group.trackId))) {
    return c.json({ error: "Forbidden" }, 403);
  }

  if (parsed.data.judgeId) {
    const assignedJudge = await db.query.posterGroupJudges.findFirst({
      where: and(
        eq(posterGroupJudges.groupId, groupId),
        eq(posterGroupJudges.judgeId, parsed.data.judgeId)
      ),
      columns: { id: true },
    });

    if (!assignedJudge) {
      return c.json({ error: "Judge must belong to the group" }, 400);
    }
  }

  const duplicateSlot = await db.query.posterGroupSlots.findFirst({
    where: and(
      eq(posterGroupSlots.groupId, groupId),
      eq(posterGroupSlots.startsAt, startsAt),
      eq(posterGroupSlots.endsAt, endsAt)
    ),
    columns: { id: true },
  });
  if (duplicateSlot) {
    return c.json({ error: "This shared slot is already assigned to the group" }, 400);
  }

  const [lastSlot] = await db
    .select({ sortOrder: posterGroupSlots.sortOrder })
    .from(posterGroupSlots)
    .where(eq(posterGroupSlots.groupId, groupId))
    .orderBy(desc(posterGroupSlots.sortOrder))
    .limit(1);

  const [slot] = await db
    .insert(posterGroupSlots)
    .values({
      groupId,
      startsAt,
      endsAt,
      judgeId: parsed.data.judgeId ?? null,
      status: parsed.data.status ?? "PLANNED",
      sortOrder: (lastSlot?.sortOrder ?? 0) + 1,
    })
    .returning();

  return c.json({ slot }, 201);
});

app.patch("/poster-groups/:groupId/slots/:slotId", async (c) => {
  const currentUser = c.get("user");
  const { groupId, slotId } = c.req.param();
  const body = await c.req.json();
  const schema = z.object({
    startsAt: z.string().optional(),
    endsAt: z.string().optional(),
    judgeId: z.string().min(1).nullable().optional(),
    status: z.enum(["PLANNED", "CONFIRMED", "COMPLETED"]).optional(),
  });

  const parsed = schema.safeParse(body);
  if (!parsed.success) return c.json({ error: "Validation error" }, 400);

  const group = await db.query.posterPresentationGroups.findFirst({
    where: eq(posterPresentationGroups.id, groupId),
    columns: { trackId: true },
  });
  if (!group) return c.json({ error: "Not found" }, 404);
  if (!(await canManageTrack(currentUser, group.trackId))) {
    return c.json({ error: "Forbidden" }, 403);
  }

  const existingSlot = await db.query.posterGroupSlots.findFirst({
    where: and(eq(posterGroupSlots.id, slotId), eq(posterGroupSlots.groupId, groupId)),
    columns: { startsAt: true, endsAt: true },
  });
  if (!existingSlot) return c.json({ error: "Not found" }, 404);

  const startsAt = parsed.data.startsAt ? new Date(parsed.data.startsAt) : existingSlot.startsAt;
  const endsAt = parsed.data.endsAt ? new Date(parsed.data.endsAt) : existingSlot.endsAt;
  if (startsAt >= endsAt) {
    return c.json({ error: "Invalid slot range" }, 400);
  }

  const sessionSettings = await getPosterSessionSettings();
  const matchesTemplate = sessionSettings.slotTemplates.some(
    (slot) => slot.startsAt === startsAt.toISOString() && slot.endsAt === endsAt.toISOString()
  );
  if (!matchesTemplate) {
    return c.json({ error: "Slot must come from the shared poster session plan" }, 400);
  }

  if (parsed.data.judgeId) {
    const assignedJudge = await db.query.posterGroupJudges.findFirst({
      where: and(
        eq(posterGroupJudges.groupId, groupId),
        eq(posterGroupJudges.judgeId, parsed.data.judgeId)
      ),
      columns: { id: true },
    });

    if (!assignedJudge) {
      return c.json({ error: "Judge must belong to the group" }, 400);
    }
  }

  const duplicateSlot = await db.query.posterGroupSlots.findFirst({
    where: and(
      eq(posterGroupSlots.groupId, groupId),
      eq(posterGroupSlots.startsAt, startsAt),
      eq(posterGroupSlots.endsAt, endsAt)
    ),
    columns: { id: true },
  });
  if (duplicateSlot && duplicateSlot.id !== slotId) {
    return c.json({ error: "This shared slot is already assigned to the group" }, 400);
  }

  const [updated] = await db
    .update(posterGroupSlots)
    .set({
      startsAt,
      endsAt,
      ...(parsed.data.judgeId !== undefined ? { judgeId: parsed.data.judgeId } : {}),
      ...(parsed.data.status ? { status: parsed.data.status } : {}),
      updatedAt: new Date(),
    })
    .where(and(eq(posterGroupSlots.id, slotId), eq(posterGroupSlots.groupId, groupId)))
    .returning();

  return c.json({ slot: updated });
});

app.delete("/poster-groups/:groupId/slots/:slotId", async (c) => {
  const currentUser = c.get("user");
  const { groupId, slotId } = c.req.param();

  const group = await db.query.posterPresentationGroups.findFirst({
    where: eq(posterPresentationGroups.id, groupId),
    columns: { trackId: true },
  });
  if (!group) return c.json({ error: "Not found" }, 404);
  if (!(await canManageTrack(currentUser, group.trackId))) {
    return c.json({ error: "Forbidden" }, 403);
  }

  await db
    .delete(posterGroupSlots)
    .where(and(eq(posterGroupSlots.id, slotId), eq(posterGroupSlots.groupId, groupId)));

  return c.json({ ok: true });
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
