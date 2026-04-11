-- Drop old poster group tables (child tables first due to FK constraints)
DROP TABLE IF EXISTS "poster_group_slots";
DROP TABLE IF EXISTS "poster_group_judges";
DROP TABLE IF EXISTS "poster_group_members";
DROP TABLE IF EXISTS "poster_presentation_groups";

-- Create new direct poster slot-judge assignment table
CREATE TABLE IF NOT EXISTS "poster_slot_judges" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "submission_id" uuid NOT NULL REFERENCES "submissions"("id") ON DELETE CASCADE,
  "judge_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "starts_at" timestamp NOT NULL,
  "ends_at" timestamp NOT NULL,
  "status" "poster_slot_status" DEFAULT 'PLANNED' NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "poster_slot_judges_submission_idx" ON "poster_slot_judges" ("submission_id");
CREATE INDEX IF NOT EXISTS "poster_slot_judges_judge_idx" ON "poster_slot_judges" ("judge_id");
CREATE UNIQUE INDEX IF NOT EXISTS "poster_slot_judges_unique" ON "poster_slot_judges" ("submission_id", "judge_id", "starts_at", "ends_at");
