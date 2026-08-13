-- CreateEnum
CREATE TYPE "FormType" AS ENUM ('PARENT_TRAINING', 'PARENT_ABC', 'VISIT_ATTESTATION');

-- CreateTable
CREATE TABLE "FormDocument" (
    "id" TEXT NOT NULL,
    "type" "FormType" NOT NULL,
    "clientId" TEXT NOT NULL,
    "providerId" TEXT,
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "behavior" TEXT,
    "payload" JSONB NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "FormDocument_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FormDocument_clientId_deletedAt_idx" ON "FormDocument"("clientId", "deletedAt");

-- CreateIndex
CREATE INDEX "FormDocument_providerId_deletedAt_idx" ON "FormDocument"("providerId", "deletedAt");

-- CreateIndex
CREATE INDEX "FormDocument_type_deletedAt_idx" ON "FormDocument"("type", "deletedAt");

-- CreateIndex
CREATE INDEX "FormDocument_deletedAt_idx" ON "FormDocument"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "FormDocumentUnique" ON "FormDocument"("type", "clientId", "providerId", "month", "year", "deletedAt");

-- AddForeignKey
ALTER TABLE "FormDocument" ADD CONSTRAINT "FormDocument_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormDocument" ADD CONSTRAINT "FormDocument_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "Provider"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormDocument" ADD CONSTRAINT "FormDocument_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
