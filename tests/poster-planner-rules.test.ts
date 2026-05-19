import test from "node:test";
import assert from "node:assert/strict";
import {
  POSTER_REQUIRED_JUDGE_COUNT,
  buildPosterJudgeAssignments,
  getPosterScheduleReadiness,
  getUnavailableJudgeIdsForSlot,
} from "@/lib/poster-planner-rules";

const slotA = {
  id: "2026-01-01T02:00:00.000Z__2026-01-01T02:15:00.000Z",
  startsAt: "2026-01-01T02:00:00.000Z",
  endsAt: "2026-01-01T02:15:00.000Z",
};

const slotB = {
  id: "2026-01-01T02:15:00.000Z__2026-01-01T02:30:00.000Z",
  startsAt: "2026-01-01T02:15:00.000Z",
  endsAt: "2026-01-01T02:30:00.000Z",
};

const slotC = {
  id: "2026-01-01T02:30:00.000Z__2026-01-01T02:45:00.000Z",
  startsAt: "2026-01-01T02:30:00.000Z",
  endsAt: "2026-01-01T02:45:00.000Z",
};

test("poster planner is ready when one poster has three judges in three different slots", () => {
  const assignments = buildPosterJudgeAssignments([
    { id: "slot-1", judgeId: "judge-a", startsAt: slotA.startsAt, endsAt: slotA.endsAt },
    { id: "slot-2", judgeId: "judge-b", startsAt: slotB.startsAt, endsAt: slotB.endsAt },
    { id: "slot-3", judgeId: "judge-c", startsAt: slotC.startsAt, endsAt: slotC.endsAt },
  ]);

  assert.equal(assignments.length, POSTER_REQUIRED_JUDGE_COUNT);
  assert.deepEqual(
    assignments.map((assignment) => assignment.judgeId),
    ["judge-a", "judge-b", "judge-c"]
  );
  assert.equal(getPosterScheduleReadiness(assignments).isReady, true);
});

test("poster planner is not ready when a poster has fewer than three unique judges", () => {
  const readiness = getPosterScheduleReadiness(
    buildPosterJudgeAssignments([
      { id: "slot-1", judgeId: "judge-a", startsAt: slotA.startsAt, endsAt: slotA.endsAt },
      { id: "slot-2", judgeId: "judge-b", startsAt: slotA.startsAt, endsAt: slotA.endsAt },
    ])
  );

  assert.equal(readiness.isReady, false);
  assert.equal(readiness.missingJudgeCount, 1);
});

test("poster planner is not ready when a poster has three judges in the same slot", () => {
  const readiness = getPosterScheduleReadiness(
    buildPosterJudgeAssignments([
      { id: "slot-1", judgeId: "judge-a", startsAt: slotA.startsAt, endsAt: slotA.endsAt },
      { id: "slot-2", judgeId: "judge-b", startsAt: slotA.startsAt, endsAt: slotA.endsAt },
      { id: "slot-3", judgeId: "judge-c", startsAt: slotA.startsAt, endsAt: slotA.endsAt },
    ])
  );

  assert.equal(readiness.isReady, false);
  assert.equal(readiness.hasDistinctSlots, false);
});

test("poster planner blocks judges who already have another poster in the same slot", () => {
  const unavailable = getUnavailableJudgeIdsForSlot({
    slot: slotA,
    currentSubmissionId: "submission-a",
    busySlots: [
      {
        slotId: "busy-1",
        judgeId: "judge-a",
        submissionId: "submission-b",
        startsAt: slotA.startsAt,
        endsAt: slotA.endsAt,
        label: "P-002",
      },
      {
        slotId: "busy-2",
        judgeId: "judge-b",
        submissionId: "submission-a",
        startsAt: slotA.startsAt,
        endsAt: slotA.endsAt,
        label: "P-001",
      },
    ],
  });

  assert.deepEqual(Array.from(unavailable), ["judge-a"]);
});

test("poster planner allows the same judge to review another poster in a different slot", () => {
  const unavailable = getUnavailableJudgeIdsForSlot({
    slot: slotB,
    currentSubmissionId: "submission-a",
    busySlots: [
      {
        slotId: "busy-1",
        judgeId: "judge-a",
        submissionId: "submission-b",
        startsAt: slotA.startsAt,
        endsAt: slotA.endsAt,
        label: "P-002",
      },
    ],
  });

  assert.deepEqual(Array.from(unavailable), []);
});
