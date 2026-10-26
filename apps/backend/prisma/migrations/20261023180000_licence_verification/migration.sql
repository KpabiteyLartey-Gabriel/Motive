-- Driver verification phase 2 + liveness result on the identity record.
ALTER TABLE "identity_verifications" ADD COLUMN "livenessPassed" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "licence_verifications" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "licenseNumber" TEXT NOT NULL,
    "licenceFrontUrl" TEXT NOT NULL,
    "licenceFrontFileName" TEXT,
    "licenceBackUrl" TEXT NOT NULL,
    "licenceBackFileName" TEXT,
    "status" "IdentityVerificationStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
    "reviewNote" TEXT,
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "licence_verifications_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "licence_verifications_userId_key" ON "licence_verifications"("userId");
CREATE INDEX "licence_verifications_userId_idx" ON "licence_verifications"("userId");
CREATE INDEX "licence_verifications_status_idx" ON "licence_verifications"("status");

ALTER TABLE "licence_verifications" ADD CONSTRAINT "licence_verifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
