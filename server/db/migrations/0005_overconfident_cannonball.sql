WITH ranked_decisions AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY submission_id
      ORDER BY decided_at DESC, id DESC
    ) AS rn
  FROM decisions
)
DELETE FROM decisions
WHERE id IN (
  SELECT id FROM ranked_decisions WHERE rn > 1
);--> statement-breakpoint

WITH ranked_presentations AS (
  SELECT
    id,
    first_value(id) OVER (
      PARTITION BY submission_id, type
      ORDER BY
        CASE status
          WHEN 'SCHEDULED' THEN 0
          WHEN 'COMPLETED' THEN 1
          ELSE 2
        END,
        scheduled_at DESC NULLS LAST,
        id DESC
    ) AS keep_id,
    row_number() OVER (
      PARTITION BY submission_id, type
      ORDER BY
        CASE status
          WHEN 'SCHEDULED' THEN 0
          WHEN 'COMPLETED' THEN 1
          ELSE 2
        END,
        scheduled_at DESC NULLS LAST,
        id DESC
    ) AS rn
  FROM presentation_assignments
)
UPDATE presentation_committee_assignments AS pca
SET presentation_id = ranked_presentations.keep_id
FROM ranked_presentations
WHERE pca.presentation_id = ranked_presentations.id
  AND ranked_presentations.rn > 1;--> statement-breakpoint

WITH ranked_presentations AS (
  SELECT
    id,
    first_value(id) OVER (
      PARTITION BY submission_id, type
      ORDER BY
        CASE status
          WHEN 'SCHEDULED' THEN 0
          WHEN 'COMPLETED' THEN 1
          ELSE 2
        END,
        scheduled_at DESC NULLS LAST,
        id DESC
    ) AS keep_id,
    row_number() OVER (
      PARTITION BY submission_id, type
      ORDER BY
        CASE status
          WHEN 'SCHEDULED' THEN 0
          WHEN 'COMPLETED' THEN 1
          ELSE 2
        END,
        scheduled_at DESC NULLS LAST,
        id DESC
    ) AS rn
  FROM presentation_assignments
)
UPDATE presentation_evaluations AS pe
SET presentation_id = ranked_presentations.keep_id
FROM ranked_presentations
WHERE pe.presentation_id = ranked_presentations.id
  AND ranked_presentations.rn > 1;--> statement-breakpoint

WITH ranked_presentations AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY submission_id, type
      ORDER BY
        CASE status
          WHEN 'SCHEDULED' THEN 0
          WHEN 'COMPLETED' THEN 1
          ELSE 2
        END,
        scheduled_at DESC NULLS LAST,
        id DESC
    ) AS rn
  FROM presentation_assignments
)
DELETE FROM presentation_assignments
WHERE id IN (
  SELECT id FROM ranked_presentations WHERE rn > 1
);--> statement-breakpoint

WITH ranked_presentation_committee AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY presentation_id, judge_id
      ORDER BY id DESC
    ) AS rn
  FROM presentation_committee_assignments
)
DELETE FROM presentation_committee_assignments
WHERE id IN (
  SELECT id FROM ranked_presentation_committee WHERE rn > 1
);--> statement-breakpoint

WITH ranked_presentation_evaluations AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY presentation_id, judge_id
      ORDER BY created_at DESC, id DESC
    ) AS rn
  FROM presentation_evaluations
)
DELETE FROM presentation_evaluations
WHERE id IN (
  SELECT id FROM ranked_presentation_evaluations WHERE rn > 1
);--> statement-breakpoint

WITH ranked_review_assignments AS (
  SELECT
    id,
    first_value(id) OVER (
      PARTITION BY submission_id, reviewer_id
      ORDER BY
        CASE status
          WHEN 'COMPLETED' THEN 0
          WHEN 'ACCEPTED' THEN 1
          WHEN 'PENDING' THEN 2
          ELSE 3
        END,
        responded_at DESC NULLS LAST,
        assigned_at DESC,
        id DESC
    ) AS keep_id,
    row_number() OVER (
      PARTITION BY submission_id, reviewer_id
      ORDER BY
        CASE status
          WHEN 'COMPLETED' THEN 0
          WHEN 'ACCEPTED' THEN 1
          WHEN 'PENDING' THEN 2
          ELSE 3
        END,
        responded_at DESC NULLS LAST,
        assigned_at DESC,
        id DESC
    ) AS rn
  FROM review_assignments
)
UPDATE reviews
SET assignment_id = ranked_review_assignments.keep_id
FROM ranked_review_assignments
WHERE reviews.assignment_id = ranked_review_assignments.id
  AND ranked_review_assignments.rn > 1;--> statement-breakpoint

WITH ranked_review_assignments AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY submission_id, reviewer_id
      ORDER BY
        CASE status
          WHEN 'COMPLETED' THEN 0
          WHEN 'ACCEPTED' THEN 1
          WHEN 'PENDING' THEN 2
          ELSE 3
        END,
        responded_at DESC NULLS LAST,
        assigned_at DESC,
        id DESC
    ) AS rn
  FROM review_assignments
)
DELETE FROM review_assignments
WHERE id IN (
  SELECT id FROM ranked_review_assignments WHERE rn > 1
);--> statement-breakpoint

WITH ranked_track_members AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY track_id, user_id
      ORDER BY added_at DESC, id DESC
    ) AS rn
  FROM track_members
)
DELETE FROM track_members
WHERE id IN (
  SELECT id FROM ranked_track_members WHERE rn > 1
);--> statement-breakpoint

WITH ranked_user_roles AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY user_id, role, track_id
      ORDER BY created_at DESC, id DESC
    ) AS rn
  FROM user_roles
)
DELETE FROM user_roles
WHERE id IN (
  SELECT id FROM ranked_user_roles WHERE rn > 1
);--> statement-breakpoint

CREATE UNIQUE INDEX "decisions_submission_unique" ON "decisions" USING btree ("submission_id");--> statement-breakpoint
CREATE UNIQUE INDEX "presentation_submission_type_unique" ON "presentation_assignments" USING btree ("submission_id","type");--> statement-breakpoint
CREATE UNIQUE INDEX "pres_committee_presentation_judge_unique" ON "presentation_committee_assignments" USING btree ("presentation_id","judge_id");--> statement-breakpoint
CREATE UNIQUE INDEX "pres_evaluations_presentation_judge_unique" ON "presentation_evaluations" USING btree ("presentation_id","judge_id");--> statement-breakpoint
CREATE UNIQUE INDEX "review_assignments_submission_reviewer_unique" ON "review_assignments" USING btree ("submission_id","reviewer_id");--> statement-breakpoint
CREATE UNIQUE INDEX "track_members_track_user_unique" ON "track_members" USING btree ("track_id","user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "user_roles_user_role_track_unique" ON "user_roles" USING btree ("user_id","role","track_id");
