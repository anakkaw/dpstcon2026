import { OpenAPIHono } from "@hono/zod-openapi";
import { db } from "@/server/db";
import { tracks, user, userRoles, trackMembers, submissions } from "@/server/db/schema";
import { eq, and } from "drizzle-orm";
import { authMiddleware } from "../middleware/auth";
import { requireRole } from "../middleware/auth";
import type { AuthEnv } from "../middleware/auth";
import { z } from "zod";
import { getPrimaryRole } from "@/lib/permissions";

const app = new OpenAPIHono<AuthEnv>();

app.use("/*", authMiddleware);
app.use("/*", requireRole("ADMIN"));

// GET /api/tracks — list all tracks with head user info
app.get("/", async (c) => {
  const allTracks = await db.query.tracks.findMany({
    with: {
      head: {
        columns: {
          id: true,
          name: true,
          email: true,
          prefixTh: true,
          firstNameTh: true,
          lastNameTh: true,
          prefixEn: true,
          firstNameEn: true,
          lastNameEn: true,
        },
      },
    },
  });

  return c.json({ tracks: allTracks });
});

// POST /api/tracks — create a new track
const createSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  headUserId: z.string().optional(),
});

app.post("/", async (c) => {
  const body = await c.req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: "Validation error" }, 400);

  const { name, description, headUserId } = parsed.data;

  // Validate headUserId if provided
  if (headUserId) {
    const headUser = await db.query.user.findFirst({ where: eq(user.id, headUserId) });
    if (!headUser) return c.json({ error: "User not found" }, 404);
  }

  const [newTrack] = await db
    .insert(tracks)
    .values({ name, description: description ?? null, headUserId: headUserId ?? null })
    .returning();

  // Assign PROGRAM_CHAIR role if headUserId provided
  if (headUserId) {
    await assignProgramChairRole(headUserId, newTrack.id);
  }

  return c.json({ track: newTrack }, 201);
});

// PATCH /api/tracks/:id — update a track
const updateSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  headUserId: z.string().nullable().optional(),
});

app.patch("/:id", async (c) => {
  const { id } = c.req.param();
  const body = await c.req.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: "Validation error" }, 400);

  const existing = await db.query.tracks.findFirst({ where: eq(tracks.id, id) });
  if (!existing) return c.json({ error: "Track not found" }, 404);

  const { name, description, headUserId } = parsed.data;

  // Validate new headUserId if provided
  if (headUserId) {
    const headUser = await db.query.user.findFirst({ where: eq(user.id, headUserId) });
    if (!headUser) return c.json({ error: "User not found" }, 404);
  }

  // Handle PROGRAM_CHAIR role change
  if (headUserId !== undefined && headUserId !== existing.headUserId) {
    // Remove old head's PROGRAM_CHAIR role for this track
    if (existing.headUserId) {
      await removeProgramChairRole(existing.headUserId, id);
    }
    // Assign new head's PROGRAM_CHAIR role
    if (headUserId) {
      await assignProgramChairRole(headUserId, id);
    }
  }

  const updateData: Record<string, unknown> = {};
  if (name !== undefined) updateData.name = name;
  if (description !== undefined) updateData.description = description;
  if (headUserId !== undefined) updateData.headUserId = headUserId;

  const [updated] = await db.update(tracks).set(updateData).where(eq(tracks.id, id)).returning();
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

  // Remove PROGRAM_CHAIR role for the head
  if (existing.headUserId) {
    await removeProgramChairRole(existing.headUserId, id);
  }

  // Clean up userRoles scoped to this track (REVIEWER, COMMITTEE)
  await db.delete(userRoles).where(eq(userRoles.trackId, id));

  // trackMembers will cascade on delete
  await db.delete(tracks).where(eq(tracks.id, id));

  return c.json({ ok: true });
});

/** Assign PROGRAM_CHAIR role to a user for a specific track */
async function assignProgramChairRole(userId: string, trackId: string) {
  const existingRole = await db.query.userRoles.findFirst({
    where: and(
      eq(userRoles.userId, userId),
      eq(userRoles.role, "PROGRAM_CHAIR"),
      eq(userRoles.trackId, trackId)
    ),
  });

  if (!existingRole) {
    await db.insert(userRoles).values({
      userId,
      role: "PROGRAM_CHAIR",
      trackId,
    });
  }

  await recalculatePrimaryRole(userId);
}

/** Remove PROGRAM_CHAIR role from a user for a specific track */
async function removeProgramChairRole(userId: string, trackId: string) {
  await db
    .delete(userRoles)
    .where(
      and(
        eq(userRoles.userId, userId),
        eq(userRoles.role, "PROGRAM_CHAIR"),
        eq(userRoles.trackId, trackId)
      )
    );

  await recalculatePrimaryRole(userId);
}

/** Recalculate and update a user's primary role */
async function recalculatePrimaryRole(userId: string) {
  const allRoles = await db
    .select({ role: userRoles.role })
    .from(userRoles)
    .where(eq(userRoles.userId, userId));

  const primaryRole = getPrimaryRole(allRoles.map((r) => r.role));
  await db
    .update(user)
    .set({
      role: primaryRole as "ADMIN" | "PROGRAM_CHAIR" | "REVIEWER" | "COMMITTEE" | "AUTHOR",
      updatedAt: new Date(),
    })
    .where(eq(user.id, userId));
}

export { app as trackRoutes };
