import { OpenAPIHono } from "@hono/zod-openapi";
import { db } from "@/server/db";
import {
  user,
  submissions,
  userRoles,
  notifications,
  reviewAssignments,
  session as sessionTable,
  account as accountTable,
} from "@/server/db/schema";
import { eq, and, ilike, or, desc, inArray } from "drizzle-orm";
import { authMiddleware, requireRole } from "../middleware/auth";
import { z } from "zod";
import { queueEmail, inviteEmail } from "@/server/email";
import { getPrimaryRole } from "@/lib/permissions";

const INVITE_EXPIRY_HOURS = 72;

const app = new OpenAPIHono();

app.use("/*", authMiddleware);

// GET /api/users — list users (ADMIN)
app.get("/", requireRole("ADMIN"), async (c) => {
  const search = c.req.query("search");
  const role = c.req.query("role");

  let whereClause;
  if (search) {
    whereClause = or(
      ilike(user.name, `%${search}%`),
      ilike(user.email, `%${search}%`)
    );
  }

  const users = await db
    .select()
    .from(user)
    .where(whereClause)
    .orderBy(desc(user.createdAt));

  // Load roles for all users
  const allUserIds = users.map((u) => u.id);
  const allRoles =
    allUserIds.length > 0
      ? await db
          .select({
            userId: userRoles.userId,
            role: userRoles.role,
            trackId: userRoles.trackId,
          })
          .from(userRoles)
          .where(inArray(userRoles.userId, allUserIds))
      : [];

  const rolesMap = new Map<string, string[]>();
  for (const r of allRoles) {
    const existing = rolesMap.get(r.userId) || [];
    existing.push(r.role);
    rolesMap.set(r.userId, existing);
  }

  const usersWithRoles = users.map((u) => ({
    ...u,
    roles: rolesMap.get(u.id) || [u.role],
  }));

  // Filter by role if specified
  const filtered = role
    ? usersWithRoles.filter((u) => u.roles.includes(role))
    : usersWithRoles;

  return c.json({ users: filtered });
});

// GET /api/users/me/roles — get current user's roles (any authenticated user)
app.get("/me/roles", async (c) => {
  const currentUser = c.get("user" as never) as { id: string; roles: string[] };
  return c.json({ roles: currentUser.roles });
});

// GET /api/users/:id — user detail (ADMIN)
app.get("/:id", requireRole("ADMIN"), async (c) => {
  const { id } = c.req.param();

  const found = await db.query.user.findFirst({
    where: eq(user.id, id),
  });

  if (!found) return c.json({ error: "User not found" }, 404);

  // Load roles
  const roles = await db
    .select({ role: userRoles.role, trackId: userRoles.trackId })
    .from(userRoles)
    .where(eq(userRoles.userId, id));

  return c.json({
    user: {
      ...found,
      roles: roles.length > 0 ? roles.map((r) => r.role) : [found.role],
    },
  });
});

// PATCH /api/users/:id — update user profile (ADMIN)
app.patch("/:id", requireRole("ADMIN"), async (c) => {
  const { id } = c.req.param();
  const body = await c.req.json();

  const schema = z.object({
    name: z.string().optional(),
    nameEn: z.string().optional(),
    affiliation: z.string().optional(),
    bio: z.string().optional(),
  });

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Validation error" }, 400);
  }

  const [updated] = await db
    .update(user)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(user.id, id))
    .returning();

  return c.json({ user: updated });
});

