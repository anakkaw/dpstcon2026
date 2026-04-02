import { OpenAPIHono } from "@hono/zod-openapi";
import { db } from "@/server/db";
import { tracks, user, userRoles, submissions } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import { authMiddleware } from "../middleware/auth";
import { requireRole } from "../middleware/auth";
import type { AuthEnv } from "../middleware/auth";
import { z } from "zod";
import { getTrackProgramChairs, syncTrackProgramChairs } from "@/server/track-chairs";

const app = new OpenAPIHono<AuthEnv>();

app.use("/*", authMiddleware);
app.use("/*", requireRole("ADMIN"));

// GET /api/tracks — list all tracks with head user info
app.get("/", async (c) => {
  const allTracks = await db.select().from(tracks);
  const chairsByTrackId = await getTrackProgramChairs(allTracks.map((track) => track.id));

  return c.json({
    tracks: allTracks.map((track) => {
      const chairs = chairsByTrackId.get(track.id) ?? [];
      return {
        ...track,
        chairUserIds: chairs.map((chair) => chair.id),
        chairs,
      };
    }),
  });
});

// POST /api/tracks — create a new track
const createSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  chairUserIds: z.array(z.string()).optional(),
  headUserId: z.string().optional(),
});

app.post("/", async (c) => {
  const body = await c.req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: "Validation error" }, 400);

  const chairUserIds = Array.from(
    new Set((parsed.data.chairUserIds ?? []).concat(parsed.data.headUserId ?? []).filter(Boolean))
  );

  // Validate chair users if provided
  for (const chairUserId of chairUserIds) {
    const chairUser = await db.query.user.findFirst({ where: eq(user.id, chairUserId) });
    if (!chairUser) return c.json({ error: "User not found" }, 404);
  }

  const [newTrack] = await db
    .insert(tracks)
    .values({
      name: parsed.data.name,
      description: parsed.data.description ?? null,
      headUserId: chairUserIds[0] ?? null,
    })
    .returning();

  await syncTrackProgramChairs(newTrack.id, chairUserIds);

  return c.json({ track: newTrack }, 201);
});

// PATCH /api/tracks/:id — update a track
const updateSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  chairUserIds: z.array(z.string()).optional(),
  headUserId: z.string().nullable().optional(),
});

app.patch("/:id", async (c) => {
  const { id } = c.req.param();
  const body = await c.req.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: "Validation error" }, 400);

  const existing = await db.query.tracks.findFirst({ where: eq(tracks.id, id) });
  if (!existing) return c.json({ error: "Track not found" }, 404);

  const chairUserIds =
    parsed.data.chairUserIds !== undefined || parsed.data.headUserId !== undefined
      ? Array.from(
          new Set(
            (parsed.data.chairUserIds ?? []).concat(
              parsed.data.headUserId ? [parsed.data.headUserId] : []
            )
          )
        )
      : undefined;

  if (chairUserIds) {
    for (const chairUserId of chairUserIds) {
      const chairUser = await db.query.user.findFirst({ where: eq(user.id, chairUserId) });
      if (!chairUser) return c.json({ error: "User not found" }, 404);
    }
  }

  const updateData: Record<string, unknown> = {};
  if (parsed.data.name !== undefined) updateData.name = parsed.data.name;
  if (parsed.data.description !== undefined) updateData.description = parsed.data.description;
  if (chairUserIds !== undefined) updateData.headUserId = chairUserIds[0] ?? null;

  const [updated] = await db.update(tracks).set(updateData).where(eq(tracks.id, id)).returning();
  if (chairUserIds !== undefined) {
    await syncTrackProgramChairs(id, chairUserIds);
  }
  return c.json({ track: updated });
});

// DELETE /api/tracks/:id — delete a track
app.delete("/:id", async (c) => {
  const { id } = c.req.param();

  const existing = await db.query.tracks.findFirst({ where: eq(tracks.id, id) });
  if (!existing) return c.json({ error: "Track not found" }, 404);

  // Check if track has submissions
  const trackSubmissions = await db.query.submissions.findFirst({
    where: eq(submissions.trackId, id),
  });
  if (trackSubmissions) {
    return c.json({ error: "Cannot delete track with existing submissions" }, 400);
  }

  await syncTrackProgramChairs(id, []);

  // Clean up userRoles scoped to this track (REVIEWER, COMMITTEE)
  await db.delete(userRoles).where(eq(userRoles.trackId, id));

  // trackMembers will cascade on delete
  await db.delete(tracks).where(eq(tracks.id, id));

  return c.json({ ok: true });
});
export { app as trackRoutes };
