import test from "node:test";
import assert from "node:assert/strict";
import { parseScheduledAt } from "../lib/conference-tz";

function getOk(
  r: ReturnType<typeof parseScheduledAt>
): { value: Date | null } {
  if ("error" in r) {
    throw new Error(`Expected ok, got error: ${r.error}`);
  }
  return r;
}

test("parseScheduledAt returns null for empty / nullish values", () => {
  assert.equal(getOk(parseScheduledAt(undefined)).value, null);
  assert.equal(getOk(parseScheduledAt(null)).value, null);
  assert.equal(getOk(parseScheduledAt("")).value, null);
});

test("parseScheduledAt interprets naive datetime-local as Bangkok time", () => {
  // Admin types "2026-05-20T09:00" in the form (no timezone). The server
  // must treat this as 9 AM Bangkok = 02:00 UTC, regardless of the host
  // server's own timezone.
  const r = parseScheduledAt("2026-05-20T09:00");
  const date = getOk(r).value!;
  assert.equal(date.toISOString(), "2026-05-20T02:00:00.000Z");
});

test("parseScheduledAt accepts seconds + ms in naive input", () => {
  assert.equal(
    getOk(parseScheduledAt("2026-05-20T09:00:00")).value!.toISOString(),
    "2026-05-20T02:00:00.000Z"
  );
  assert.equal(
    getOk(parseScheduledAt("2026-05-20T09:00:30.500")).value!.toISOString(),
    "2026-05-20T02:00:30.500Z"
  );
});

test("parseScheduledAt respects an explicit Z timezone", () => {
  // UTC instant — should NOT have +07 reapplied.
  assert.equal(
    getOk(parseScheduledAt("2026-05-20T09:00:00Z")).value!.toISOString(),
    "2026-05-20T09:00:00.000Z"
  );
});

test("parseScheduledAt respects an explicit offset", () => {
  assert.equal(
    getOk(parseScheduledAt("2026-05-20T09:00:00+07:00")).value!.toISOString(),
    "2026-05-20T02:00:00.000Z"
  );
  assert.equal(
    getOk(parseScheduledAt("2026-05-20T09:00:00-05:00")).value!.toISOString(),
    "2026-05-20T14:00:00.000Z"
  );
  // Without colon — still respected (datetime-local rarely emits this).
  assert.equal(
    getOk(parseScheduledAt("2026-05-20T09:00:00+0700")).value!.toISOString(),
    "2026-05-20T02:00:00.000Z"
  );
});

test("parseScheduledAt returns an error for unparseable input", () => {
  const r = parseScheduledAt("not a date");
  assert.deepEqual(r, { error: "Invalid scheduledAt" });
});

test("admin's mental model matches the stored instant", () => {
  // End-to-end semantic check: if an admin schedules an oral session at
  // 09:00 Bangkok on 20 May 2026, the wall-clock string they see when
  // rendering for Asia/Bangkok must read 09:00 on 20 May.
  const r = parseScheduledAt("2026-05-20T09:00");
  const date = getOk(r).value!;
  const display = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
  assert.equal(display, "20/05/2026, 09:00");
});
