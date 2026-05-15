import { OpenAPIHono } from "@hono/zod-openapi";
import { db } from "@/server/db";
import {
  presentationAssignments,
  presentationCommitteeAssignments,
  presentationEvaluations,
  posterSlotJudges,
  notifications,
  settings,
  submissions,
  userRoles,
} from "@/server/db/schema";
import { and, desc, eq, gt, inArray, isNull, lt, ne, or } from "drizzle-orm";
import { authMiddleware } from "../middleware/auth";
import type { AuthEnv } from "../middleware/auth";
import { z } from "zod";
import { getTrackRoleIds, hasTrackRole, hasRole } from "@/lib/permissions";
import { parseScheduledAt } from "@/lib/conference-tz";
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
import {
  PUBLISHED_POSTER_SLOT_STATUSES,
  PUBLISHED_PRESENTATION_STATUSES,
  isPublishedPresentationStatus,
} from "@/lib/presentation-status";

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

async function findPosterJudgeTimeConflict(input: {
  judgeId: string;
  startsAt: Date;
  endsAt: Date;
  excludeSlotId?: string;
}) {
  return db.query.posterSlotJudges.findFirst({
    where: and(
      eq(posterSlotJudges.judgeId, input.judgeId),
      lt(posterSlotJudges.startsAt, input.endsAt),
      gt(posterSlotJudges.endsAt, input.startsAt),
      input.excludeSlotId ? ne(posterSlotJudges.id, input.excludeSlotId) : undefined
    ),
    with: {
      submission: {
        columns: { paperCode: true, title: true },
      },
    },
  });
}

function formatScheduleSummary(input: {
  scheduledAt: Date | null;
  room: string | null;
  duration: number | null;
}) {
  const dateText = input.scheduledAt
    ? new Intl.DateTimeFormat("th-TH", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "Asia/Bangkok",
      }).format(input.scheduledAt)
    : "รอระบุเวลา";
  const roomText = input.room ? ` ห้อง ${input.room}` : "";
  const durationText = input.duration ? ` (${input.duration} นาที)` : "";
  return `${dateText}${roomText}${durationText}`;
}

function paperLabel(input: { paperCode: string | null; title: string }) {
  return input.paperCode ? `${input.paperCode} · ${input.title}` : input.title;
}

function posterSlotWindow<T extends { startsAt: Date; endsAt: Date }>(slots: T[]) {
  const sortedSlots = slots
    .slice()
    .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
  const firstSlot = sortedSlots[0];
  if (!firstSlot) {
    throw new Error("posterSlotWindow requires at least one slot");
  }
  const lastSlot = sortedSlots.reduce((latest, slot) =>
    slot.endsAt > latest.endsAt ? slot : latest
  );

  return {
    sortedSlots,
    scheduledAt: firstSlot.startsAt,
    duration: Math.max(
      1,
      Math.round((lastSlot.endsAt.getTime() - firstSlot.startsAt.getTime()) / 60000)
    ),
  };
}

async function createPresentationNotifications(
  items: Array<{
    userId: string;
    type?: "ASSIGNMENT" | "SYSTEM";
    title: string;
    message: string;
    linkUrl: string;
  }>
) {
  const deduped = new Map<string, (typeof items)[number]>();
  for (const item of items) {
    deduped.set(
      `${item.userId}:${item.title}:${item.message}:${item.linkUrl}`,
      item
    );
  }

  const values = Array.from(deduped.values());
  if (values.length === 0) return 0;

  await db.insert(notifications).values(
    values.map((item) => ({
      userId: item.userId,
      type: item.type ?? "SYSTEM",
      title: item.title,
      message: item.message,
      linkUrl: item.linkUrl,
      isRead: false,
    }))
  );

  return values.length;
}

async function notifyOralSchedulePublished(presentationId: string) {
  const presentation = await db.query.presentationAssignments.findFirst({
    where: eq(presentationAssignments.id, presentationId),
    with: {
      submission: {
        columns: { id: true, authorId: true, title: true, paperCode: true },
      },
      committeeAssignments: true,
    },
  });

  if (!presentation) return 0;

  const label = paperLabel(presentation.submission);
  const summary = formatScheduleSummary({
    scheduledAt: presentation.scheduledAt,
    room: presentation.room,
    duration: presentation.duration,
  });

  return createPresentationNotifications([
    {
      userId: presentation.submission.authorId,
      title: "เผยแพร่ตารางนำเสนอแล้ว",
      message: `ตารางนำเสนอแบบบรรยายของ "${label}" เผยแพร่แล้ว: ${summary}`,
      linkUrl: "/presentations?tab=oral",
    },
    ...presentation.committeeAssignments.map((assignment) => ({
      userId: assignment.judgeId,
      type: "ASSIGNMENT" as const,
      title: "ได้รับมอบหมายประเมินการนำเสนอ",
      message: `คุณได้รับมอบหมายประเมิน "${label}" แบบบรรยาย: ${summary}`,
      linkUrl: "/presentations/scoring",
    })),
  ]);
}

