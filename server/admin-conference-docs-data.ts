import "server-only";
import { asc, desc } from "drizzle-orm";
import { db } from "@/server/db";
import { templates } from "@/server/db/schema";

export type AdminConferenceDoc = {
  id: string;
  name: string;
  nameEn: string | null;
  description: string | null;
  descriptionEn: string | null;
  slug: string | null;
  fileKey: string;
  mimeType: string | null;
  isPublic: boolean;
  orderIndex: number;
  createdAt: string;
};

export async function getAdminConferenceDocs(): Promise<AdminConferenceDoc[]> {
  const rows = await db
    .select()
    .from(templates)
    .orderBy(asc(templates.orderIndex), desc(templates.createdAt));

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    nameEn: r.nameEn,
    description: r.description,
    descriptionEn: r.descriptionEn,
    slug: r.slug,
    fileKey: r.fileKey,
    mimeType: r.mimeType,
    isPublic: r.isPublic,
    orderIndex: r.orderIndex,
    createdAt: r.createdAt.toISOString(),
  }));
}
