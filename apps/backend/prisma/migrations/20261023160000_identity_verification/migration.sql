-- Identity verification: Ghana Card number + front/back card images +
-- a live camera (liveness) capture per user per account kind (Driver/Owner).
CREATE TYPE "IdentityVerificationStatus" AS ENUM ('PENDING_REVIEW', 'APPROVED', 'REJECTED');

CREATE TABLE "identity_verifications" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accountKind" "UserRole" NOT NULL,
    "ghanaCardNumber" TEXT NOT NULL,
    "idFrontUrl" TEXT NOT NULL,
    "idFrontFileName" TEXT,
    "idBackUrl" TEXT NOT NULL,
    "idBackFileName" TEXT,
    "livenessSelfieUrl" TEXT NOT NULL,
    "livenessChallenge" TEXT,
    "livenessCapturedAt" TIMESTAMP(3),
    "status" "IdentityVerificationStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
    "reviewNote" TEXT,
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "identity_verifications_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "identity_verifications_userId_accountKind_key" ON "identity_verifications"("userId", "accountKind");
CREATE INDEX "identity_verifications_userId_idx" ON "identity_verifications"("userId");
CREATE INDEX "identity_verifications_status_idx" ON "identity_verifications"("status");

ALTER TABLE "identity_verifications" ADD CONSTRAINT "identity_verifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