async function markPosterPresentationDraft(submissionId: string) {
  await db
    .update(presentationAssignments)
    .set({ status: "PENDING" })
    .where(
      and(
        eq(presentationAssignments.submissionId, submissionId),
        eq(presentationAssignments.type, "POSTER"),
        ne(presentationAssignments.status, "COMPLETED")
      )
    );
}

async function markAllPosterSchedulesDraft() {
  const now = new Date();
  await Promise.all([
    db
      .update(presentationAssignments)
      .set({ status: "PENDING" })
      .where(
        and(
          eq(presentationAssignments.type, "POSTER"),
          ne(presentationAssignments.status, "COMPLETED")
        )
      ),
    db
      .update(posterSlotJudges)
      .set({ status: "PLANNED", updatedAt: now })
      .where(ne(posterSlotJudges.status, "COMPLETED")),
  ]);
}

function sessionSettingsChanged(
  before: Awaited<ReturnType<typeof getPosterSessionSettings>>,
  after: Awaited<ReturnType<typeof getPosterSessionSettings>>
) {
  return (
    before.room !== after.room ||
    JSON.stringify(before.slotTemplates) !== JSON.stringify(after.slotTemplates)
  );
}

async function isValidPosterJudgeForSubmission(input: {
  judgeId: string;
  submissionTrackId: string | null;
}) {
  const judgeRole = await db.query.userRoles.findFirst({
    where: and(
      eq(userRoles.userId, input.judgeId),
      eq(userRoles.role, "COMMITTEE"),
      input.submissionTrackId
        ? or(isNull(userRoles.trackId), eq(userRoles.trackId, input.submissionTrackId))
        : isNull(userRoles.trackId)
    ),
  });

  return Boolean(judgeRole);
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
            inArray(
              presentationAssignments.status,
              PUBLISHED_PRESENTATION_STATUSES
            ),
            typeFilter
              ? eq(presentationAssignments.type, typeFilter)
              : undefined
          )
        );

      assignedRows.forEach((row) => presentationIds.add(row.id));

      if (!typeFilter || typeFilter === "POSTER") {
        const posterRows = await db
          .select({ id: presentationAssignments.id })
          .from(posterSlotJudges)
          .innerJoin(
            presentationAssignments,
            and(
              eq(posterSlotJudges.submissionId, presentationAssignments.submissionId),
              eq(presentationAssignments.type, "POSTER")
            )
          )
          .where(
            and(
              eq(posterSlotJudges.judgeId, currentUser.id),
              inArray(posterSlotJudges.status, PUBLISHED_POSTER_SLOT_STATUSES),
              inArray(presentationAssignments.status, PUBLISHED_PRESENTATION_STATUSES)
            )
          );
        posterRows.forEach((row) => presentationIds.add(row.id));
      }
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
            inArray(
              presentationAssignments.status,
              PUBLISHED_PRESENTATION_STATUSES
            ),
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
        status: "PENDING",
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
      status: "PENDING",
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
      status: "PENDING",
    })
    .where(eq(presentationAssignments.id, id))
    .returning();

  if (!updated) return c.json({ error: "Not found" }, 404);
  return c.json({ presentation: updated });
});

