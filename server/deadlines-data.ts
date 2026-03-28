import { desc, inArray } from "drizzle-orm";
import { db } from "@/server/db";
import { settings, templates } from "@/server/db/schema";

export interface TemplateData {
  id: string;
  name: string;
  description: string | null;
  fileKey?: string;
  mimeType?: string | null;
  createdAt?: string;
}

export interface DeadlineSettings {
  submissionDeadline?: string;
  reviewDeadline?: string;
  cameraReadyDeadline?: string;
  notificationDate?: string;
  submissionDeadlineLabel?: string;
  reviewDeadlineLabel?: string;
  cameraReadyDeadlineLabel?: string;
  notificationDateLabel?: string;
}

export const DEADLINE_FALLBACKS: DeadlineSettings = {
  submissionDeadline: "2026-06-30",
  reviewDeadline: "2026-08-15",
  cameraReadyDeadline: "2026-09-30",
  notificationDate: "2026-08-31",
};

const DEADLINE_KEYS = [
  "submissionDeadline",
  "reviewDeadline",
  "cameraReadyDeadline",
  "notificationDate",
  "submissionDeadlineLabel",
  "reviewDeadlineLabel",
  "cameraReadyDeadlineLabel",
  "notificationDateLabel",
] as const;

export async function getDeadlinesPageData() {
  const [templateRows, deadlineRows] = await Promise.all([
    db.select().from(templates).orderBy(desc(templates.createdAt)),
    db
      .select({
        key: settings.key,
        value: settings.value,
      })
      .from(settings)
      .where(inArray(settings.key, [...DEADLINE_KEYS])),
  ]);

  const mergedSettings = {
    ...DEADLINE_FALLBACKS,
    ...Object.fromEntries(
      deadlineRows
        .filter((row) => typeof row.value === "string")
        .map((row) => [row.key, row.value])
    ),
  } as DeadlineSettings;

  return {
    templates: templateRows.map((template) => ({
      ...template,
      createdAt: template.createdAt?.toISOString(),
    })) as TemplateData[],
    settings: mergedSettings,
  };
}
