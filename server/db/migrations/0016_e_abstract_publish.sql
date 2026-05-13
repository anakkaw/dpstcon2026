-- Phase 1 of public e-abstract feature.
-- Additive-only: no existing data is modified or dropped.

-- 1. Add new file kind for admin-curated e-abstract overrides.
ALTER TYPE "public"."file_kind" ADD VALUE IF NOT EXISTS 'E_ABSTRACT';--> statement-breakpoint

-- 2. submissions: publish flag + pointer to the file shown publicly as e-abstract.
ALTER TABLE "submissions"
  ADD COLUMN IF NOT EXISTS "is_published" boolean DEFAULT false NOT NULL;--> statement-breakpoint

ALTER TABLE "submissions"
  ADD COLUMN IF NOT EXISTS "e_abstract_file_id" uuid;--> statement-breakpoint

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'submissions_e_abstract_file_id_stored_files_id_fk'
  ) THEN
    ALTER TABLE "submissions"
      ADD CONSTRAINT "submissions_e_abstract_file_id_stored_files_id_fk"
      FOREIGN KEY ("e_abstract_file_id")
      REFERENCES "public"."stored_files"("id")
      ON DELETE SET NULL ON UPDATE NO ACTION;
  END IF;
END $$;--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "submissions_is_published_idx"
  ON "submissions" USING btree ("is_published");--> statement-breakpoint

-- 3. templates: extend for public conference documents (welcome + others).
ALTER TABLE "templates"
  ADD COLUMN IF NOT EXISTS "name_en" varchar(255);--> statement-breakpoint

ALTER TABLE "templates"
  ADD COLUMN IF NOT EXISTS "description_en" text;--> statement-breakpoint

ALTER TABLE "templates"
  ADD COLUMN IF NOT EXISTS "is_public" boolean DEFAULT false NOT NULL;--> statement-breakpoint

ALTER TABLE "templates"
  ADD COLUMN IF NOT EXISTS "order_index" integer DEFAULT 0 NOT NULL;--> statement-breakpoint

ALTER TABLE "templates"
  ADD COLUMN IF NOT EXISTS "slug" varchar(100);--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "templates_slug_unique"
  ON "templates" USING btree ("slug")
  WHERE "slug" IS NOT NULL;--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "templates_is_public_idx"
  ON "templates" USING btree ("is_public");
