-- CreateIndex
CREATE INDEX IF NOT EXISTS "TimesheetEntry_date_idx" ON "TimesheetEntry"("date");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "TimesheetEntry_timesheetId_date_idx" ON "TimesheetEntry"("timesheetId", "date");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Timesheet_providerId_deletedAt_idx" ON "Timesheet"("providerId", "deletedAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Timesheet_clientId_deletedAt_idx" ON "Timesheet"("clientId", "deletedAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Timesheet_deletedAt_idx" ON "Timesheet"("deletedAt");