// PATCH /api/users/:id/roles — update roles (ADMIN, multi-role)
app.patch("/:id/roles", requireRole("ADMIN"), async (c) => {
  const { id } = c.req.param();
  const body = await c.req.json();

  const schema = z.object({
    roles: z
      .array(
        z.enum(["ADMIN", "PROGRAM_CHAIR", "REVIEWER", "COMMITTEE", "AUTHOR"])
      )
      .min(1, "ต้องมีอย่างน้อย 1 บทบาท"),
  });

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Invalid roles" }, 400);
  }

  // Delete existing roles and re-insert
  await db.delete(userRoles).where(eq(userRoles.userId, id));

  await db.insert(userRoles).values(
    parsed.data.roles.map((role) => ({
      userId: id,
      role: role as "ADMIN" | "PROGRAM_CHAIR" | "REVIEWER" | "COMMITTEE" | "AUTHOR",
    }))
  );

  // Update primary role on user table for Better Auth compat
  const primaryRole = getPrimaryRole(parsed.data.roles);
  const [updated] = await db
    .update(user)
    .set({
      role: primaryRole as "ADMIN" | "PROGRAM_CHAIR" | "REVIEWER" | "COMMITTEE" | "AUTHOR",
      updatedAt: new Date(),
    })
    .where(eq(user.id, id))
    .returning();

  return c.json({ user: { ...updated, roles: parsed.data.roles } });
});

// POST /api/users — create user with invite (ADMIN)
app.post("/", requireRole("ADMIN"), async (c) => {
  const body = await c.req.json();

  const schema = z.object({
    name: z.string().min(1),
    email: z.string().email(),
    roles: z
      .array(
        z.enum(["ADMIN", "PROGRAM_CHAIR", "REVIEWER", "COMMITTEE", "AUTHOR"])
      )
      .default(["AUTHOR"]),
    affiliation: z.string().optional(),
  });

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      { error: "Validation error", details: parsed.error.flatten() },
      400
    );
  }

  // Check if email already exists
  const existing = await db.query.user.findFirst({
    where: eq(user.email, parsed.data.email),
  });
  if (existing) {
    return c.json({ error: "อีเมลนี้มีในระบบแล้ว" }, 400);
  }

  const inviteToken = crypto.randomUUID();
  const inviteExpiresAt = new Date(
    Date.now() + INVITE_EXPIRY_HOURS * 60 * 60 * 1000
  );
  const primaryRole = getPrimaryRole(parsed.data.roles);

  // Create user directly via Drizzle
  const userId = crypto.randomUUID();
  const [created] = await db
    .insert(user)
    .values({
      id: userId,
      name: parsed.data.name,
      email: parsed.data.email,
      emailVerified: false,
      role: primaryRole as "ADMIN" | "PROGRAM_CHAIR" | "REVIEWER" | "COMMITTEE" | "AUTHOR",
      affiliation: parsed.data.affiliation,
      inviteToken,
      inviteExpiresAt,
      isActive: false,
    })
    .returning();

  // Create credential account without password (will be set on activation)
  await db.insert(accountTable).values({
    id: crypto.randomUUID(),
    accountId: userId,
    providerId: "credential",
    userId,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  // Insert roles
  await db.insert(userRoles).values(
    parsed.data.roles.map((role) => ({
      userId,
      role: role as "ADMIN" | "PROGRAM_CHAIR" | "REVIEWER" | "COMMITTEE" | "AUTHOR",
    }))
  );

  // Send invite email
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const activationUrl = `${appUrl}/activate/${inviteToken}`;
  const emailContent = inviteEmail({
    userName: parsed.data.name,
    activationUrl,
    expiresInHours: INVITE_EXPIRY_HOURS,
  });
  await queueEmail({
    to: parsed.data.email,
    subject: emailContent.subject,
    html: emailContent.html,
  });

  return c.json(
    { user: { ...created, roles: parsed.data.roles } },
    201
  );
});

