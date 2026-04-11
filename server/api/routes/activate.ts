import { OpenAPIHono } from "@hono/zod-openapi";
import { db } from "@/server/db";
import { user, account } from "@/server/db/schema";
import { eq, and, gt, sql } from "drizzle-orm";
import { auth } from "@/server/auth";
import { z } from "zod";
import { rateLimit } from "../middleware/rate-limit";

const app = new OpenAPIHono();

// Rate limit: 10 requests per 15 minutes per IP
app.use("/*", rateLimit(10, 15 * 60 * 1000));

// GET /api/activate/:token — validate invite token (no auth required)
app.get("/:token", async (c) => {
  const { token } = c.req.param();

  const found = await db.query.user.findFirst({
    where: and(
      eq(user.inviteToken, token),
      gt(user.inviteExpiresAt, new Date())
    ),
    columns: { id: true, name: true, email: true, isActive: true, prefixTh: true, firstNameTh: true, lastNameTh: true, prefixEn: true, firstNameEn: true, lastNameEn: true },
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

  // Compose display name from structured fields
  const f = found.firstNameTh || "";
  const l = found.lastNameTh || "";
  const displayName = (f || l) ? `${found.prefixTh || ""}${f} ${l}`.trim() : found.name;

  return c.json({
    valid: true,
    userName: displayName,
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

  const activationResult = await db.execute(sql<{
    user_id: string;
    account_id: string | null;
  }>`
    WITH activated_user AS (
      UPDATE "user"
      SET
        is_active = true,
        invite_token = null,
        invite_expires_at = null,
        updated_at = NOW()
      WHERE
        invite_token = ${token}
        AND invite_expires_at > NOW()
        AND is_active = false
      RETURNING id
    ),
    updated_account AS (
      UPDATE account
      SET
        password = ${hashedPassword},
        updated_at = NOW()
      FROM activated_user
      WHERE
        account.user_id = activated_user.id
        AND account.provider_id = 'credential'
      RETURNING account.id
    )
    SELECT
      activated_user.id AS user_id,
      updated_account.id AS account_id
    FROM activated_user
    LEFT JOIN updated_account ON TRUE
  `);

  const activated = activationResult.rows[0] as
    | { user_id: string; account_id: string | null }
    | undefined;

  if (!activated) {
    return c.json({ error: "ลิงก์เชิญไม่ถูกต้องหรือถูกใช้งานไปแล้ว" }, 409);
  }

  if (!activated.account_id) {
    await db.insert(account).values({
      id: crypto.randomUUID(),
      accountId: activated.user_id,
      providerId: "credential",
      userId: activated.user_id,
      password: hashedPassword,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  return c.json({ ok: true, message: "เปิดใช้งานบัญชีสำเร็จ กรุณาเข้าสู่ระบบ" });
});

export { app as activateRoutes };
