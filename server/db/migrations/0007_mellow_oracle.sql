INSERT INTO "user_roles" ("user_id", "role", "track_id")
SELECT
  "head_user_id",
  'PROGRAM_CHAIR'::"role",
  "id"
FROM "tracks"
WHERE "head_user_id" IS NOT NULL
ON CONFLICT ("user_id", "role", "track_id") DO NOTHING;