app.post("/:id/publish", async (c) => {
  const currentUser = c.get("user");
  const { id } = c.req.param();

  if (!hasRole(currentUser, "ADMIN")) {
    return c.json({ error: "Forbidden" }, 403);
  }

  const presentation = await db.query.presentationAssignments.findFirst({
    where: eq(presentationAssignments.id, id),
    columns: {
      id: true,
      type: true,
      status: true,
      scheduledAt: true,
      submissionId: true,
    },
  });

  if (!presentation) return c.json({ error: "Not found" }, 404);
  if (presentation.type === "POSTER") {
    return c.json(
      { error: "Use the poster planner publish action for poster schedules" },
      400
    );
  }
  if (!presentation.scheduledAt) {
    return c.json({ error: "Please set the presentation time before publishing" }, 400);
  }

  let notificationCount = 0;
  if (!isPublishedPresentationStatus(presentation.status)) {
    await db
      .update(presentationAssignments)
      .set({ status: "SCHEDULED" })
      .where(eq(presentationAssignments.id, id));
    notificationCount = await notifyOralSchedulePublished(id);
  }

  return c.json({ ok: true, notificationCount });
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
    columns: { submissionId: true, type: true },
  });
  if (!presentation) return c.json({ error: "Not found" }, 404);
  if (presentation.type === "POSTER") {
    return c.json(
      { error: "Use the poster planner to assign judges to poster presentations" },
      400
    );
  }

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
          or(isNull(userRoles.trackId), eq(userRoles.trackId, submission.trackId))
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

  await db
    .update(presentationAssignments)
    .set({ status: "PENDING" })
    .where(
      and(
        eq(presentationAssignments.id, id),
        ne(presentationAssignments.status, "COMPLETED")
      )
    );

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

app.post("/poster-publish", async (c) => {
  const currentUser = c.get("user");
  if (!hasRole(currentUser, "ADMIN")) {
    return c.json({ error: "Forbidden" }, 403);
  }

  const body = await c.req.json();
  const schema = z.object({
    trackId: z.string().uuid(),
  });

  const parsed = schema.safeParse(body);
  if (!parsed.success) return c.json({ error: "Validation error" }, 400);

  const [sessionSettings, posterRows] = await Promise.all([
    getPosterSessionSettings(),
    db.query.presentationAssignments.findMany({
      where: eq(presentationAssignments.type, "POSTER"),
      with: {
        submission: {
          columns: {
            id: true,
            authorId: true,
            title: true,
            paperCode: true,
            trackId: true,
          },
          with: {
            posterSlotJudges: {
              with: {
                judge: { columns: { id: true, name: true } },
              },
            },
          },
        },
      },
    }),
  ]);

  const targetRows = posterRows.filter(
    (row) =>
      row.submission.trackId === parsed.data.trackId &&
      !isPublishedPresentationStatus(row.status) &&
      row.submission.posterSlotJudges.length > 0
  );

  if (targetRows.length === 0) {
    return c.json(
      { error: "No draft poster assignments with judge slots were found for this track" },
      400
    );
  }

  const now = new Date();
  await Promise.all(
    targetRows.map((row) => {
      const { scheduledAt, duration } = posterSlotWindow(row.submission.posterSlotJudges);

      return db
        .update(presentationAssignments)
        .set({
          status: "SCHEDULED",
          scheduledAt,
          room: sessionSettings.room || null,
          duration,
        })
        .where(eq(presentationAssignments.id, row.id));
    })
  );

  const slotIds = targetRows.flatMap((row) =>
    row.submission.posterSlotJudges
      .filter((slot) => slot.status !== "COMPLETED")
      .map((slot) => slot.id)
  );

  if (slotIds.length > 0) {
    await db
      .update(posterSlotJudges)
      .set({ status: "CONFIRMED", updatedAt: now })
      .where(inArray(posterSlotJudges.id, slotIds));
  }

  const notificationsToCreate: Parameters<typeof createPresentationNotifications>[0] = [];
  for (const row of targetRows) {
    const label = paperLabel(row.submission);
    const { sortedSlots, scheduledAt, duration } = posterSlotWindow(row.submission.posterSlotJudges);
    const authorSummary = formatScheduleSummary({
      scheduledAt,
      room: sessionSettings.room || null,
      duration,
    });

    notificationsToCreate.push({
      userId: row.submission.authorId,
      title: "เผยแพร่ตารางนำเสนอแล้ว",
      message: `ตารางนำเสนอแบบโปสเตอร์ของ "${label}" เผยแพร่แล้ว: ${authorSummary}`,
      linkUrl: "/presentations?tab=poster",
    });

    for (const slot of sortedSlots) {
      const slotSummary = formatScheduleSummary({
        scheduledAt: slot.startsAt,
        room: sessionSettings.room || null,
        duration: Math.max(
          1,
          Math.round((slot.endsAt.getTime() - slot.startsAt.getTime()) / 60000)
        ),
      });
      notificationsToCreate.push({
        userId: slot.judgeId,
        type: "ASSIGNMENT",
        title: "ได้รับมอบหมายตรวจโปสเตอร์",
        message: `คุณได้รับมอบหมายตรวจ "${label}" แบบโปสเตอร์: ${slotSummary}`,
        linkUrl: "/presentations/scoring",
      });
    }
  }

  const notificationCount = await createPresentationNotifications(notificationsToCreate);

  return c.json({
    ok: true,
    publishedCount: targetRows.length,
    notificationCount,
  });
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

  // Verify the judge actually has a COMMITTEE role (optionally scoped to the submission's track)
  const submission = await db.query.submissions.findFirst({
    where: eq(submissions.id, parsed.data.submissionId),
    columns: { trackId: true },
  });

  const isValidJudge = await isValidPosterJudgeForSubmission({
    judgeId: parsed.data.judgeId,
    submissionTrackId: submission?.trackId ?? null,
  });

  if (!isValidJudge) {
    return c.json({ error: "Selected user is not a committee member" }, 400);
  }

  const conflict = await findPosterJudgeTimeConflict({
    judgeId: parsed.data.judgeId,
    startsAt,
    endsAt,
  });
  if (conflict) {
    return c.json(
      {
        error: "JUDGE_TIME_CONFLICT",
        message: `Judge already has a poster slot at this time (${conflict.submission.paperCode ?? conflict.submission.title})`,
      },
      409
    );
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

  await markPosterPresentationDraft(parsed.data.submissionId);

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
    columns: { submissionId: true, startsAt: true, endsAt: true },
  });
  if (!existing) return c.json({ error: "Not found" }, 404);
  if (!(await canManageSubmissionPresentation(currentUser, existing.submissionId))) {
    return c.json({ error: "Forbidden" }, 403);
  }

  if (parsed.data.judgeId) {
    const submission = await db.query.submissions.findFirst({
      where: eq(submissions.id, existing.submissionId),
      columns: { trackId: true },
    });
    const isValidJudge = await isValidPosterJudgeForSubmission({
      judgeId: parsed.data.judgeId,
      submissionTrackId: submission?.trackId ?? null,
    });
    if (!isValidJudge) {
      return c.json({ error: "Selected user is not a committee member" }, 400);
    }

    const conflict = await findPosterJudgeTimeConflict({
      judgeId: parsed.data.judgeId,
      startsAt: existing.startsAt,
      endsAt: existing.endsAt,
      excludeSlotId: slotId,
    });
    if (conflict) {
      return c.json(
        {
          error: "JUDGE_TIME_CONFLICT",
          message: `Judge already has a poster slot at this time (${conflict.submission.paperCode ?? conflict.submission.title})`,
        },
        409
      );
    }
  }

  const slotUpdates: {
    judgeId?: string;
    status?: "PLANNED" | "CONFIRMED" | "COMPLETED";
    updatedAt: Date;
  } = { updatedAt: new Date() };

  if (parsed.data.judgeId) {
    slotUpdates.judgeId = parsed.data.judgeId;
    slotUpdates.status = "PLANNED";
  } else if (parsed.data.status) {
    slotUpdates.status = parsed.data.status;
  }

  const [updated] = await db
    .update(posterSlotJudges)
    .set(slotUpdates)
    .where(eq(posterSlotJudges.id, slotId))
    .returning();

  if (parsed.data.judgeId || parsed.data.status === "PLANNED") {
    await markPosterPresentationDraft(existing.submissionId);
  }

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
  await markPosterPresentationDraft(existing.submissionId);

  return c.json({ ok: true });
});

