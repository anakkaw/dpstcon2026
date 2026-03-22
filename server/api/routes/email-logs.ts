import { OpenAPIHono } from "@hono/zod-openapi";
import { db } from "@/server/db";
import { outgoingEmails } from "@/server/db/schema";
import { desc, eq } from "drizzle-orm";
import { authMiddleware, requireRole } from "../middleware/auth";
import { sendEmail } from "@/server/email";

const app = new OpenAPIHono();
app.use("*", authMiddleware);

// GET /api/email-logs — list recent emails (ADMIN only)
app.get("/", requireRole("ADMIN"), async (c) => {
  const logs = await db
    .select()
    .from(outgoingEmails)
    .orderBy(desc(outgoingEmails.createdAt))
    .limit(50);

  return c.json({ logs });
});

// POST /api/email-logs/test — send a test email (ADMIN only)
app.post("/test", requireRole("ADMIN"), async (c) => {
  const { to } = await c.req.json();
  if (!to) return c.json({ error: "Missing 'to' field" }, 400);

  try {
    const result = await sendEmail({
      to,
      subject: "[DPSTCon] ทดสอบระบบส่งอีเมล",
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #f97316;">DPSTCon — ทดสอบอีเมล</h2>
          <p>อีเมลนี้ส่งจากระบบ DPSTCon เพื่อทดสอบว่าการส่งอีเมลทำงานปกติ</p>
          <p style="color: #22c55e; font-weight: bold;">ระบบส่งอีเมลทำงานปกติ ✓</p>
          <p style="color: #94a3b8; font-size: 12px; margin-top: 24px;">
            ส่งเมื่อ: ${new Date().toISOString()}
          </p>
        </div>
      `,
    });
    return c.json({ success: true, result });
  } catch (err) {
    return c.json(
      { success: false, error: err instanceof Error ? err.message : "Unknown error" },
      500
    );
  }
});

// POST /api/email-logs/:id/retry — retry a failed email (ADMIN only)
app.post("/:id/retry", requireRole("ADMIN"), async (c) => {
  const id = c.req.param("id");
  const [record] = await db
    .select()
    .from(outgoingEmails)
    .where(eq(outgoingEmails.id, id))
    .limit(1);

  if (!record) return c.json({ error: "Not found" }, 404);

  try {
    await sendEmail({ to: record.to, subject: record.subject, html: record.html });
    await db
      .update(outgoingEmails)
      .set({ status: "SENT", sentAt: new Date(), error: null })
      .where(eq(outgoingEmails.id, id));
    return c.json({ success: true });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : "Unknown error";
    await db
      .update(outgoingEmails)
      .set({ status: "FAILED", error: errorMsg })
      .where(eq(outgoingEmails.id, id));
    return c.json({ success: false, error: errorMsg }, 500);
  }
});

export { app as emailLogRoutes };
