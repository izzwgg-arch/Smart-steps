-- AlterTable
ALTER TABLE "EmailQueueItem" ADD COLUMN IF NOT EXISTS "scheduledSendAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "EmailQueueItem_scheduledSendAt_status_idx" ON "EmailQueueItem"("scheduledSendAt", "status");