// POST /api/users/bulk-import — bulk import with invites (ADMIN)
app.post("/bulk-import", requireRole("ADMIN"), async (c) => {
  const body = await c.req.json();

  const schema = z.object({
    users: z.array(
      z.object({
        name: z.string().min(1),
        email: z.string().email(),
        roles: z
          .array(
            z.enum([
              "ADMIN",
              "PROGRAM_CHAIR",
              "REVIEWER",
              "COMMITTEE",
              "AUTHOR",
            ])
          )
          .default(["AUTHOR"]),
        affiliation: z.string().optional(),
      })
    ),
  });

  const parsed = schema.safeParse(body);
  if (!parsed.success) return c.json({ error: "Validation error" }, 400);

  const results: { email: string; status: string }[] = [];
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  // Pre-fetch all existing users by email in a single query to avoid N+1
  const importEmails = parsed.data.users.map((u) => u.email);
  const existingUsers = importEmails.length > 0
    ? await db.select().from(user).where(inArray(user.email, importEmails))
    : [];
  const existingByEmail = new Map(existingUsers.map((u) => [u.email, u]));

  // Pre-fetch all roles for existing users in a single query
  const existingUserIds = existingUsers.map((u) => u.id);
  const existingRolesAll = existingUserIds.length > 0
    ? await db.select({ userId: userRoles.userId, role: userRoles.role }).from(userRoles).where(inArray(userRoles.userId, existingUserIds))
    : [];
  const existingRolesMap = new Map<string, Set<string>>();
  for (const r of existingRolesAll) {
    if (!existingRolesMap.has(r.userId)) existingRolesMap.set(r.userId, new Set());
    existingRolesMap.get(r.userId)!.add(r.role);
  }

  // Collect batch inserts for new users
  const newUserInserts: typeof user.$inferInsert[] = [];
  const newAccountInserts: typeof accountTable.$inferInsert[] = [];
  const newRoleInserts: typeof userRoles.$inferInsert[] = [];
  const emailsToSend: { to: string; subject: string; html: string }[] = [];

  for (const u of parsed.data.users) {
    try {
      const existing = existingByEmail.get(u.email);

      if (existing) {
        const existingRoleSet = existingRolesMap.get(existing.id) || new Set();
        const newRoles = u.roles.filter((r) => !existingRoleSet.has(r));
        if (newRoles.length > 0) {
          await db.insert(userRoles).values(
            newRoles.map((role) => ({
              userId: existing.id,
              role: role as "ADMIN" | "PROGRAM_CHAIR" | "REVIEWER" | "COMMITTEE" | "AUTHOR",
            }))
          );
          const allRoles = [...existingRoleSet, ...newRoles];
          const primaryRole = getPrimaryRole(allRoles);
          await db
            .update(user)
            .set({
              role: primaryRole as "ADMIN" | "PROGRAM_CHAIR" | "REVIEWER" | "COMMITTEE" | "AUTHOR",
              updatedAt: new Date(),
            })
            .where(eq(user.id, existing.id));
        }
        results.push({ email: u.email, status: "updated_roles" });
        continue;
      }

      const inviteToken = crypto.randomUUID();
      const inviteExpiresAt = new Date(
        Date.now() + INVITE_EXPIRY_HOURS * 60 * 60 * 1000
      );
      const primaryRole = getPrimaryRole(u.roles);
      const userId = crypto.randomUUID();

      newUserInserts.push({
        id: userId,
        name: u.name,
        email: u.email,
        emailVerified: false,
        role: primaryRole as "ADMIN" | "PROGRAM_CHAIR" | "REVIEWER" | "COMMITTEE" | "AUTHOR",
        affiliation: u.affiliation,
        inviteToken,
        inviteExpiresAt,
        isActive: false,
      });

      newAccountInserts.push({
        id: crypto.randomUUID(),
        accountId: userId,
        providerId: "credential",
        userId,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      for (const role of u.roles) {
        newRoleInserts.push({
          userId,
          role: role as "ADMIN" | "PROGRAM_CHAIR" | "REVIEWER" | "COMMITTEE" | "AUTHOR",
        });
      }

      const activationUrl = `${appUrl}/activate/${inviteToken}`;
      const emailContent = inviteEmail({
        userName: u.name,
        activationUrl,
        expiresInHours: INVITE_EXPIRY_HOURS,
      });
      emailsToSend.push({ to: u.email, subject: emailContent.subject, html: emailContent.html });

      results.push({ email: u.email, status: "invited" });
    } catch {
      results.push({ email: u.email, status: "failed" });
    }
  }

  // Batch insert new users, accounts, and roles
  if (newUserInserts.length > 0) {
    await db.insert(user).values(newUserInserts);
  }
  if (newAccountInserts.length > 0) {
    await db.insert(accountTable).values(newAccountInserts);
  }
  if (newRoleInserts.length > 0) {
    await db.insert(userRoles).values(newRoleInserts);
  }

  // Queue emails in parallel
  await Promise.all(emailsToSend.map((e) => queueEmail(e)));

  return c.json({
    total: parsed.data.users.length,
    invited: results.filter((r) => r.status === "invited").length,
    updated: results.filter((r) => r.status === "updated_roles").length,
    failed: results.filter((r) => r.status === "failed").length,
    results,
  });
});

// POST /api/users/:id/resend-invite — resend invite email (ADMIN)
app.post("/:id/resend-invite", requireRole("ADMIN"), async (c) => {
  const { id } = c.req.param();

  const found = await db.query.user.findFirst({
    where: eq(user.id, id),
    columns: { id: true, name: true, email: true, isActive: true },
  });

  if (!found) return c.json({ error: "ไม่พบผู้ใช้" }, 404);
  if (found.isActive) {
    return c.json({ error: "ผู้ใช้นี้เปิดใช้งานแล้ว" }, 400);
  }

  const inviteToken = crypto.randomUUID();
  const inviteExpiresAt = new Date(
    Date.now() + INVITE_EXPIRY_HOURS * 60 * 60 * 1000
  );

  await db
    .update(user)
    .set({ inviteToken, inviteExpiresAt, updatedAt: new Date() })
    .where(eq(user.id, id));

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const activationUrl = `${appUrl}/activate/${inviteToken}`;
  const emailContent = inviteEmail({
    userName: found.name,
    activationUrl,
    expiresInHours: INVITE_EXPIRY_HOURS,
  });
  await queueEmail({
    to: found.email,
    subject: emailContent.subject,
    html: emailContent.html,
  });

  return c.json({ ok: true, message: "ส่งคำเชิญใหม่เรียบร้อยแล้ว" });
});

// POST /api/users/:id/reset-password — reset password (ADMIN)
app.post("/:id/reset-password", requireRole("ADMIN"), async (c) => {
  const { id } = c.req.param();
  const body = await c.req.json();

  const schema = z.object({
    newPassword: z.string().min(8),
  });

  const parsed = schema.safeParse(body);
  if (!parsed.success)
    return c.json({ error: "รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร" }, 400);

  const { auth } = await import("@/server/auth");

  const ctx = await auth.$context;
  const hashedPassword = await ctx.password.hash(parsed.data.newPassword);

  const [updated] = await db
    .update(accountTable)
    .set({ password: hashedPassword, updatedAt: new Date() })
    .where(
      and(
        eq(accountTable.userId, id),
        eq(accountTable.providerId, "credential")
      )
    )
    .returning();

  if (!updated) return c.json({ error: "ไม่พบบัญชีของผู้ใช้นี้" }, 404);

  return c.json({ ok: true, message: "รีเซ็ตรหัสผ่านสำเร็จ" });
});

// DELETE /api/users/:id — delete user (ADMIN)
app.delete("/:id", requireRole("ADMIN"), async (c) => {
  const { id } = c.req.param();
  const currentUser = c.get("user" as never) as { id: string };

  if (id === currentUser.id) {
    return c.json({ error: "ไม่สามารถลบตัวเองได้" }, 400);
  }

  const userSubs = await db.query.submissions.findFirst({
    where: eq(submissions.authorId, id),
  });

  if (userSubs) {
    return c.json({ error: "ไม่สามารถลบได้ — ผู้ใช้มีบทความในระบบ" }, 400);
  }

  // Delete related data (userRoles cascade via FK, but be explicit)
  await db.delete(userRoles).where(eq(userRoles.userId, id));
  await db.delete(notifications).where(eq(notifications.userId, id));
  await db
    .delete(reviewAssignments)
    .where(eq(reviewAssignments.reviewerId, id));
  await db.delete(sessionTable).where(eq(sessionTable.userId, id));
  await db.delete(accountTable).where(eq(accountTable.userId, id));
  await db.delete(user).where(eq(user.id, id));

  return c.json({ ok: true });
});

export { app as userRoutes };
