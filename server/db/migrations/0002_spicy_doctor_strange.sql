CREATE TABLE "user_roles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"role" "role" NOT NULL,
	"track_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "invite_token" varchar(255);--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "invite_expires_at" timestamp;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "is_active" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_track_id_tracks_id_fk" FOREIGN KEY ("track_id") REFERENCES "public"."tracks"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "user_roles_user_idx" ON "user_roles" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "user_roles_role_idx" ON "user_roles" USING btree ("role");--> statement-breakpoint
CREATE INDEX "user_invite_token_idx" ON "user" USING btree ("invite_token");--> statement-breakpoint
-- Data migration: copy existing user roles into user_roles table
INSERT INTO "user_roles" ("id", "user_id", "role", "created_at")
SELECT gen_random_uuid(), "id", "role", now() FROM "user";--> statement-breakpoint
-- Mark all existing users as active (they already have passwords)
UPDATE "user" SET "is_active" = true;--> statement-breakpoint
-- Unique constraint for (user_id, role, track_id) — COALESCE handles NULL trackId
CREATE UNIQUE INDEX "user_roles_unique_idx" ON "user_roles" ("user_id", "role", COALESCE("track_id", '00000000-0000-0000-0000-000000000000'));