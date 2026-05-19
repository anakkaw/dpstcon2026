import test from "node:test";
import assert from "node:assert/strict";
import {
  movePosterOrderItem,
  normalizePosterOrder,
} from "@/lib/poster-planner-order";

test("poster order keeps saved ids first and appends new posters", () => {
  assert.deepEqual(
    normalizePosterOrder({
      currentIds: ["a", "b", "c", "d"],
      savedIds: ["c", "a", "missing"],
    }),
    ["c", "a", "b", "d"]
  );
});

test("poster order moves an item up within the current track list", () => {
  assert.deepEqual(
    movePosterOrderItem({
      currentIds: ["a", "b", "c"],
      savedIds: ["a", "b", "c"],
      submissionId: "c",
      direction: "up",
    }),
    ["a", "c", "b"]
  );
});

test("poster order moves an item down within the current track list", () => {
  assert.deepEqual(
    movePosterOrderItem({
      currentIds: ["a", "b", "c"],
      savedIds: ["a", "b", "c"],
      submissionId: "a",
      direction: "down",
    }),
    ["b", "a", "c"]
  );
});

test("poster order leaves boundary moves unchanged", () => {
  assert.deepEqual(
    movePosterOrderItem({
      currentIds: ["a", "b", "c"],
      savedIds: ["a", "b", "c"],
      submissionId: "a",
      direction: "up",
    }),
    ["a", "b", "c"]
  );

  assert.deepEqual(
    movePosterOrderItem({
      currentIds: ["a", "b", "c"],
      savedIds: ["a", "b", "c"],
      submissionId: "c",
      direction: "down",
    }),
    ["a", "b", "c"]
  );
});
