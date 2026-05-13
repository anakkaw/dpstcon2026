import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import { settings } from "@/server/db/schema";

/** Settings key that holds the editable conference info JSON. */
export const CONFERENCE_INFO_KEY = "conference.info";

/**
 * Bilingual short text. `th` is required, `en` is optional and falls back
 * to `th` at render time when not provided.
 */
export type BilingualLabel = {
  th: string;
  en: string | null;
};

export type ConferenceInfo = {
  dateLabel: BilingualLabel;
  venueName: BilingualLabel;
  venueDetail: BilingualLabel;
};

/**
 * Default values used until an admin saves a row. Kept here (not in DB) so
 * a clean install renders something reasonable without seeding.
 */
export const DEFAULT_CONFERENCE_INFO: ConferenceInfo = {
  dateLabel: {
    th: "20 – 21 พ.ค. 2569",
    en: "20 – 21 May 2026",
  },
  venueName: {
    th: "มหาวิทยาลัยนเรศวร",
    en: "Naresuan University",
  },
  venueDetail: {
    th: "คณะวิทยาศาสตร์ · พิษณุโลก",
    en: "Faculty of Science · Phitsanulok",
  },
};

function isBilingualLabel(v: unknown): v is BilingualLabel {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o.th === "string" &&
    (o.en === null || typeof o.en === "string")
  );
}

function isConferenceInfo(v: unknown): v is ConferenceInfo {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  return (
    isBilingualLabel(o.dateLabel) &&
    isBilingualLabel(o.venueName) &&
    isBilingualLabel(o.venueDetail)
  );
}

/**
 * Loads conference info, merging stored values over defaults so a partial
 * write still produces a complete object on read.
 */
export async function getConferenceInfo(): Promise<ConferenceInfo> {
  const row = await db.query.settings.findFirst({
    where: eq(settings.key, CONFERENCE_INFO_KEY),
    columns: { value: true },
  });

  if (!row || !isConferenceInfo(row.value)) {
    return DEFAULT_CONFERENCE_INFO;
  }
  return row.value;
}

/**
 * Picks the appropriate language string with a sane fallback.
 *   - locale "en" prefers `en`, falls back to `th`
 *   - locale "th" always uses `th`
 */
export function pickLabel(label: BilingualLabel, locale: string): string {
  if (locale === "en") return label.en?.trim() || label.th;
  return label.th;
}

export async function updateConferenceInfo(
  next: ConferenceInfo
): Promise<ConferenceInfo> {
  const now = new Date();
  await db
    .insert(settings)
    .values({ key: CONFERENCE_INFO_KEY, value: next, updatedAt: now })
    .onConflictDoUpdate({
      target: settings.key,
      set: { value: next, updatedAt: now },
    });
  return next;
}
