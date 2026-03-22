import { OpenAPIHono } from "@hono/zod-openapi";
import { db } from "@/server/db";
import { notifications } from "@/server/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { authMiddleware } from "../middleware/auth";
import type { AuthEnv } from "../middleware/auth";

const app = new OpenAPIHono<AuthEnv>();

app.use("/*", authMiddleware);

// GET /api/notifications — list notifications
app.get("/", async (c) => {
  const currentUser = c.get("user");

  const items = await db
    .select()
    .from(notifications)
    .where(eq(notifications.userId, currentUser.id))
    .orderBy(desc(notifications.createdAt))
    .limit(50);

  return c.json({ notifications: items });
});

// PATCH /api/notifications/:id/read — mark as read
app.patch("/:id/read", async (c) => {
  const { id } = c.req.param();
  const currentUser = c.get("user");

  await db
    .update(notifications)
    .set({ isRead: true })
    .where(
      and(eq(notifications.id, id), eq(notifications.userId, currentUser.id))
    );

  return c.json({ ok: true });
});

// PATCH /api/notifications/read-all — mark all as read
app.patch("/read-all", async (c) => {
  const currentUser = c.get("user");

  await db
    .update(notifications)
    .set({ isRead: true })
    .where(
      and(
        eq(notifications.userId, currentUser.id),
        eq(notifications.isRead, false)
      )
    );

  return c.json({ ok: true });
});

export { app as notificationRoutes };
