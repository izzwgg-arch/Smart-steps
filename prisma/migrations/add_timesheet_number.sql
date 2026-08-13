-- Add timesheetNumber field to Timesheet table
-- This field stores unique IDs like T-1001 for regular timesheets and BT-1002 for BCBA timesheets

ALTER TABLE "Timesheet" ADD COLUMN IF NOT EXISTS "timesheetNumber" TEXT;

-- Create unique index on timesheetNumber
CREATE UNIQUE INDEX IF NOT EXISTS "Timesheet_timesheetNumber_key" ON "Timesheet"("timesheetNumber");

-- Create index for fast lookups
CREATE INDEX IF NOT EXISTS "Timesheet_timesheetNumber_idx" ON "Timesheet"("timesheetNumber");
