-- Migration: Rebuild Payroll Management Tables from Scratch
-- This migration DROPS old payroll tables and creates new ones
-- ⚠️ WARNING: This will DELETE all existing payroll data

BEGIN;

-- Drop old payroll tables (in dependency order)
DROP TABLE IF EXISTS "PayrollPayment" CASCADE;
DROP TABLE IF EXISTS "PayrollAdjustment" CASCADE;
DROP TABLE IF EXISTS "PayrollAllocation" CASCADE;
DROP TABLE IF EXISTS "PayrollAllocationBucket" CASCADE;
DROP TABLE IF EXISTS "PayrollRunLineItem" CASCADE;
DROP TABLE IF EXISTS "PayrollRun" CASCADE;
DROP TABLE IF EXISTS "PayrollTimeLog" CASCADE;
DROP TABLE IF EXISTS "PayrollImport" CASCADE;
DROP TABLE IF EXISTS "PayrollImportTemplate" CASCADE;
DROP TABLE IF EXISTS "PayrollReportArtifact" CASCADE;
DROP TABLE IF EXISTS "PayrollEmployee" CASCADE;

-- Drop old enums (if they exist)
DROP TYPE IF EXISTS "PayrollRunStatus" CASCADE;
DROP TYPE IF EXISTS "PayrollEventType" CASCADE;

-- Create new enums
CREATE TYPE "PayrollImportStatus" AS ENUM ('DRAFT', 'FINALIZED');
CREATE TYPE "PayrollRunStatus" AS ENUM ('DRAFT', 'APPROVED', 'PAID_PARTIAL', 'PAID_FULL');
CREATE TYPE "PayrollPaymentMethod" AS ENUM ('CASH', 'CHECK', 'ZELLE', 'ACH', 'OTHER');
CREATE TYPE "PayrollReportType" AS ENUM ('EMPLOYEE_MONTHLY', 'RUN_SUMMARY');

-- Create PayrollEmployee table
CREATE TABLE "PayrollEmployee" (
    "id" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "defaultHourlyRate" DECIMAL(10,2) NOT NULL,
    "scannerExternalId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PayrollEmployee_pkey" PRIMARY KEY ("id")
);

-- Create PayrollImport table
CREATE TABLE "PayrollImport" (
    "id" TEXT NOT NULL,
    "originalFileName" TEXT NOT NULL,
    "uploadedByUserId" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "PayrollImportStatus" NOT NULL DEFAULT 'DRAFT',
    "periodStart" TIMESTAMP(3),
    "periodEnd" TIMESTAMP(3),
    "mappingJson" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PayrollImport_pkey" PRIMARY KEY ("id")
);

-- Create PayrollImportRow table
CREATE TABLE "PayrollImportRow" (
    "id" TEXT NOT NULL,
    "importId" TEXT NOT NULL,
    "rowIndex" INTEGER NOT NULL,
    "employeeNameRaw" TEXT,
    "employeeExternalIdRaw" TEXT,
    "workDate" TIMESTAMP(3) NOT NULL,
    "inTime" TIMESTAMP(3),
    "outTime" TIMESTAMP(3),
    "minutesWorked" INTEGER,
    "hoursWorked" DECIMAL(10,2),
    "linkedEmployeeId" TEXT,
    "rawJson" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PayrollImportRow_pkey" PRIMARY KEY ("id")
);

-- Create PayrollRun table
CREATE TABLE "PayrollRun" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "status" "PayrollRunStatus" NOT NULL DEFAULT 'DRAFT',
    "sourceImportId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PayrollRun_pkey" PRIMARY KEY ("id")
);

-- Create PayrollRunLine table
CREATE TABLE "PayrollRunLine" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "hourlyRateUsed" DECIMAL(10,2) NOT NULL,
    "totalMinutes" INTEGER NOT NULL,
    "totalHours" DECIMAL(10,2) NOT NULL,
    "grossPay" DECIMAL(10,2) NOT NULL,
    "amountPaid" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "amountOwed" DECIMAL(10,2) NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PayrollRunLine_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "PayrollRunLine_runId_employeeId_key" UNIQUE ("runId", "employeeId")
);

-- Create PayrollPayment table
CREATE TABLE "PayrollPayment" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "paidAt" TIMESTAMP(3) NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "method" "PayrollPaymentMethod" NOT NULL,
    "reference" TEXT,
    "notes" TEXT,
    "createdById" TEXT NOT NULL,
    "payrollRunLineId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PayrollPayment_pkey" PRIMARY KEY ("id")
);

