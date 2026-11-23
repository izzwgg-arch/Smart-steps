-- ScheduledJob.metadata: JSON result of the last automatic invoice run.
-- The Prisma schema has had this column, but no migration ever created it, so
-- lib/cron.ts failed with P2022 on every read/update of the job record.
-- Applied to production 2026-11-23 via psql. Idempotent.
ALTER TABLE "ScheduledJob" ADD COLUMN IF NOT EXISTS "metadata" TEXT;
