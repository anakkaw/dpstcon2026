import { OpenAPIHono } from "@hono/zod-openapi";
import { db } from "@/server/db";
import { templates } from "@/server/db/schema";
import { eq, and, asc, desc, ne } from "drizzle-orm";
import { authMiddleware, requireRole } from "../middleware/auth";
import { getUploadUrl, getDownloadUrl, deleteFile } from "@/server/r2";
import { z } from "zod";

const app = new OpenAPIHono();

app.use("/*", authMiddleware);

/** Returns true if the slug is already taken by a different row. */
async function isSlugTaken(slug: string, excludeId?: string) {
  const conditions = excludeId
    ? and(eq(templates.slug, slug), ne(templates.id, excludeId))
    : eq(templates.slug, slug);
  const [existing] = await db
    .select({ id: templates.id })
    .from(templates)
    .where(conditions)
    .limit(1);
  return Boolean(existing);
}

app.get("/", async (c) => {
  const items = await db
    .select()
    .from(templates)
    .orderBy(asc(templates.orderIndex), desc(templates.createdAt));
  return c.json({ templates: items });
});

const createSchema = z.object({
  name: z.string().min(1).max(255),
  nameEn: z.string().max(255).optional(),
  description: z.string().optional(),
  descriptionEn: z.string().optional(),
  fileName: z.string().min(1),
  mimeType: z.string().min(1),
  isPublic: z.boolean().optional(),
  orderIndex: z.number().int().min(0).optional(),
  slug: z
    .string()
    .max(100)
    .regex(/^[a-z0-9-]+$/, "slug must be lowercase alphanumeric with dashes")
    .optional(),
});

app.post("/", requireRole("ADMIN", "PROGRAM_CHAIR"), async (c) => {
  const body = await c.req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      { error: "Validation error", details: parsed.error.flatten().fieldErrors },
      400
    );
  }

  if (parsed.data.slug && (await isSlugTaken(parsed.data.slug))) {
    return c.json({ error: "Slug นี้ถูกใช้แล้ว" }, 409);
  }

  const fileKey = `templates/${Date.now()}-${parsed.data.fileName.replace(/[^a-zA-Z0-9._-]/g, "_")}`;

  let uploadUrl = "";
  try {
    uploadUrl = await getUploadUrl(fileKey, parsed.data.mimeType);
  } catch {
    return c.json({ error: "File storage not configured" }, 503);
  }

  const [template] = await db
    .insert(templates)
    .values({
      name: parsed.data.name,
      nameEn: parsed.data.nameEn ?? null,
      description: parsed.data.description ?? null,
      descriptionEn: parsed.data.descriptionEn ?? null,
      fileKey,
      mimeType: parsed.data.mimeType,
      isPublic: parsed.data.isPublic ?? false,
      orderIndex: parsed.data.orderIndex ?? 0,
      slug: parsed.data.slug ?? null,
    })
    .returning();

  return c.json({ template, uploadUrl }, 201);
});

const patchSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  nameEn: z.string().max(255).nullable().optional(),
  description: z.string().nullable().optional(),
  descriptionEn: z.string().nullable().optional(),
  mimeType: z.string().min(1).optional(),
  isPublic: z.boolean().optional(),
  orderIndex: z.number().int().min(0).optional(),
  slug: z
    .string()
    .max(100)
    .regex(/^[a-z0-9-]+$/, "slug must be lowercase alphanumeric with dashes")
    .nullable()
    .optional(),
});

app.patch("/:id", requireRole("ADMIN", "PROGRAM_CHAIR"), async (c) => {
  const { id } = c.req.param();
  const body = await c.req.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      { error: "Validation error", details: parsed.error.flatten().fieldErrors },
      400
    );
  }

  if (parsed.data.slug && (await isSlugTaken(parsed.data.slug, id))) {
    return c.json({ error: "Slug นี้ถูกใช้แล้ว" }, 409);
  }

  const [updated] = await db
    .update(templates)
    .set(parsed.data)
    .where(eq(templates.id, id))
    .returning();
  if (!updated) return c.json({ error: "Not found" }, 404);
  return c.json({ template: updated });
});

app.delete("/:id", requireRole("ADMIN", "PROGRAM_CHAIR"), async (c) => {
  const { id } = c.req.param();
  const template = await db.query.templates.findFirst({ where: eq(templates.id, id) });
  if (!template) return c.json({ error: "Not found" }, 404);
  try {
    await deleteFile(template.fileKey);
  } catch {}
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
