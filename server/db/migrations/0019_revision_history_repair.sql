-- Repair 0018: smarter round-number for decision_history backfill rows and a
-- uniqueness guard on (submission_id, decided_at).
--
-- 0018 hard-coded round = 1 for every backfilled decision_history row. For any
-- submission that went through ≥1 resubmit cycle BEFORE 0018 ran, the current
-- decision is actually round (priorResubmits + 1), not 1. Recompute it using
-- the resubmissions backfilled in the same prior migration.

UPDATE "decision_history" dh
SET "round" = COALESCE(
  (
    SELECT COUNT(*)::int
    FROM "submission_resubmissions" sr
    WHERE sr.submission_id = dh.submission_id
      AND sr.resubmitted_at <= dh.decided_at
  ),
  0
) + 1;--> statement-breakpoint

-- Drop the non-unique index added in 0018, then re-add as a unique index so
-- the decision API's INSERT ... ON CONFLICT DO NOTHING actually guards
-- against duplicate rows on UPDATE-branch re-decides.
DROP INDEX IF EXISTS "decision_history_submission_decided_idx";--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "decision_history_submission_decided_unique"
  ON "decision_history" USING btree ("submission_id", "decided_at");
