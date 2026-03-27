import { OpenAPIHono } from "@hono/zod-openapi";
import { inArray } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/server/db";
import { settings } from "@/server/db/schema";
import { authMiddleware, requireRole } from "../middleware/auth";
import type { AuthEnv } from "../middleware/auth";

const app = new OpenAPIHono<AuthEnv>();

app.use("/*", authMiddleware);

const DEADLINE_KEYS = [
  "submissionDeadline",
  "reviewDeadline",
  "cameraReadyDeadline",
  "notificationDate",
  "submissionDeadlineLabel",
  "reviewDeadlineLabel",
  "cameraReadyDeadlineLabel",
  "notificationDateLabel",
] as const;

const deadlineSchema = z.object({
  submissionDeadline: z.string().nullable().optional(),
  reviewDeadline: z.string().nullable().optional(),
  cameraReadyDeadline: z.string().nullable().optional(),
  notificationDate: z.string().nullable().optional(),
  submissionDeadlineLabel: z.string().nullable().optional(),
  reviewDeadlineLabel: z.string().nullable().optional(),
  cameraReadyDeadlineLabel: z.string().nullable().optional(),
  notificationDateLabel: z.string().nullable().optional(),
});

app.get("/deadlines", async (c) => {
  const rows = await db
    .select({
      key: settings.key,
      value: settings.value,
    })
    .from(settings)
    .where(inArray(settings.key, [...DEADLINE_KEYS]));

  const deadlines = Object.fromEntries(
    rows
      .filter((row) => typeof row.value === "string")
      .map((row) => [row.key, row.value])
  );

  return c.json({ deadlines });
});

app.put("/deadlines", requireRole("ADMIN", "PROGRAM_CHAIR"), async (c) => {
  const body = await c.req.json();
  const parsed = deadlineSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: "Validation error" }, 400);

  const now = new Date();
  const entries = Object.entries(parsed.data).filter(([, value]) => value != null);

  await Promise.all(
    entries.map(([key, value]) =>
      db
        .insert(settings)
        .values({
          key,
          value,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: settings.key,
          set: {
            value,
            updatedAt: now,
          },
        })
    )
  );

  const rows = await db
    .select({
      key: settings.key,
      value: settings.value,
    })
    .from(settings)
    .where(inArray(settings.key, [...DEADLINE_KEYS]));

  const deadlines = Object.fromEntries(
    rows
      .filter((row) => typeof row.value === "string")
      .map((row) => [row.key, row.value])
  );

  return c.json({ deadlines });
});

export { app as settingsRoutes };
