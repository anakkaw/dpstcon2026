import test from "node:test";
import assert from "node:assert/strict";
import {
  isPublishedPosterSlotStatus,
  isPublishedPresentationStatus,
} from "@/lib/presentation-status";

test("presentation schedules are visible only after publish or completion", () => {
  assert.equal(isPublishedPresentationStatus("PENDING"), false);
  assert.equal(isPublishedPresentationStatus("SCHEDULED"), true);
  assert.equal(isPublishedPresentationStatus("COMPLETED"), true);
});

test("poster slots are visible only after confirmation or completion", () => {
  assert.equal(isPublishedPosterSlotStatus("PLANNED"), false);
  assert.equal(isPublishedPosterSlotStatus("CONFIRMED"), true);
  assert.equal(isPublishedPosterSlotStatus("COMPLETED"), true);
});
