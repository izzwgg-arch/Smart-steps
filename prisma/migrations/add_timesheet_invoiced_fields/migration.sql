-- AlterTable
ALTER TABLE "Timesheet" ADD COLUMN "invoicedAt" TIMESTAMP(3),
ADD COLUMN "invoiceId" TEXT;

-- CreateIndex
CREATE INDEX "Timesheet_invoicedAt_idx" ON "Timesheet"("invoicedAt");

-- CreateIndex
CREATE INDEX "Timesheet_invoiceId_idx" ON "Timesheet"("invoiceId");

-- AddForeignKey
ALTER TABLE "Timesheet" ADD CONSTRAINT "Timesheet_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;
