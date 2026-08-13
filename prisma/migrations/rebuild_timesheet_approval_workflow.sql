-- Migration: Rebuild Timesheet Approval Workflow
-- This migration updates the schema to support the new approval → email queue → batch email workflow

-- Step 1: Update TimesheetStatus enum
-- First, convert existing status values to text
ALTER TABLE "Timesheet" ALTER COLUMN "status" TYPE TEXT USING "status"::TEXT;

-- Drop old enum
DROP TYPE IF EXISTS "TimesheetStatus" CASCADE;

-- Create new enum with correct values
CREATE TYPE "TimesheetStatus" AS ENUM ('DRAFT', 'APPROVED', 'REJECTED', 'QUEUED', 'EMAILED');

-- Convert column back to enum
ALTER TABLE "Timesheet" ALTER COLUMN "status" TYPE "TimesheetStatus" USING 
  CASE 
    WHEN "status" = 'SUBMITTED' THEN 'DRAFT'::"TimesheetStatus"
    WHEN "status" = 'LOCKED' THEN 'DRAFT'::"TimesheetStatus"
    WHEN "status" = 'QUEUED_FOR_EMAIL' THEN 'QUEUED'::"TimesheetStatus"
    ELSE "status"::"TimesheetStatus"
  END;
ALTER TABLE "Timesheet" ALTER COLUMN "status" SET DEFAULT 'DRAFT';

-- Step 2: Update Timesheet model fields
-- Remove old fields
ALTER TABLE "Timesheet" DROP COLUMN IF EXISTS "submittedAt";
ALTER TABLE "Timesheet" DROP COLUMN IF EXISTS "lockedAt";
ALTER TABLE "Timesheet" DROP COLUMN IF EXISTS "queuedForEmailAt";
ALTER TABLE "Timesheet" DROP COLUMN IF EXISTS "emailStatus";
ALTER TABLE "Timesheet" DROP COLUMN IF EXISTS "emailError";
ALTER TABLE "Timesheet" DROP COLUMN IF EXISTS "emailedBatchId";

-- Add new fields (if they don't exist)
ALTER TABLE "Timesheet" ADD COLUMN IF NOT EXISTS "rejectedAt" TIMESTAMP(3);
ALTER TABLE "Timesheet" ADD COLUMN IF NOT EXISTS "queuedAt" TIMESTAMP(3);

-- Step 3: Update EmailQueueItem model
-- Create new enums
CREATE TYPE "EmailQueueStatus" AS ENUM ('QUEUED', 'SENDING', 'SENT', 'FAILED');
CREATE TYPE "EmailQueueEntityType" AS ENUM ('REGULAR', 'BCBA');

-- Convert existing data
ALTER TABLE "EmailQueueItem" ALTER COLUMN "type" TYPE TEXT USING "type"::TEXT;
ALTER TABLE "EmailQueueItem" ALTER COLUMN "status" TYPE TEXT USING "status"::TEXT;

-- Add new columns
ALTER TABLE "EmailQueueItem" ADD COLUMN IF NOT EXISTS "entityType" "EmailQueueEntityType";
ALTER TABLE "EmailQueueItem" ADD COLUMN IF NOT EXISTS "errorMessage" TEXT;

-- Migrate data: Convert type to entityType
UPDATE "EmailQueueItem" SET "entityType" = 
  CASE 
    WHEN "type" = 'BCBA_TIMESHEET' THEN 'BCBA'::"EmailQueueEntityType"
    ELSE 'REGULAR'::"EmailQueueEntityType"
  END
WHERE "entityType" IS NULL;

-- Migrate data: Convert lastError to errorMessage
UPDATE "EmailQueueItem" SET "errorMessage" = "lastError" WHERE "errorMessage" IS NULL AND "lastError" IS NOT NULL;

-- Make entityType required
ALTER TABLE "EmailQueueItem" ALTER COLUMN "entityType" SET NOT NULL;

-- Update status to use enum
ALTER TABLE "EmailQueueItem" ALTER COLUMN "status" TYPE "EmailQueueStatus" USING 
  CASE 
    WHEN "status" = 'QUEUED' THEN 'QUEUED'::"EmailQueueStatus"
    WHEN "status" = 'SENT' THEN 'SENT'::"EmailQueueStatus"
    WHEN "status" = 'FAILED' THEN 'FAILED'::"EmailQueueStatus"
    ELSE 'QUEUED'::"EmailQueueStatus"
  END;
ALTER TABLE "EmailQueueItem" ALTER COLUMN "status" SET DEFAULT 'QUEUED';

-- Remove old columns
ALTER TABLE "EmailQueueItem" DROP COLUMN IF EXISTS "type";
ALTER TABLE "EmailQueueItem" DROP COLUMN IF EXISTS "lastError";

-- Add unique constraint (if not exists)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'EmailQueueItem_entityType_entityId_key'
  ) THEN
    ALTER TABLE "EmailQueueItem" ADD CONSTRAINT "EmailQueueItem_entityType_entityId_key" 
      UNIQUE ("entityType", "entityId");
  END IF;
END $$;

-- Step 4: Update AuditAction enum
ALTER TABLE "AuditLog" ALTER COLUMN "action" TYPE TEXT USING "action"::TEXT;
DROP TYPE IF EXISTS "AuditAction" CASCADE;
CREATE TYPE "AuditAction" AS ENUM (
  'CREATE', 'UPDATE', 'DELETE', 'APPROVE', 'REJECT', 'QUEUE', 
  'GENERATE', 'PAYMENT', 'ADJUSTMENT', 'LOGIN', 'EMAIL_SENT', 
  'EMAIL_FAILED', 'TIMESHEET_APPROVED', 'TIMESHEET_REJECTED', 
  'BCBA_TIMESHEET_APPROVED', 'BCBA_TIMESHEET_REJECTED', 
  'USER_PASSWORD_SET', 'USER_LOGIN'
);
ALTER TABLE "AuditLog" ALTER COLUMN "action" TYPE "AuditAction" USING "action"::"AuditAction";

-- Step 5: Update indexes
-- Remove old indexes if they exist
DROP INDEX IF EXISTS "Timesheet_emailStatus_deletedAt_idx";
DROP INDEX IF EXISTS "EmailQueueItem_type_status_idx";

-- Add new indexes
CREATE INDEX IF NOT EXISTS "EmailQueueItem_entityType_status_idx" ON "EmailQueueItem"("entityType", "status");

-- Done
SELECT 'Migration completed successfully' AS result;
