import { OpenAPIHono } from "@hono/zod-openapi";
import { db } from "@/server/db";
import { trackMembers, tracks, user, userRoles } from "@/server/db/schema";
import { eq, and } from "drizzle-orm";
import { authMiddleware } from "../middleware/auth";
import type { AuthEnv } from "../middleware/auth";
import { z } from "zod";
import { hasRole, getPrimaryRole } from "@/lib/permissions";

const app = new OpenAPIHono<AuthEnv>();

app.use("/*", authMiddleware);

/** Check if user is head of the given track */
async function isTrackHead(userId: string, trackId: string): Promise<boolean> {
  const track = await db.query.tracks.findFirst({
    where: and(eq(tracks.id, trackId), eq(tracks.headUserId, userId)),
  });
  return !!track;
}

// GET /api/track-members/:trackId
app.get("/:trackId", async (c) => {
  const { trackId } = c.req.param();
  const currentUser = c.get("user");

  if (!hasRole(currentUser, "ADMIN") && !(await isTrackHead(currentUser.id, trackId))) {
    return c.json({ error: "Forbidden" }, 403);
  }

  const members = await db.query.trackMembers.findMany({
    where: eq(trackMembers.trackId, trackId),
    with: {
      user: { columns: { id: true, name: true, email: true, role: true, affiliation: true, prefixTh: true, firstNameTh: true, lastNameTh: true, prefixEn: true, firstNameEn: true, lastNameEn: true } },
    },
  });

  return c.json({ members });
});

// POST /api/track-members/:trackId
const addSchema = z.object({
  userId: z.string().min(1),
  role: z.enum(["REVIEWER", "COMMITTEE"]),
});

app.post("/:trackId", async (c) => {
  const { trackId } = c.req.param();
  const currentUser = c.get("user");

  if (!hasRole(currentUser, "ADMIN") && !(await isTrackHead(currentUser.id, trackId))) {
    return c.json({ error: "Forbidden" }, 403);
  }

  const body = await c.req.json();
  const parsed = addSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: "Validation error" }, 400);

  const { userId, role } = parsed.data;

  const track = await db.query.tracks.findFirst({ where: eq(tracks.id, trackId) });
  if (!track) return c.json({ error: "Track not found" }, 404);

  const targetUser = await db.query.user.findFirst({ where: eq(user.id, userId) });
  if (!targetUser) return c.json({ error: "User not found" }, 404);

  const existing = await db.query.trackMembers.findFirst({
    where: and(eq(trackMembers.trackId, trackId), eq(trackMembers.userId, userId)),
  });
  if (existing) return c.json({ error: "User already in this track" }, 409);

  // Add role to user_roles table (instead of overwriting global role)
  const existingRole = await db.query.userRoles.findFirst({
    where: and(eq(userRoles.userId, userId), eq(userRoles.role, role)),
  });

  if (!existingRole) {
    await db.insert(userRoles).values({
      userId,
      role: role as "REVIEWER" | "COMMITTEE",
      trackId,
    });

    // Recalculate primary role
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

  const [member] = await db
    .insert(trackMembers)
    .values({ trackId, userId, role })
    .returning();

  return c.json({ member }, 201);
});

// DELETE /api/track-members/:trackId/:memberId
app.delete("/:trackId/:memberId", async (c) => {
  const { trackId, memberId } = c.req.param();
  const currentUser = c.get("user");

  if (!hasRole(currentUser, "ADMIN") && !(await isTrackHead(currentUser.id, trackId))) {
    return c.json({ error: "Forbidden" }, 403);
  }

  const member = await db.query.trackMembers.findFirst({
    where: and(eq(trackMembers.id, memberId), eq(trackMembers.trackId, trackId)),
  });
  if (!member) return c.json({ error: "Not found" }, 404);

  await db.delete(trackMembers).where(eq(trackMembers.id, memberId));
  return c.json({ ok: true });
});

// GET /api/track-members/:trackId/available
app.get("/:trackId/available", async (c) => {
  const { trackId } = c.req.param();
  const currentUser = c.get("user");

  if (!hasRole(currentUser, "ADMIN") && !(await isTrackHead(currentUser.id, trackId))) {
    return c.json({ error: "Forbidden" }, 403);
  }

  const allUsers = await db
    .select({ id: user.id, name: user.name, email: user.email, role: user.role, affiliation: user.affiliation, prefixTh: user.prefixTh, firstNameTh: user.firstNameTh, lastNameTh: user.lastNameTh, prefixEn: user.prefixEn, firstNameEn: user.firstNameEn, lastNameEn: user.lastNameEn })
    .from(user);

  const existingMembers = await db
    .select({ userId: trackMembers.userId })
    .from(trackMembers)
    .where(eq(trackMembers.trackId, trackId));
  const memberIds = new Set(existingMembers.map((m) => m.userId));

  // With multi-role, anyone can be added to a track (exclude only existing members)
  const available = allUsers.filter((u) => !memberIds.has(u.id));

  return c.json({ users: available });
});

export { app as trackMemberRoutes };
