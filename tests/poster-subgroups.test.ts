import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizePosterSubgroups,
  parsePosterSubgroupsValue,
  posterSubgroupsSettingsKey,
} from "@/lib/poster-subgroups";

test("poster subgroup settings are scoped per track", () => {
  assert.equal(
    posterSubgroupsSettingsKey("track-1"),
    "posterSubgroups:track-1"
  );
});

test("parsePosterSubgroupsValue keeps valid subgroup records only", () => {
  assert.deepEqual(
    parsePosterSubgroupsValue([
      {
        id: "group-1",
        name: "Group A",
        submissionIds: ["paper-1", "paper-1", 42],
        judgeIds: ["judge-1", "judge-2", "judge-2"],
      },
      { id: "", name: "Bad", submissionIds: [], judgeIds: [] },
      { id: "group-2", name: "", submissionIds: "paper-2", judgeIds: [] },
      null,
    ]),
    [
      {
        id: "group-1",
        name: "Group A",
        submissionIds: ["paper-1"],
        judgeIds: ["judge-1", "judge-2"],
      },
    ]
  );
});

test("normalizePosterSubgroups removes stale IDs and keeps a poster in one subgroup", () => {
  assert.deepEqual(
    normalizePosterSubgroups({
      currentSubmissionIds: ["paper-1", "paper-2", "paper-3"],
      candidateJudgeIds: ["judge-1", "judge-2", "judge-3"],
      savedSubgroups: [
        {
          id: "group-1",
          name: "  Group A  ",
          submissionIds: ["paper-1", "paper-2", "paper-old"],
          judgeIds: ["judge-1", "judge-old", "judge-2", "judge-1"],
        },
        {
          id: "group-2",
          name: "Group B",
          submissionIds: ["paper-2", "paper-3"],
          judgeIds: ["judge-3"],
        },
      ],
    }),
    [
      {
        id: "group-1",
        name: "Group A",
        submissionIds: ["paper-1", "paper-2"],
        judgeIds: ["judge-1", "judge-2"],
      },
      {
        id: "group-2",
        name: "Group B",
        submissionIds: ["paper-3"],
        judgeIds: ["judge-3"],
      },
    ]
  );
});
