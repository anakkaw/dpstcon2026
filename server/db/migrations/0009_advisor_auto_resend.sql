ALTER TABLE "submissions"
  ADD COLUMN IF NOT EXISTS "advisor_auto_resend_count" integer DEFAULT 0 NOT NULL;
