import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  formatThaiPosterSlotSummary,
  getPosterScheduleSlotMinutes,
  getPosterScheduleSortAt,
  sortPosterScheduleSlots,
} from "@/lib/poster-schedule";

describe("poster schedule display helpers", () => {
  it("sorts slots by their real start time", () => {
    const slots = [
      { id: "slot-2", startsAt: "2026-08-01T03:30:00.000Z", endsAt: "2026-08-01T03:45:00.000Z" },
      { id: "slot-1", startsAt: "2026-08-01T03:00:00.000Z", endsAt: "2026-08-01T03:15:00.000Z" },
    ];

    assert.deepEqual(
      sortPosterScheduleSlots(slots).map((slot) => slot.id),
      ["slot-1", "slot-2"]
    );
  });

  it("uses the first poster slot as the coarse sorting time", () => {
    const sortAt = getPosterScheduleSortAt(
      [
        { startsAt: "2026-08-01T04:00:00.000Z", endsAt: "2026-08-01T04:15:00.000Z" },
        { startsAt: "2026-08-01T03:00:00.000Z", endsAt: "2026-08-01T03:15:00.000Z" },
      ],
      "2026-08-01T06:00:00.000Z"
    );

    assert.equal(sortAt?.toISOString(), "2026-08-01T03:00:00.000Z");
  });

  it("does not convert multiple poster slots into one long duration", () => {
    const minutes = getPosterScheduleSlotMinutes({
      startsAt: "2026-08-01T03:00:00.000Z",
      endsAt: "2026-08-01T03:15:00.000Z",
    });

    assert.equal(minutes, 15);
  });

  it("formats each poster slot separately for author notifications", () => {
    const summary = formatThaiPosterSlotSummary(
      [
        { startsAt: "2026-08-01T03:30:00.000Z", endsAt: "2026-08-01T03:45:00.000Z" },
        { startsAt: "2026-08-01T03:00:00.000Z", endsAt: "2026-08-01T03:15:00.000Z" },
      ],
      "A"
    );

    assert.match(summary, /Slot 1:/);
    assert.match(summary, /Slot 2:/);
    assert.match(summary, /ห้อง A/);
  });
});