app.put("/poster-session", async (c) => {
  const currentUser = c.get("user");
  if (!hasRole(currentUser, "ADMIN")) {
    return c.json({ error: "Forbidden" }, 403);
  }

  const body = await c.req.json();
  const parsed = posterSessionSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: "Validation error" }, 400);

  const before = await getPosterSessionSettings();
  const normalized = normalizePosterSlotTemplates(parsed.data.slotTemplates);
  if (normalized.length !== parsed.data.slotTemplates.length) {
    return c.json({ error: "Invalid slot template range" }, 400);
  }

  const sessionSettings = await savePosterSessionSettings({
    room: parsed.data.room ?? "",
    slotTemplates: parsed.data.slotTemplates,
  });

  if (sessionSettingsChanged(before, sessionSettings)) {
    await markAllPosterSchedulesDraft();
  }

  return c.json({ sessionSettings });
});

// H5: Verify user is an assigned committee judge before allowing evaluation
app.post("/:id/evaluations", async (c) => {
  const { id } = c.req.param();
  const currentUser = c.get("user");
  const body = await c.req.json();

  const schema = z.object({
    scores: z.record(z.string(), z.number().finite()),
    comments: z.string().optional(),
  });
  const parsed = schema.safeParse(body);
  if (!parsed.success) return c.json({ error: "Validation error" }, 400);

  const isAdmin = hasRole(currentUser, "ADMIN");

  const presentation = await db.query.presentationAssignments.findFirst({
    where: eq(presentationAssignments.id, id),
    columns: { submissionId: true, type: true, status: true },
  });
  if (!presentation) return c.json({ error: "Not found" }, 404);

  if (!isAdmin) {
    if (!isPublishedPresentationStatus(presentation.status)) {
      return c.json({ error: "SCHEDULE_NOT_PUBLISHED" }, 403);
    }

    const committeeAssignment = await db.query.presentationCommitteeAssignments.findFirst({
      where: and(
        eq(presentationCommitteeAssignments.presentationId, id),
        eq(presentationCommitteeAssignments.judgeId, currentUser.id)
      ),
    });

    let posterSlotAssignment = null;
    if (!committeeAssignment && presentation.type === "POSTER") {
      posterSlotAssignment = await db.query.posterSlotJudges.findFirst({
        where: and(
          eq(posterSlotJudges.submissionId, presentation.submissionId),
          eq(posterSlotJudges.judgeId, currentUser.id),
          inArray(posterSlotJudges.status, PUBLISHED_POSTER_SLOT_STATUSES)
        ),
      });
    }

    if (!committeeAssignment && !posterSlotAssignment) {
      return c.json({ error: "NOT_ASSIGNED" }, 403);
    }
  }

  // Validate score keys and values against the rubric
  const rubric = await getPresentationRubric(presentation.type as "ORAL" | "POSTER");
  const rubricMap = new Map(rubric.map((c) => [c.id, c.totalPoints]));
  for (const [criterionId, value] of Object.entries(parsed.data.scores)) {
    const max = rubricMap.get(criterionId);
    if (max === undefined) {
      return c.json({ error: "UNKNOWN_CRITERION", criterionId }, 400);
    }
    if (value < 0 || value > max) {
      return c.json({ error: "SCORE_OUT_OF_RANGE", criterionId, max }, 400);
    }
  }

  const updates: { scores: Record<string, number>; comments?: string; updatedAt: Date } = {
    scores: parsed.data.scores,
    updatedAt: new Date(),
  };
  if (parsed.data.comments !== undefined) {
    updates.comments = parsed.data.comments;
  }

  const existing = await db.query.presentationEvaluations.findFirst({
    where: and(eq(presentationEvaluations.presentationId, id), eq(presentationEvaluations.judgeId, currentUser.id)),
  });

  if (existing) {
    await db
      .update(presentationEvaluations)
      .set(updates)
      .where(eq(presentationEvaluations.id, existing.id));
    return c.json({ ok: true, updated: true });
  }

  try {
    const [evaluation] = await db
      .insert(presentationEvaluations)
      .values({
        presentationId: id,
        judgeId: currentUser.id,
        scores: parsed.data.scores,
        comments: parsed.data.comments,
      })
      .returning();
    return c.json({ evaluation }, 201);
  } catch (error) {
    const message = (error as { message?: string })?.message ?? "";
    if (message.includes("pres_evaluations_presentation_judge_unique")) {
      return c.json({ error: "ALREADY_SUBMITTED" }, 409);
    }
    throw error;
  }
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
  const [evaluations, oralCriteria, posterCriteria] = await Promise.all([
    presentationIds.length > 0
      ? db.query.presentationEvaluations.findMany({
          where: inArray(presentationEvaluations.presentationId, presentationIds),
          with: { judge: { columns: { id: true, name: true } } },
        })
      : Promise.resolve([]),
    getPresentationRubric("ORAL"),
    getPresentationRubric("POSTER"),
  ]);

  const scoresByPresentation: Record<string, (typeof evaluations)[number][]> = {};
  for (const ev of evaluations) {
    if (!scoresByPresentation[ev.presentationId]) scoresByPresentation[ev.presentationId] = [];
    scoresByPresentation[ev.presentationId].push(ev);
  }

  return c.json({
    presentations: presentations.map((p) => ({ ...p, evaluations: scoresByPresentation[p.id] || [] })),
    criteria: oralCriteria, // kept for backward compatibility
    criteriaByType: { ORAL: oralCriteria, POSTER: posterCriteria },
  });
});

export { app as presentationRoutes };
