-- Onboarding: account first, then account type (PENDING until chosen),
-- Google sign-in, and separate National ID / driver licence verification.
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'PENDING';

ALTER TABLE "users"
  ADD COLUMN "googleId" TEXT,
  ADD COLUMN "authProvider" TEXT NOT NULL DEFAULT 'LOCAL',
  ADD COLUMN "onboardingCompletedAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "users_googleId_key" ON "users"("googleId");

ALTER TABLE "drivers"
  ADD COLUMN "nationalIdVerifiedAt" TIMESTAMP(3),
  ADD COLUMN "nationalIdVerifiedBy" TEXT,
  ADD COLUMN "licenceVerifiedAt" TIMESTAMP(3),
  ADD COLUMN "licenceVerifiedBy" TEXT;

ALTER TABLE "owners"
  ADD COLUMN "nationalIdVerifiedAt" TIMESTAMP(3),
  ADD COLUMN "nationalIdVerifiedBy" TEXT;
