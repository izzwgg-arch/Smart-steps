-- CreateTable: ParentTrainingSignIn
CREATE TABLE IF NOT EXISTS "ParentTrainingSignIn" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "ParentTrainingSignIn_pkey" PRIMARY KEY ("id")
);

-- CreateTable: ParentTrainingSignInRow
CREATE TABLE IF NOT EXISTS "ParentTrainingSignInRow" (
    "id" TEXT NOT NULL,
    "formId" TEXT NOT NULL,
    "serviceDate" TIMESTAMP(3) NOT NULL,
    "parentName" TEXT NOT NULL,
    "signature" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ParentTrainingSignInRow_pkey" PRIMARY KEY ("id")
);

-- CreateTable: ParentABCData
CREATE TABLE IF NOT EXISTS "ParentABCData" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "ParentABCData_pkey" PRIMARY KEY ("id")
);

-- CreateTable: ParentABCDataRow
CREATE TABLE IF NOT EXISTS "ParentABCDataRow" (
    "id" TEXT NOT NULL,
    "formId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "antecedent" TEXT NOT NULL,
    "behavior" TEXT NOT NULL,
    "consequences" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ParentABCDataRow_pkey" PRIMARY KEY ("id")
);

-- CreateTable: VisitAttestation
CREATE TABLE IF NOT EXISTS "VisitAttestation" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "VisitAttestation_pkey" PRIMARY KEY ("id")
);

-- CreateTable: VisitAttestationRow
CREATE TABLE IF NOT EXISTS "VisitAttestationRow" (
    "id" TEXT NOT NULL,
    "formId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "providerId" TEXT NOT NULL,
    "parentSignature" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VisitAttestationRow_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey: ParentTrainingSignIn -> Client
ALTER TABLE "ParentTrainingSignIn" ADD CONSTRAINT "ParentTrainingSignIn_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey: ParentTrainingSignInRow -> ParentTrainingSignIn
ALTER TABLE "ParentTrainingSignInRow" ADD CONSTRAINT "ParentTrainingSignInRow_formId_fkey" FOREIGN KEY ("formId") REFERENCES "ParentTrainingSignIn"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: ParentABCData -> Client
ALTER TABLE "ParentABCData" ADD CONSTRAINT "ParentABCData_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey: ParentABCDataRow -> ParentABCData
ALTER TABLE "ParentABCDataRow" ADD CONSTRAINT "ParentABCDataRow_formId_fkey" FOREIGN KEY ("formId") REFERENCES "ParentABCData"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: VisitAttestation -> Client
ALTER TABLE "VisitAttestation" ADD CONSTRAINT "VisitAttestation_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey: VisitAttestationRow -> VisitAttestation
ALTER TABLE "VisitAttestationRow" ADD CONSTRAINT "VisitAttestationRow_formId_fkey" FOREIGN KEY ("formId") REFERENCES "VisitAttestation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: VisitAttestationRow -> Provider
ALTER TABLE "VisitAttestationRow" ADD CONSTRAINT "VisitAttestationRow_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "Provider"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateIndex: ParentTrainingSignIn unique constraint
CREATE UNIQUE INDEX IF NOT EXISTS "ParentTrainingSignIn_clientId_month_year_deletedAt_key" ON "ParentTrainingSignIn"("clientId", "month", "year", "deletedAt");

-- CreateIndex: ParentTrainingSignIn indexes
CREATE INDEX IF NOT EXISTS "ParentTrainingSignIn_clientId_deletedAt_idx" ON "ParentTrainingSignIn"("clientId", "deletedAt");
CREATE INDEX IF NOT EXISTS "ParentTrainingSignIn_deletedAt_idx" ON "ParentTrainingSignIn"("deletedAt");

-- CreateIndex: ParentTrainingSignInRow index
CREATE INDEX IF NOT EXISTS "ParentTrainingSignInRow_formId_idx" ON "ParentTrainingSignInRow"("formId");

-- CreateIndex: ParentABCData unique constraint
CREATE UNIQUE INDEX IF NOT EXISTS "ParentABCData_clientId_month_year_deletedAt_key" ON "ParentABCData"("clientId", "month", "year", "deletedAt");

-- CreateIndex: ParentABCData indexes
CREATE INDEX IF NOT EXISTS "ParentABCData_clientId_deletedAt_idx" ON "ParentABCData"("clientId", "deletedAt");
CREATE INDEX IF NOT EXISTS "ParentABCData_deletedAt_idx" ON "ParentABCData"("deletedAt");

-- CreateIndex: ParentABCDataRow index
CREATE INDEX IF NOT EXISTS "ParentABCDataRow_formId_idx" ON "ParentABCDataRow"("formId");

-- CreateIndex: VisitAttestation unique constraint
CREATE UNIQUE INDEX IF NOT EXISTS "VisitAttestation_clientId_month_year_deletedAt_key" ON "VisitAttestation"("clientId", "month", "year", "deletedAt");

-- CreateIndex: VisitAttestation indexes
CREATE INDEX IF NOT EXISTS "VisitAttestation_clientId_deletedAt_idx" ON "VisitAttestation"("clientId", "deletedAt");
CREATE INDEX IF NOT EXISTS "VisitAttestation_deletedAt_idx" ON "VisitAttestation"("deletedAt");

-- CreateIndex: VisitAttestationRow indexes
CREATE INDEX IF NOT EXISTS "VisitAttestationRow_formId_idx" ON "VisitAttestationRow"("formId");
CREATE INDEX IF NOT EXISTS "VisitAttestationRow_providerId_idx" ON "VisitAttestationRow"("providerId");
