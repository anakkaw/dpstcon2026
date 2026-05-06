UPDATE "submissions"
SET "status" = 'ACCEPTED',
    "updated_at" = NOW()
WHERE "status" IN ('CAMERA_READY_PENDING', 'CAMERA_READY_SUBMITTED');
--> statement-breakpoint
ALTER TABLE "submissions" DROP CONSTRAINT IF EXISTS "submissions_no_legacy_accepted_status_check";
--> statement-breakpoint
ALTER TABLE "submissions"
ADD CONSTRAINT "submissions_no_legacy_accepted_status_check"
CHECK ("status"::text NOT IN ('CAMERA_READY_PENDING', 'CAMERA_READY_SUBMITTED'));
