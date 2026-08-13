-- Performance indexes for Timesheet model
-- Run this manually: psql $DATABASE_URL -f prisma/migrations/add_performance_indexes.sql

-- Indexes for filtering
CREATE INDEX IF NOT EXISTS "Timesheet_clientId_idx" ON "Timesheet"("clientId");
CREATE INDEX IF NOT EXISTS "Timesheet_providerId_idx" ON "Timesheet"("providerId");
CREATE INDEX IF NOT EXISTS "Timesheet_bcbaId_idx" ON "Timesheet"("bcbaId");
CREATE INDEX IF NOT EXISTS "Timesheet_status_idx" ON "Timesheet"("status");
CREATE INDEX IF NOT EXISTS "Timesheet_createdAt_idx" ON "Timesheet"("createdAt");

-- Composite indexes for common query patterns
CREATE INDEX IF NOT EXISTS "Timesheet_startDate_endDate_idx" ON "Timesheet"("startDate", "endDate");
CREATE INDEX IF NOT EXISTS "Timesheet_isBCBA_deletedAt_idx" ON "Timesheet"("isBCBA", "deletedAt");
CREATE INDEX IF NOT EXISTS "Timesheet_invoiceId_deletedAt_idx" ON "Timesheet"("invoiceId", "deletedAt");
