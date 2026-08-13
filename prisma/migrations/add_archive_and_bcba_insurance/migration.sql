-- AlterTable: Add archived and bcbaInsuranceId to Timesheet
ALTER TABLE "Timesheet" ADD COLUMN IF NOT EXISTS "archived" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Timesheet" ADD COLUMN IF NOT EXISTS "bcbaInsuranceId" TEXT;

-- CreateTable: BcbaInsurance
CREATE TABLE IF NOT EXISTS "BcbaInsurance" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "ratePerUnit" DECIMAL(10,2) NOT NULL,
    "unitMinutes" INTEGER NOT NULL DEFAULT 15,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "BcbaInsurance_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "BcbaInsurance_name_key" ON "BcbaInsurance"("name");
CREATE INDEX IF NOT EXISTS "BcbaInsurance_name_idx" ON "BcbaInsurance"("name");
CREATE INDEX IF NOT EXISTS "BcbaInsurance_active_deletedAt_idx" ON "BcbaInsurance"("active", "deletedAt");

-- AddForeignKey
ALTER TABLE "Timesheet" ADD CONSTRAINT "Timesheet_bcbaInsuranceId_fkey" 
    FOREIGN KEY ("bcbaInsuranceId") REFERENCES "BcbaInsurance"("id") 
    ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex: Archive filtering
CREATE INDEX IF NOT EXISTS "Timesheet_archived_deletedAt_idx" ON "Timesheet"("archived", "deletedAt");
CREATE INDEX IF NOT EXISTS "Timesheet_isBCBA_archived_deletedAt_idx" ON "Timesheet"("isBCBA", "archived", "deletedAt");
