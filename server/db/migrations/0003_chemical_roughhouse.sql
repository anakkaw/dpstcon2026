ALTER TABLE "bids" DROP CONSTRAINT "bids_submission_id_submissions_id_fk";
--> statement-breakpoint
ALTER TABLE "bids" DROP CONSTRAINT "bids_reviewer_id_user_id_fk";
--> statement-breakpoint
ALTER TABLE "conflicts" DROP CONSTRAINT "conflicts_submission_id_submissions_id_fk";
--> statement-breakpoint
ALTER TABLE "conflicts" DROP CONSTRAINT "conflicts_user_id_user_id_fk";
--> statement-breakpoint
ALTER TABLE "decisions" DROP CONSTRAINT "decisions_submission_id_submissions_id_fk";
--> statement-breakpoint
ALTER TABLE "decisions" DROP CONSTRAINT "decisions_decided_by_user_id_fk";
--> statement-breakpoint
ALTER TABLE "discussions" DROP CONSTRAINT "discussions_submission_id_submissions_id_fk";
--> statement-breakpoint
ALTER TABLE "discussions" DROP CONSTRAINT "discussions_author_id_user_id_fk";
--> statement-breakpoint
ALTER TABLE "presentation_assignments" DROP CONSTRAINT "presentation_assignments_submission_id_submissions_id_fk";
--> statement-breakpoint
ALTER TABLE "presentation_committee_assignments" DROP CONSTRAINT "presentation_committee_assignments_presentation_id_presentation_assignments_id_fk";
--> statement-breakpoint
ALTER TABLE "presentation_committee_assignments" DROP CONSTRAINT "presentation_committee_assignments_judge_id_user_id_fk";
--> statement-breakpoint
ALTER TABLE "presentation_evaluations" DROP CONSTRAINT "presentation_evaluations_presentation_id_presentation_assignments_id_fk";
--> statement-breakpoint
ALTER TABLE "presentation_evaluations" DROP CONSTRAINT "presentation_evaluations_judge_id_user_id_fk";
--> statement-breakpoint
ALTER TABLE "review_assignments" DROP CONSTRAINT "review_assignments_submission_id_submissions_id_fk";
--> statement-breakpoint
ALTER TABLE "review_assignments" DROP CONSTRAINT "review_assignments_reviewer_id_user_id_fk";
--> statement-breakpoint
ALTER TABLE "reviews" DROP CONSTRAINT "reviews_submission_id_submissions_id_fk";
--> statement-breakpoint
ALTER TABLE "reviews" DROP CONSTRAINT "reviews_reviewer_id_user_id_fk";
--> statement-breakpoint
ALTER TABLE "reviews" DROP CONSTRAINT "reviews_assignment_id_review_assignments_id_fk";
--> statement-breakpoint
ALTER TABLE "submissions" ADD COLUMN "title_en" varchar(500);--> statement-breakpoint
ALTER TABLE "submissions" ADD COLUMN "abstract_en" text;--> statement-breakpoint
ALTER TABLE "submissions" ADD COLUMN "keywords_en" varchar(500);--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "prefix_th" varchar(50);--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "prefix_en" varchar(50);--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "first_name_th" varchar(255);--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "last_name_th" varchar(255);--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "first_name_en" varchar(255);--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "last_name_en" varchar(255);--> statement-breakpoint
ALTER TABLE "bids" ADD CONSTRAINT "bids_submission_id_submissions_id_fk" FOREIGN KEY ("submission_id") REFERENCES "public"."submissions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bids" ADD CONSTRAINT "bids_reviewer_id_user_id_fk" FOREIGN KEY ("reviewer_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conflicts" ADD CONSTRAINT "conflicts_submission_id_submissions_id_fk" FOREIGN KEY ("submission_id") REFERENCES "public"."submissions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conflicts" ADD CONSTRAINT "conflicts_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "decisions" ADD CONSTRAINT "decisions_submission_id_submissions_id_fk" FOREIGN KEY ("submission_id") REFERENCES "public"."submissions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "decisions" ADD CONSTRAINT "decisions_decided_by_user_id_fk" FOREIGN KEY ("decided_by") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discussions" ADD CONSTRAINT "discussions_submission_id_submissions_id_fk" FOREIGN KEY ("submission_id") REFERENCES "public"."submissions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discussions" ADD CONSTRAINT "discussions_author_id_user_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "presentation_assignments" ADD CONSTRAINT "presentation_assignments_submission_id_submissions_id_fk" FOREIGN KEY ("submission_id") REFERENCES "public"."submissions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "presentation_committee_assignments" ADD CONSTRAINT "presentation_committee_assignments_presentation_id_presentation_assignments_id_fk" FOREIGN KEY ("presentation_id") REFERENCES "public"."presentation_assignments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "presentation_committee_assignments" ADD CONSTRAINT "presentation_committee_assignments_judge_id_user_id_fk" FOREIGN KEY ("judge_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "presentation_evaluations" ADD CONSTRAINT "presentation_evaluations_presentation_id_presentation_assignments_id_fk" FOREIGN KEY ("presentation_id") REFERENCES "public"."presentation_assignments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "presentation_evaluations" ADD CONSTRAINT "presentation_evaluations_judge_id_user_id_fk" FOREIGN KEY ("judge_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_assignments" ADD CONSTRAINT "review_assignments_submission_id_submissions_id_fk" FOREIGN KEY ("submission_id") REFERENCES "public"."submissions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_assignments" ADD CONSTRAINT "review_assignments_reviewer_id_user_id_fk" FOREIGN KEY ("reviewer_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_submission_id_submissions_id_fk" FOREIGN KEY ("submission_id") REFERENCES "public"."submissions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_reviewer_id_user_id_fk" FOREIGN KEY ("reviewer_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_assignment_id_review_assignments_id_fk" FOREIGN KEY ("assignment_id") REFERENCES "public"."review_assignments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_created_at_idx" ON "audit_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "bids_submission_idx" ON "bids" USING btree ("submission_id");--> statement-breakpoint
CREATE INDEX "bids_reviewer_idx" ON "bids" USING btree ("reviewer_id");--> statement-breakpoint
CREATE UNIQUE INDEX "bids_submission_reviewer_unique" ON "bids" USING btree ("submission_id","reviewer_id");--> statement-breakpoint
CREATE INDEX "co_authors_submission_idx" ON "co_authors" USING btree ("submission_id");--> statement-breakpoint
CREATE INDEX "conflicts_submission_idx" ON "conflicts" USING btree ("submission_id");--> statement-breakpoint
CREATE INDEX "conflicts_user_idx" ON "conflicts" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "conflicts_submission_user_unique" ON "conflicts" USING btree ("submission_id","user_id");--> statement-breakpoint
CREATE INDEX "decisions_submission_idx" ON "decisions" USING btree ("submission_id");--> statement-breakpoint
CREATE INDEX "discussions_submission_idx" ON "discussions" USING btree ("submission_id");--> statement-breakpoint
CREATE INDEX "presentation_submission_idx" ON "presentation_assignments" USING btree ("submission_id");--> statement-breakpoint
CREATE INDEX "pres_evaluations_presentation_idx" ON "presentation_evaluations" USING btree ("presentation_id");--> statement-breakpoint
CREATE INDEX "pres_evaluations_judge_idx" ON "presentation_evaluations" USING btree ("judge_id");--> statement-breakpoint
CREATE INDEX "review_assignments_submission_idx" ON "review_assignments" USING btree ("submission_id");--> statement-breakpoint
CREATE INDEX "reviews_submission_idx" ON "reviews" USING btree ("submission_id");--> statement-breakpoint
CREATE INDEX "reviews_reviewer_idx" ON "reviews" USING btree ("reviewer_id");--> statement-breakpoint
CREATE INDEX "stored_files_submission_idx" ON "stored_files" USING btree ("submission_id");