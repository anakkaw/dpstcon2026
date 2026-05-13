/**
 * Conference timezone. The conference is held in Thailand; admins schedule
 * in Bangkok local time, attendees expect to see Bangkok local time.
 *
 *   - `CONFERENCE_TZ`        — IANA name for `Intl.DateTimeFormat` display
 *   - `CONFERENCE_TZ_OFFSET` — UTC offset for parsing naive datetime-local
 */
export const CONFERENCE_TZ = "Asia/Bangkok";
export const CONFERENCE_TZ_OFFSET = "+07:00";

/**
 * Parses a `scheduled_at` value that arrives from the admin form.
 *
 * `<input type="datetime-local">` produces strings shaped "YYYY-MM-DDTHH:MM"
 * with no timezone. Calling `new Date(...)` on that would interpret it in
 * the server's local timezone (typically UTC on Vercel), shifting times by
 * up to 7 hours. We treat naive values as Asia/Bangkok local explicitly.
 *
 * Returns `{ value: null }` for missing values, `{ error }` on bad input,
 * or `{ value: Date }` on success.
 */
export function parseScheduledAt(
  value: string | null | undefined
):
  | { value: Date | null }
  | { error: "Invalid scheduledAt" } {
  if (value == null || value === "") {
    return { value: null };
  }

  const hasTimezone = /([Zz]|[+-]\d{2}:?\d{2})$/.test(value);
  const isoString = hasTimezone ? value : `${value}${CONFERENCE_TZ_OFFSET}`;

  const parsed = new Date(isoString);
  if (Number.isNaN(parsed.getTime())) {
    return { error: "Invalid scheduledAt" };
  }

  return { value: parsed };
}
