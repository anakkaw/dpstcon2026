import test from "node:test";
import assert from "node:assert/strict";
import { setTimeout as delay } from "node:timers/promises";
import { mapWithConcurrencyLimit } from "@/server/concurrency";

test("mapWithConcurrencyLimit preserves order and respects concurrency", async () => {
  const items = [0, 1, 2, 3, 4, 5];
  let active = 0;
  let maxActive = 0;

  const results = await mapWithConcurrencyLimit(items, 2, async (item) => {
    active += 1;
    maxActive = Math.max(maxActive, active);
    await delay(10);
    active -= 1;
    return item * 10;
  });

  assert.deepEqual(results, [0, 10, 20, 30, 40, 50]);
  assert.equal(maxActive, 2);
});

test("mapWithConcurrencyLimit rejects invalid concurrency", async () => {
  await assert.rejects(
    () => mapWithConcurrencyLimit([1], 0, async (item) => item),
    /Concurrency must be a positive integer/
  );
});
