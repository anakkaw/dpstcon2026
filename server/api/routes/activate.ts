import { OpenAPIHono } from "@hono/zod-openapi";
import { db } from "@/server/db";
import { user, account } from "@/server/db/schema";
import { eq, and, gt } from "drizzle-orm";
import { auth } from "@/server/auth";
import { z } from "zod";

const app = new OpenAPIHono();

// GET /api/activate/:token — validate invite token (no auth required)
app.get("/:token", async (c) => {
  const { token } = c.req.param();

  const found = await db.query.user.findFirst({
    where: and(
      eq(user.inviteToken, token),
      gt(user.inviteExpiresAt, new Date())
    ),
    columns: { id: true, name: true, email: true, isActive: true },
  });

  if (!found) {
    return c.json(
      { valid: false, error: "ลิงก์เชิญไม่ถูกต้องหรือหมดอายุแล้ว" },
      400
    );
  }

  if (found.isActive) {
    return c.json(
      { valid: false, error: "บัญชีนี้เปิดใช้งานแล้ว" },
      400
    );
  }

  return c.json({
    valid: true,
    userName: found.name,
    email: found.email,
  });
});

// POST /api/activate/:token — set password and activate account (no auth required)
app.post("/:token", async (c) => {
  const { token } = c.req.param();
  const body = await c.req.json();

  const schema = z.object({
    password: z.string().min(8, "รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร"),
  });

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      { error: parsed.error.flatten().fieldErrors.password?.[0] || "ข้อมูลไม่ถูกต้อง" },
      400
    );
  }

  const found = await db.query.user.findFirst({
    where: and(
      eq(user.inviteToken, token),
      gt(user.inviteExpiresAt, new Date())
    ),
    columns: { id: true, isActive: true },
  });

  if (!found) {
    return c.json(
      { error: "ลิงก์เชิญไม่ถูกต้องหรือหมดอายุแล้ว" },
      400
    );
  }

  if (found.isActive) {
    return c.json({ error: "บัญชีนี้เปิดใช้งานแล้ว" }, 400);
  }

  // Hash password via Better Auth's context
  const ctx = await auth.$context;
  const hashedPassword = await ctx.password.hash(parsed.data.password);

  // Check if account row already exists
  const existingAccount = await db.query.account.findFirst({
    where: and(
      eq(account.userId, found.id),
      eq(account.providerId, "credential")
    ),
  });

  if (existingAccount) {
    // Update existing account with password
    await db
      .update(account)
      .set({ password: hashedPassword, updatedAt: new Date() })
      .where(eq(account.id, existingAccount.id));
  } else {
    // Create new credential account
    await db.insert(account).values({
      id: crypto.randomUUID(),
      accountId: found.id,
      providerId: "credential",
      userId: found.id,
      password: hashedPassword,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  // Activate user and clear invite token
  await db
    .update(user)
    .set({
      isActive: true,
      inviteToken: null,
      inviteExpiresAt: null,
      updatedAt: new Date(),
    })
    .where(eq(user.id, found.id));

  return c.json({ ok: true, message: "เปิดใช้งานบัญชีสำเร็จ กรุณาเข้าสู่ระบบ" });
});

export { app as activateRoutes };
