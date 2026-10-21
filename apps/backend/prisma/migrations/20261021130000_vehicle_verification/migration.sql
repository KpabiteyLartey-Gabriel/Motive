-- Manual Super Admin verification before a vehicle may be published.
CREATE TYPE "VehicleVerificationStatus" AS ENUM ('NOT_SUBMITTED', 'PENDING_REVIEW', 'APPROVED', 'REJECTED');

ALTER TABLE "vehicles"
  ADD COLUMN "verificationStatus" "VehicleVerificationStatus" NOT NULL DEFAULT 'NOT_SUBMITTED',
  ADD COLUMN "verificationEvidence" JSONB,
  ADD COLUMN "verificationNote" TEXT,
  ADD COLUMN "verificationSubmittedAt" TIMESTAMP(3),
  ADD COLUMN "verifiedAt" TIMESTAMP(3),
  ADD COLUMN "verifiedById" TEXT;

CREATE INDEX "vehicles_verificationStatus_idx" ON "vehicles"("verificationStatus");
