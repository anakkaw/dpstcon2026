UPDATE "submissions"
SET "status" = 'CAMERA_READY_SUBMITTED',
    "updated_at" = NOW()
WHERE "status" = 'CAMERA_READY_PENDING'
  AND EXISTS (
    SELECT 1
    FROM "stored_files"
    WHERE "stored_files"."submission_id" = "submissions"."id"
      AND "stored_files"."kind" = 'MANUSCRIPT'
  );
