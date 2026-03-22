import { OpenAPIHono } from "@hono/zod-openapi";
import { db } from "@/server/db";
import { templates } from "@/server/db/schema";
import { eq, desc } from "drizzle-orm";
import { authMiddleware, requireRole } from "../middleware/auth";
import { getUploadUrl, getDownloadUrl, deleteFile } from "@/server/r2";
import { z } from "zod";

const app = new OpenAPIHono();

app.use("/*", authMiddleware);

app.get("/", async (c) => {
  const items = await db.select().from(templates).orderBy(desc(templates.createdAt));
  return c.json({ templates: items });
});

app.post("/", requireRole("ADMIN", "PROGRAM_CHAIR"), async (c) => {
  const body = await c.req.json();
  const schema = z.object({
    name: z.string().min(1),
    description: z.string().optional(),
    fileName: z.string().min(1),
    mimeType: z.string().min(1),
  });

  const parsed = schema.safeParse(body);
  if (!parsed.success) return c.json({ error: "Validation error" }, 400);

  const fileKey = `templates/${Date.now()}-${parsed.data.fileName.replace(/[^a-zA-Z0-9._-]/g, "_")}`;

  let uploadUrl = "";
  try { uploadUrl = await getUploadUrl(fileKey, parsed.data.mimeType); } catch {}

  const [template] = await db
    .insert(templates)
    .values({ name: parsed.data.name, description: parsed.data.description, fileKey, mimeType: parsed.data.mimeType })
    .returning();

  return c.json({ template, uploadUrl }, 201);
});

app.patch("/:id", requireRole("ADMIN", "PROGRAM_CHAIR"), async (c) => {
  const { id } = c.req.param();
  const body = await c.req.json();
  const [updated] = await db.update(templates).set(body).where(eq(templates.id, id)).returning();
  if (!updated) return c.json({ error: "Not found" }, 404);
  return c.json({ template: updated });
});

app.delete("/:id", requireRole("ADMIN", "PROGRAM_CHAIR"), async (c) => {
  const { id } = c.req.param();
  const template = await db.query.templates.findFirst({ where: eq(templates.id, id) });
  if (!template) return c.json({ error: "Not found" }, 404);
  try { await deleteFile(template.fileKey); } catch {}
  await db.delete(templates).where(eq(templates.id, id));
  return c.json({ ok: true });
});

app.get("/:id/download", async (c) => {
  const { id } = c.req.param();
  const template = await db.query.templates.findFirst({ where: eq(templates.id, id) });
  if (!template) return c.json({ error: "Not found" }, 404);
  try {
    const downloadUrl = await getDownloadUrl(template.fileKey);
    return c.redirect(downloadUrl);
  } catch {
    return c.json({ error: "File storage not configured" }, 503);
  }
});

export { app as templateRoutes };
