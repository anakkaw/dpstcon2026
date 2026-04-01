CREATE TYPE "public"."poster_slot_status" AS ENUM('PLANNED', 'CONFIRMED', 'COMPLETED');--> statement-breakpoint
CREATE TABLE "poster_group_judges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_id" uuid NOT NULL,
	"judge_id" text NOT NULL,
	"judge_order" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "poster_group_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_id" uuid NOT NULL,
	"submission_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "poster_group_slots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_id" uuid NOT NULL,
	"judge_id" text,
	"starts_at" timestamp NOT NULL,
	"ends_at" timestamp NOT NULL,
	"status" "poster_slot_status" DEFAULT 'PLANNED' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "poster_presentation_groups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"track_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"room" varchar(100),
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "submissions" ADD COLUMN "paper_code" varchar(32);--> statement-breakpoint
ALTER TABLE "poster_group_judges" ADD CONSTRAINT "poster_group_judges_group_id_poster_presentation_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."poster_presentation_groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "poster_group_judges" ADD CONSTRAINT "poster_group_judges_judge_id_user_id_fk" FOREIGN KEY ("judge_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "poster_group_members" ADD CONSTRAINT "poster_group_members_group_id_poster_presentation_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."poster_presentation_groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "poster_group_members" ADD CONSTRAINT "poster_group_members_submission_id_submissions_id_fk" FOREIGN KEY ("submission_id") REFERENCES "public"."submissions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "poster_group_slots" ADD CONSTRAINT "poster_group_slots_group_id_poster_presentation_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."poster_presentation_groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "poster_group_slots" ADD CONSTRAINT "poster_group_slots_judge_id_user_id_fk" FOREIGN KEY ("judge_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "poster_presentation_groups" ADD CONSTRAINT "poster_presentation_groups_track_id_tracks_id_fk" FOREIGN KEY ("track_id") REFERENCES "public"."tracks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
WITH ranked_existing_codes AS (
	SELECT
		id,
		row_number() OVER (ORDER BY created_at, id) AS seq
	FROM "submissions"
	WHERE "paper_code" IS NULL
		AND "status" IN ('ACCEPTED', 'CAMERA_READY_PENDING', 'CAMERA_READY_SUBMITTED')
)
UPDATE "submissions"
SET "paper_code" = 'TEST-' || lpad(ranked_existing_codes.seq::text, 2, '0')
FROM ranked_existing_codes
WHERE "submissions"."id" = ranked_existing_codes.id;--> statement-breakpoint
CREATE INDEX "poster_group_judges_group_idx" ON "poster_group_judges" USING btree ("group_id");--> statement-breakpoint
CREATE INDEX "poster_group_judges_judge_idx" ON "poster_group_judges" USING btree ("judge_id");--> statement-breakpoint
CREATE UNIQUE INDEX "poster_group_judges_group_judge_unique" ON "poster_group_judges" USING btree ("group_id","judge_id");--> statement-breakpoint
CREATE UNIQUE INDEX "poster_group_judges_group_order_unique" ON "poster_group_judges" USING btree ("group_id","judge_order");--> statement-breakpoint
CREATE INDEX "poster_group_members_group_idx" ON "poster_group_members" USING btree ("group_id");--> statement-breakpoint
CREATE UNIQUE INDEX "poster_group_members_submission_unique" ON "poster_group_members" USING btree ("submission_id");--> statement-breakpoint
CREATE UNIQUE INDEX "poster_group_members_group_submission_unique" ON "poster_group_members" USING btree ("group_id","submission_id");--> statement-breakpoint
CREATE INDEX "poster_group_slots_group_idx" ON "poster_group_slots" USING btree ("group_id");--> statement-breakpoint
CREATE INDEX "poster_group_slots_judge_idx" ON "poster_group_slots" USING btree ("judge_id");--> statement-breakpoint
CREATE INDEX "poster_groups_track_idx" ON "poster_presentation_groups" USING btree ("track_id");--> statement-breakpoint
CREATE UNIQUE INDEX "poster_groups_track_name_unique" ON "poster_presentation_groups" USING btree ("track_id","name");--> statement-breakpoint
CREATE UNIQUE INDEX "submissions_paper_code_unique" ON "submissions" USING btree ("paper_code");
