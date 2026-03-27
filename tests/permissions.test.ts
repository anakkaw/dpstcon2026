import test from "node:test";
import assert from "node:assert/strict";
import {
  getRoleAssignments,
  getTrackRoleIds,
  hasRole,
  hasTrackRole,
} from "../lib/permissions";

test("falls back to primary/global roles when scoped assignments are absent", () => {
  const user = {
    role: "AUTHOR",
    roles: ["AUTHOR", "REVIEWER"],
  };

  assert.equal(hasRole(user, "REVIEWER"), true);
  assert.deepEqual(getRoleAssignments(user), [
    { role: "AUTHOR", trackId: null },
    { role: "REVIEWER", trackId: null },
  ]);
});

test("returns deduplicated track ids for scoped roles", () => {
  const user = {
    role: "PROGRAM_CHAIR",
    roles: ["PROGRAM_CHAIR", "COMMITTEE"],
    roleAssignments: [
      { role: "COMMITTEE", trackId: "track-a" },
      { role: "COMMITTEE", trackId: "track-a" },
      { role: "COMMITTEE", trackId: "track-b" },
      { role: "PROGRAM_CHAIR", trackId: null },
    ],
  };

  assert.deepEqual(getTrackRoleIds(user, "COMMITTEE"), [
    "track-a",
    "track-b",
  ]);
});

test("checks scoped track access using role assignments", () => {
  const user = {
    role: "REVIEWER",
    roles: ["REVIEWER"],
    roleAssignments: [{ role: "REVIEWER", trackId: "track-a" }],
  };

  assert.equal(hasTrackRole(user, "track-a", "REVIEWER"), true);
  assert.equal(hasTrackRole(user, "track-b", "REVIEWER"), false);
  assert.equal(hasTrackRole(user, null, "REVIEWER"), false);
});
