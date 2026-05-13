-- Multi-round revision history.
-- 1. reviews.round  : revision round the review belongs to (1 = first review)
-- 2. decision_history : append-only log of every admin decision
-- 3. submission_resubmissions : one row per author resubmit, with round
-- 4. submissions.resubmitted_at column is removed — replaced by the table above

-- 1. Round column on reviews ------------------------------------------------
ALTER TABLE "reviews"
  ADD COLUMN IF NOT EXISTS "round" integer DEFAULT 1 NOT NULL;--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "reviews_submission_round_idx"
  ON "reviews" USING btree ("submission_id", "round");--> statement-breakpoint

-- 2. decision_history -------------------------------------------------------
CREATE TABLE IF NOT EXISTS "decision_history" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "submission_id" uuid NOT NULL REFERENCES "submissions"("id") ON DELETE CASCADE,
  "decided_by" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "outcome" "decision_outcome" NOT NULL,
  "comments" text,
  "conditions" text,
  "round" integer NOT NULL DEFAULT 1,
  "decided_at" timestamp NOT NULL DEFAULT now()
);--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "decision_history_submission_idx"
  ON "decision_history" USING btree ("submission_id");--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "decision_history_submission_decided_idx"
  ON "decision_history" USING btree ("submission_id", "decided_at");--> statement-breakpoint

-- Backfill: seed history with the current decision row so timelines don't
-- start blank for already-decided submissions.
INSERT INTO "decision_history" (submission_id, decided_by, outcome, comments, conditions, round, decided_at)
SELECT submission_id, decided_by, outcome, comments, conditions, 1, decided_at
FROM "decisions"
ON CONFLICT DO NOTHING;--> statement-breakpoint

-- 3. submission_resubmissions ----------------------------------------------
CREATE TABLE IF NOT EXISTS "submission_resubmissions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "submission_id" uuid NOT NULL REFERENCES "submissions"("id") ON DELETE CASCADE,
  "round" integer NOT NULL,
  "resubmitted_at" timestamp NOT NULL DEFAULT now()
);--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "submission_resubmissions_submission_idx"
  ON "submission_resubmissions" USING btree ("submission_id");--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "submission_resubmissions_submission_round_unique"
  ON "submission_resubmissions" USING btree ("submission_id", "round");--> statement-breakpoint

-- Backfill: any submission whose resubmitted_at is set has had exactly one
-- resubmit (round = 2). Migrate that timestamp into the new table.
INSERT INTO "submission_resubmissions" (submission_id, round, resubmitted_at)
SELECT id, 2, resubmitted_at
FROM "submissions"
WHERE resubmitted_at IS NOT NULL
ON CONFLICT DO NOTHING;--> statement-breakpoint

-- 4. Drop the now-redundant column -----------------------------------------
ALTER TABLE "submissions" DROP COLUMN IF EXISTS "resubmitted_at";