-- Create PayrollReportArtifact table
CREATE TABLE "PayrollReportArtifact" (
    "id" TEXT NOT NULL,
    "type" "PayrollReportType" NOT NULL,
    "runId" TEXT,
    "employeeId" TEXT,
    "year" INTEGER,
    "month" INTEGER,
    "storageKeyOrPath" TEXT NOT NULL,
    "generatedByUserId" TEXT NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PayrollReportArtifact_pkey" PRIMARY KEY ("id")
);

-- Add foreign key constraints
ALTER TABLE "PayrollImport" ADD CONSTRAINT "PayrollImport_uploadedByUserId_fkey" FOREIGN KEY ("uploadedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PayrollImportRow" ADD CONSTRAINT "PayrollImportRow_importId_fkey" FOREIGN KEY ("importId") REFERENCES "PayrollImport"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PayrollImportRow" ADD CONSTRAINT "PayrollImportRow_linkedEmployeeId_fkey" FOREIGN KEY ("linkedEmployeeId") REFERENCES "PayrollEmployee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PayrollRun" ADD CONSTRAINT "PayrollRun_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PayrollRun" ADD CONSTRAINT "PayrollRun_sourceImportId_fkey" FOREIGN KEY ("sourceImportId") REFERENCES "PayrollImport"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PayrollRunLine" ADD CONSTRAINT "PayrollRunLine_runId_fkey" FOREIGN KEY ("runId") REFERENCES "PayrollRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PayrollRunLine" ADD CONSTRAINT "PayrollRunLine_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "PayrollEmployee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PayrollPayment" ADD CONSTRAINT "PayrollPayment_runId_fkey" FOREIGN KEY ("runId") REFERENCES "PayrollRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PayrollPayment" ADD CONSTRAINT "PayrollPayment_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "PayrollEmployee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PayrollPayment" ADD CONSTRAINT "PayrollPayment_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PayrollPayment" ADD CONSTRAINT "PayrollPayment_payrollRunLineId_fkey" FOREIGN KEY ("payrollRunLineId") REFERENCES "PayrollRunLine"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PayrollReportArtifact" ADD CONSTRAINT "PayrollReportArtifact_runId_fkey" FOREIGN KEY ("runId") REFERENCES "PayrollRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PayrollReportArtifact" ADD CONSTRAINT "PayrollReportArtifact_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "PayrollEmployee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PayrollReportArtifact" ADD CONSTRAINT "PayrollReportArtifact_generatedByUserId_fkey" FOREIGN KEY ("generatedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Create indexes
CREATE INDEX "PayrollEmployee_scannerExternalId_idx" ON "PayrollEmployee"("scannerExternalId");
CREATE INDEX "PayrollEmployee_active_idx" ON "PayrollEmployee"("active");

CREATE INDEX "PayrollImport_uploadedByUserId_idx" ON "PayrollImport"("uploadedByUserId");
CREATE INDEX "PayrollImport_status_idx" ON "PayrollImport"("status");
CREATE INDEX "PayrollImport_periodStart_periodEnd_idx" ON "PayrollImport"("periodStart", "periodEnd");

CREATE INDEX "PayrollImportRow_importId_idx" ON "PayrollImportRow"("importId");
CREATE INDEX "PayrollImportRow_linkedEmployeeId_idx" ON "PayrollImportRow"("linkedEmployeeId");
CREATE INDEX "PayrollImportRow_workDate_idx" ON "PayrollImportRow"("workDate");

CREATE INDEX "PayrollRun_createdByUserId_idx" ON "PayrollRun"("createdByUserId");
CREATE INDEX "PayrollRun_status_idx" ON "PayrollRun"("status");
CREATE INDEX "PayrollRun_periodStart_periodEnd_idx" ON "PayrollRun"("periodStart", "periodEnd");
CREATE INDEX "PayrollRun_sourceImportId_idx" ON "PayrollRun"("sourceImportId");

CREATE INDEX "PayrollRunLine_runId_idx" ON "PayrollRunLine"("runId");
CREATE INDEX "PayrollRunLine_employeeId_idx" ON "PayrollRunLine"("employeeId");

CREATE INDEX "PayrollPayment_runId_idx" ON "PayrollPayment"("runId");
CREATE INDEX "PayrollPayment_employeeId_idx" ON "PayrollPayment"("employeeId");
CREATE INDEX "PayrollPayment_paidAt_idx" ON "PayrollPayment"("paidAt");

CREATE INDEX "PayrollReportArtifact_type_idx" ON "PayrollReportArtifact"("type");
CREATE INDEX "PayrollReportArtifact_runId_idx" ON "PayrollReportArtifact"("runId");
CREATE INDEX "PayrollReportArtifact_employeeId_idx" ON "PayrollReportArtifact"("employeeId");
CREATE INDEX "PayrollReportArtifact_year_month_idx" ON "PayrollReportArtifact"("year", "month");

COMMIT;
