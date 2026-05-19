import test from "node:test";
import assert from "node:assert/strict";
import {
  createMinimalPosterJudgePlan,
  getMinimumPosterJudgeCount,
} from "@/lib/poster-auto-assign";

function slots(count: number) {
  return Array.from({ length: count }, (_, index) => {
    const startMinute = index * 15;
    const startsAt = new Date(Date.UTC(2026, 0, 1, 2, startMinute, 0));
    const endsAt = new Date(startsAt.getTime() + 15 * 60 * 1000);
    return {
      id: `slot-${index + 1}`,
      startsAt: startsAt.toISOString(),
      endsAt: endsAt.toISOString(),
    };
  });
}

function posters(count: number) {
  return Array.from({ length: count }, (_, index) => ({
    submissionId: `submission-${index + 1}`,
  }));
}

function judges(count: number) {
  return Array.from({ length: count }, (_, index) => ({
    judgeId: `judge-${index + 1}`,
    name: `Judge ${index + 1}`,
  }));
}

function assertValidPlan(plan: ReturnType<typeof createMinimalPosterJudgePlan>) {
  assert.equal(plan.ok, true, plan.reason);
  const byPoster = new Map<string, typeof plan.assignments>();
  const judgeSlotPairs = new Set<string>();

  for (const assignment of plan.assignments) {
    const entries = byPoster.get(assignment.submissionId) ?? [];
    entries.push(assignment);
    byPoster.set(assignment.submissionId, entries);

    const pairKey = `${assignment.judgeId}:${assignment.slotId}`;
    assert.equal(judgeSlotPairs.has(pairKey), false, `duplicate judge-slot pair ${pairKey}`);
    judgeSlotPairs.add(pairKey);
  }

  for (const [submissionId, assignments] of byPoster) {
    assert.equal(assignments.length, 3, `${submissionId} should have exactly three assignments`);
    assert.equal(new Set(assignments.map((assignment) => assignment.judgeId)).size, 3);
    assert.equal(new Set(assignments.map((assignment) => assignment.slotId)).size, 3);
  }
}

test("minimum judge count follows total required reviews over available slots", () => {
  assert.equal(getMinimumPosterJudgeCount({ posterCount: 10, slotCount: 7 }), 5);
  assert.equal(getMinimumPosterJudgeCount({ posterCount: 5, slotCount: 3 }), 5);
  assert.equal(getMinimumPosterJudgeCount({ posterCount: 1, slotCount: 7 }), 3);
});

test("auto assign uses the minimum possible judge count for the selected track", () => {
  const plan = createMinimalPosterJudgePlan({
    posters: posters(10),
    judges: judges(8),
    slots: slots(7),
    busySlots: [],
  });

  assertValidPlan(plan);
  assert.equal(plan.judgeCount, 5);
  assert.equal(new Set(plan.assignments.map((assignment) => assignment.judgeId)).size, 5);
});

test("auto assign respects judge conflicts from other tracks", () => {
  const plan = createMinimalPosterJudgePlan({
    posters: posters(2),
    judges: judges(4),
    slots: slots(3),
    busySlots: [
      {
        judgeId: "judge-1",
        startsAt: slots(3)[0].startsAt,
        endsAt: slots(3)[0].endsAt,
      },
    ],
  });

  assertValidPlan(plan);
  assert.equal(
    plan.assignments.some(
      (assignment) => assignment.judgeId === "judge-1" && assignment.slotId === "slot-1"
    ),
    false
  );
});

test("auto assign still finds a minimum plan when the most available prefix is a bad slot mix", () => {
  const [slotA, slotB, slotC] = slots(3);
  const plan = createMinimalPosterJudgePlan({
    posters: posters(2),
    judges: judges(4),
    slots: [slotA, slotB, slotC],
    busySlots: [
      { judgeId: "judge-1", startsAt: slotC.startsAt, endsAt: slotC.endsAt },
      { judgeId: "judge-2", startsAt: slotC.startsAt, endsAt: slotC.endsAt },
      { judgeId: "judge-4", startsAt: slotB.startsAt, endsAt: slotB.endsAt },
    ],
  });

  assertValidPlan(plan);
  assert.equal(plan.judgeCount, 3);
});

test("auto assign reports impossible plans when capacity is insufficient", () => {
  const plan = createMinimalPosterJudgePlan({
    posters: posters(4),
    judges: judges(3),
    slots: slots(3),
    busySlots: [],
  });

  assert.equal(plan.ok, false);
  assert.equal(plan.reason, "INSUFFICIENT_JUDGE_CAPACITY");
});
