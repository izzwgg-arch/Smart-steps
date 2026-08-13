-- AlterTable
ALTER TABLE "CommunityInvoice" ADD COLUMN "viewToken" TEXT;
ALTER TABLE "CommunityInvoice" ADD COLUMN "tokenExpiresAt" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "CommunityInvoice_viewToken_key" ON "CommunityInvoice"("viewToken");

-- CreateIndex
CREATE INDEX "CommunityInvoice_viewToken_idx" ON "CommunityInvoice"("viewToken");
