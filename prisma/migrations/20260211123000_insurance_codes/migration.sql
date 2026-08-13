-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "InsuranceCodeServiceType" AS ENUM ('Assessment', 'DirectCare', 'Supervision', 'TreatmentPlanning', 'ParentTraining');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "InsuranceCodeAppliesTo" AS ENUM ('REGULAR', 'BCBA', 'BOTH');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "InsuranceCodeAuthorization" (
  "id" TEXT NOT NULL,
  "clientId" TEXT NOT NULL,
  "insuranceId" TEXT NOT NULL,
  "cptCode" TEXT NOT NULL,
  "codeName" TEXT NOT NULL,
  "serviceType" "InsuranceCodeServiceType" NOT NULL,
  "appliesTo" "InsuranceCodeAppliesTo" NOT NULL,
  "startDate" TIMESTAMP(3) NOT NULL,
  "endDate" TIMESTAMP(3) NOT NULL,
  "authorizedUnits" INTEGER NOT NULL,
  "notes" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "InsuranceCodeAuthorization_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "InsuranceCodeAuthorization_clientId_idx" ON "InsuranceCodeAuthorization"("clientId");
CREATE INDEX IF NOT EXISTS "InsuranceCodeAuthorization_insuranceId_idx" ON "InsuranceCodeAuthorization"("insuranceId");
CREATE INDEX IF NOT EXISTS "InsuranceCodeAuthorization_serviceType_idx" ON "InsuranceCodeAuthorization"("serviceType");
CREATE INDEX IF NOT EXISTS "InsuranceCodeAuthorization_isActive_idx" ON "InsuranceCodeAuthorization"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "InsuranceCodeAuthorization_unique_guard" ON "InsuranceCodeAuthorization"("clientId", "insuranceId", "cptCode", "serviceType", "startDate", "endDate", "appliesTo", "isActive");

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "InsuranceCodeAuthorization"
  ADD CONSTRAINT "InsuranceCodeAuthorization_clientId_fkey"
  FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "InsuranceCodeAuthorization"
  ADD CONSTRAINT "InsuranceCodeAuthorization_insuranceId_fkey"
  FOREIGN KEY ("insuranceId") REFERENCES "Insurance"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
