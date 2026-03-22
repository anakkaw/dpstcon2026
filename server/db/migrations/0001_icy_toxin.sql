ALTER TYPE "public"."advisor_approval_status" ADD VALUE 'NOT_REQUESTED' BEFORE 'PENDING';--> statement-breakpoint
CREATE TABLE "track_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"track_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"role" "role" NOT NULL,
	"added_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "submissions" ALTER COLUMN "advisor_email" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "submissions" ALTER COLUMN "advisor_name" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "submissions" ALTER COLUMN "advisor_approval_status" SET DEFAULT 'NOT_REQUESTED';--> statement-breakpoint
ALTER TABLE "submissions" ALTER COLUMN "advisor_approval_status" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "track_members" ADD CONSTRAINT "track_members_track_id_tracks_id_fk" FOREIGN KEY ("track_id") REFERENCES "public"."tracks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "track_members" ADD CONSTRAINT "track_members_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "track_members_track_idx" ON "track_members" USING btree ("track_id");--> statement-breakpoint
CREATE INDEX "track_members_user_idx" ON "track_members" USING btree ("user_id");