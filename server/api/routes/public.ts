import { OpenAPIHono } from "@hono/zod-openapi";
import { z } from "zod";
import { rateLimit } from "../middleware/rate-limit";
import { getDownloadUrl } from "@/server/r2";
import {
  getPublicAbstractByPaperCode,
  getPublicAbstracts,
  getPublicDocuments,
  getPublicFileKey,
  getPublicProgram,
  getPublicTemplateFile,
  getPublicTracks,
  getWelcomeDocument,
} from "@/server/public-conference-data";

const app = new OpenAPIHono();

// Generous rate limit — pages may fan out a few requests per visit.
app.use("/*", rateLimit(120, 60 * 1000));

const listQuerySchema = z.object({
  trackId: z.string().uuid().optional(),
  search: z.string().trim().min(1).max(200).optional(),
});

app.get("/abstracts", async (c) => {
  const parsed = listQuerySchema.safeParse({
    trackId: c.req.query("trackId") || undefined,
    search: c.req.query("search") || undefined,
  });
  if (!parsed.success) return c.json({ error: "Invalid query" }, 400);

  const abstracts = await getPublicAbstracts(parsed.data);
  const tracks = await getPublicTracks();
  return c.json({ abstracts, tracks });
});

app.get("/abstracts/:paperCode", async (c) => {
  const { paperCode } = c.req.param();
  const detail = await getPublicAbstractByPaperCode(paperCode);
  if (!detail) return c.json({ error: "Not found" }, 404);
  return c.json({ abstract: detail });
});

const programQuerySchema = z.object({
  trackId: z.string().uuid().optional(),
  type: z.enum(["ORAL", "POSTER"]).optional(),
});

app.get("/program", async (c) => {
  const parsed = programQuerySchema.safeParse({
    trackId: c.req.query("trackId") || undefined,
    type: c.req.query("type") || undefined,
  });
  if (!parsed.success) return c.json({ error: "Invalid query" }, 400);

  const program = await getPublicProgram(parsed.data);
  const tracks = await getPublicTracks();
  return c.json({ program, tracks });
});

app.get("/documents", async (c) => {
  const documents = await getPublicDocuments();
  const welcome = await getWelcomeDocument();
  return c.json({ documents, welcome });
});

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Proxy a public submission file (e-abstract / camera-ready) by stored_files.id.
 * Default: 302 redirect to a short-lived presigned R2 URL — works as iframe `src`.
 * `?json=1`: returns `{ url, mimeType, originalName }` for client consumers.
 */
app.get("/files/:storedFileId", async (c) => {
  const { storedFileId } = c.req.param();
  if (!UUID_RE.test(storedFileId)) return c.json({ error: "Not found" }, 404);
  const file = await getPublicFileKey(storedFileId);
  if (!file) return c.json({ error: "Not found" }, 404);
  const url = await getDownloadUrl(file.storedKey);
  if (c.req.query("json") === "1") {
    return c.json({
      url,
      mimeType: file.mimeType,
      originalName: file.originalName,
    });
  }
  return c.redirect(url, 302);
});

/**
 * Proxy a public conference document by template id.
 * Templates store their R2 file via `fileKey`, not the stored_files table.
 */
app.get("/documents/:templateId/file", async (c) => {
  const { templateId } = c.req.param();
  if (!UUID_RE.test(templateId)) return c.json({ error: "Not found" }, 404);
  const file = await getPublicTemplateFile(templateId);
  if (!file) return c.json({ error: "Not found" }, 404);
  const url = await getDownloadUrl(file.storedKey);
  if (c.req.query("json") === "1") {
    return c.json({
      url,
      mimeType: file.mimeType,
      originalName: file.originalName,
    });
  }
  return c.redirect(url, 302);
});

export { app as publicRoutes };
