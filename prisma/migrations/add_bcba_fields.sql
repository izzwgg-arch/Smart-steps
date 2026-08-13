-- Add BCBA-specific fields to Timesheet
ALTER TABLE "Timesheet" ADD COLUMN IF NOT EXISTS "isBCBA" BOOLEAN DEFAULT false;
ALTER TABLE "Timesheet" ADD COLUMN IF NOT EXISTS "serviceType" TEXT;
ALTER TABLE "Timesheet" ADD COLUMN IF NOT EXISTS "sessionData" TEXT;
ALTER TABLE "Timesheet" ALTER COLUMN "insuranceId" DROP NOT NULL;

-- Add fields to Client
ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "address" TEXT;
ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "idNumber" TEXT;
ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "dlb" TEXT;

-- Add fields to Provider
ALTER TABLE "Provider" ADD COLUMN IF NOT EXISTS "dlb" TEXT;

-- Add index for BCBA filtering
CREATE INDEX IF NOT EXISTS "Timesheet_isBCBA_deletedAt_idx" ON "Timesheet"("isBCBA", "deletedAt");
