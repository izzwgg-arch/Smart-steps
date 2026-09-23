-- Supervising BCBA for timesheets.
--
-- Records the licensed BCBA whose license a clinician on a limited permit (LBA)
-- is working under. Purely a billing/identity reference: hours stay attributed to
-- "bcbaId", so naming a supervisor here never adds to the supervisor's own hours,
-- analytics, reports, or schedule-overlap checks.
--
-- Additive and nullable: existing rows are untouched.

-- AlterTable
ALTER TABLE "Timesheet" ADD COLUMN IF NOT EXISTS "supervisingBcbaId" TEXT;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Timesheet_supervisingBcbaId_idx" ON "Timesheet"("supervisingBcbaId");

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Timesheet_supervisingBcbaId_fkey'
  ) THEN
    ALTER TABLE "Timesheet"
      ADD CONSTRAINT "Timesheet_supervisingBcbaId_fkey"
      FOREIGN KEY ("supervisingBcbaId") REFERENCES "BCBA"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
