import assert from "node:assert/strict";
import test from "node:test";
import { mergeBulkImportUsersByEmail } from "@/server/user-import";

test("bulk import merges duplicate emails and unions roles", () => {
  const users = mergeBulkImportUsersByEmail([
    {
      email: "person@example.com",
      firstNameTh: "สมชาย",
      roles: ["AUTHOR", "REVIEWER"],
    },
    {
      email: "person@example.com",
      firstNameTh: "ข้อมูลแถวหลังไม่ควรทับ",
      roles: ["AUTHOR", "COMMITTEE"],
    },
  ]);

  assert.equal(users.length, 1);
  assert.equal(users[0].firstNameTh, "สมชาย");
  assert.deepEqual(users[0].roles, ["AUTHOR", "REVIEWER", "COMMITTEE"]);
});

test("bulk import keeps distinct emails separate", () => {
  const users = mergeBulkImportUsersByEmail([
    { email: "a@example.com", roles: ["AUTHOR", "AUTHOR"] },
    { email: "b@example.com", roles: ["REVIEWER"] },
  ]);

  assert.deepEqual(
    users.map((user) => ({ email: user.email, roles: user.roles })),
    [
      { email: "a@example.com", roles: ["AUTHOR"] },
      { email: "b@example.com", roles: ["REVIEWER"] },
    ]
  );
});
