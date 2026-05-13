-- Track when an author resubmits a revised manuscript.
-- Nullable; populated only after the first resubmit.

ALTER TABLE "submissions"
  ADD COLUMN IF NOT EXISTS "resubmitted_at" timestamp;
