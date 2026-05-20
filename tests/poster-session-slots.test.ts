import test from "node:test";
import assert from "node:assert/strict";
import {
  getOrphanPosterSlotAssignmentIds,
  getRemovedPosterSessionSlotTemplates,
} from "@/lib/poster-session-slots";

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

test("detects existing non-template poster slot assignments for cleanup", () => {
  assert.deepEqual(
    getOrphanPosterSlotAssignmentIds({
      activeTemplates: [slotB],
      assignments: [
        {
          id: "assignment-a",
          startsAt: new Date(slotA.startsAt),
          endsAt: new Date(slotA.endsAt),
        },
        {
          id: "assignment-b",
          startsAt: new Date(slotB.startsAt),
          endsAt: new Date(slotB.endsAt),
        },
      ],
    }),
    ["assignment-a"]
  );
});
