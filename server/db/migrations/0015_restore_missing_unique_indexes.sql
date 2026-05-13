CREATE UNIQUE INDEX IF NOT EXISTS "decisions_submission_unique"
ON "decisions" USING btree ("submission_id");

CREATE UNIQUE INDEX IF NOT EXISTS "presentation_submission_type_unique"
ON "presentation_assignments" USING btree ("submission_id", "type");

CREATE UNIQUE INDEX IF NOT EXISTS "pres_committee_presentation_judge_unique"
ON "presentation_committee_assignments" USING btree ("presentation_id", "judge_id");

CREATE UNIQUE INDEX IF NOT EXISTS "pres_evaluations_presentation_judge_unique"
ON "presentation_evaluations" USING btree ("presentation_id", "judge_id");

CREATE UNIQUE INDEX IF NOT EXISTS "review_assignments_submission_reviewer_unique"
ON "review_assignments" USING btree ("submission_id", "reviewer_id");

CREATE UNIQUE INDEX IF NOT EXISTS "track_members_track_user_unique"
ON "track_members" USING btree ("track_id", "user_id");

CREATE UNIQUE INDEX IF NOT EXISTS "user_roles_user_role_track_unique"
ON "user_roles" USING btree ("user_id", "role", "track_id");
