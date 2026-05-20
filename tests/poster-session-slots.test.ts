import test from "node:test";
import assert from "node:assert/strict";
import { getRemovedPosterSessionSlotTemplates } from "@/lib/poster-session-slots";

const slotA = {
  id: "slot-a",
  startsAt: "2026-01-01T02:00:00.000Z",
  endsAt: "2026-01-01T02:15:00.000Z",
};

const slotB = {
  id: "slot-b",
  startsAt: "2026-01-01T02:15:00.000Z",
  endsAt: "2026-01-01T02:30:00.000Z",
};

test("detects slot templates removed from poster session settings", () => {
  assert.deepEqual(
    getRemovedPosterSessionSlotTemplates({
      before: [slotA, slotB],
      after: [slotB],
    }),
    [slotA]
  );
});

test("does not treat reordered slot templates as removed", () => {
  assert.deepEqual(
    getRemovedPosterSessionSlotTemplates({
      before: [slotA, slotB],
      after: [slotB, slotA],
    }),
    []
  );
});
