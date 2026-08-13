-- CreateEnum
CREATE TYPE "TimesheetStatus_new" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'LOCKED', 'QUEUED_FOR_EMAIL', 'EMAILED');
ALTER TABLE "Timesheet" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Timesheet" ALTER COLUMN "status" TYPE "TimesheetStatus_new" USING ("status"::text::"TimesheetStatus_new");
ALTER TYPE "TimesheetStatus" RENAME TO "TimesheetStatus_old";
ALTER TYPE "TimesheetStatus_new" RENAME TO "TimesheetStatus";
DROP TYPE "TimesheetStatus_old";
ALTER TABLE "Timesheet" ALTER COLUMN "status" SET DEFAULT 'DRAFT';

-- CreateEnum
CREATE TYPE "AuditAction_new" AS ENUM ('CREATE', 'UPDATE', 'DELETE', 'APPROVE', 'REJECT', 'SUBMIT', 'LOCK', 'GENERATE', 'PAYMENT', 'ADJUSTMENT', 'LOGIN', 'EMAIL_SENT', 'EMAIL_FAILED', 'TIMESHEET_APPROVED', 'TIMESHEET_REJECTED', 'BCBA_TIMESHEET_APPROVED', 'BCBA_TIMESHEET_REJECTED', 'USER_PASSWORD_SET');
ALTER TABLE "AuditLog" ALTER COLUMN "action" DROP DEFAULT;
ALTER TABLE "AuditLog" ALTER COLUMN "action" TYPE "AuditAction_new" USING ("action"::text::"AuditAction_new");
ALTER TYPE "AuditAction" RENAME TO "AuditAction_old";
ALTER TYPE "AuditAction_new" RENAME TO "AuditAction";
DROP TYPE "AuditAction_old";

-- AlterTable
ALTER TABLE "User" ADD COLUMN "tempPasswordHash" TEXT,
ADD COLUMN "tempPasswordExpiresAt" TIMESTAMP(3),
ADD COLUMN "lastLoginAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Timesheet" ADD COLUMN "queuedForEmailAt" TIMESTAMP(3),
ADD COLUMN "emailedAt" TIMESTAMP(3),
ADD COLUMN "emailedBatchId" TEXT,
ADD COLUMN "emailStatus" TEXT,
ADD COLUMN "emailError" TEXT;

-- AlterTable
ALTER TABLE "AuditLog" RENAME COLUMN "entity" TO "entityType";
ALTER TABLE "AuditLog" ADD COLUMN "metadata" TEXT;

-- CreateIndex
CREATE INDEX "Timesheet_status_deletedAt_idx" ON "Timesheet"("status", "deletedAt");

-- CreateIndex
CREATE INDEX "Timesheet_emailStatus_deletedAt_idx" ON "Timesheet"("emailStatus", "deletedAt");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

-- CreateTable
CREATE TABLE "EmailQueueItem" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "queuedByUserId" TEXT NOT NULL,
    "queuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" TIMESTAMP(3),
    "batchId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailQueueItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EmailQueueItem_status_createdAt_idx" ON "EmailQueueItem"("status", "createdAt");

-- CreateIndex
CREATE INDEX "EmailQueueItem_type_status_idx" ON "EmailQueueItem"("type", "status");

-- CreateIndex
CREATE INDEX "EmailQueueItem_batchId_idx" ON "EmailQueueItem"("batchId");

-- AddForeignKey
ALTER TABLE "EmailQueueItem" ADD CONSTRAINT "EmailQueueItem_queuedByUserId_fkey" FOREIGN KEY ("queuedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
