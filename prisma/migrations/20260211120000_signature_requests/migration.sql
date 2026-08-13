-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "SignatureEntityType" AS ENUM ('CLIENT', 'PROVIDER');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- AlterTable
ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "signatureUpdatedAt" TIMESTAMP(3);
ALTER TABLE "Provider" ADD COLUMN IF NOT EXISTS "signatureUpdatedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE IF NOT EXISTS "SignatureRequestToken" (
  "id" TEXT NOT NULL,
  "entityType" "SignatureEntityType" NOT NULL,
  "entityId" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "usedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdByUserId" TEXT NOT NULL,
  CONSTRAINT "SignatureRequestToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "SignatureRequestToken_tokenHash_key" ON "SignatureRequestToken"("tokenHash");
CREATE INDEX IF NOT EXISTS "SignatureRequestToken_entityType_entityId_idx" ON "SignatureRequestToken"("entityType", "entityId");
CREATE INDEX IF NOT EXISTS "SignatureRequestToken_expiresAt_idx" ON "SignatureRequestToken"("expiresAt");

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "SignatureRequestToken"
  ADD CONSTRAINT "SignatureRequestToken_createdByUserId_fkey"
  FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
