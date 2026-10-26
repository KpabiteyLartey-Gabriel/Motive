-- Legal consultations: invite-only lawyers/firms brought into a chat.
CREATE TYPE "LegalConsultationStatus" AS ENUM ('AWAITING_CONSENT', 'AWAITING_PAYMENT', 'ACTIVE', 'DECLINED', 'COMPLETED', 'CANCELLED');

CREATE TABLE "legal_profiles" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "firmId" TEXT,
    "isFirmAdmin" BOOLEAN NOT NULL DEFAULT false,
    "consultationFee" DECIMAL(15,2),
    "bio" TEXT,
    "specialty" TEXT,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "verifiedAt" TIMESTAMP(3),
    "verifiedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "legal_profiles_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "legal_profiles_userId_key" ON "legal_profiles"("userId");
CREATE INDEX "legal_profiles_firmId_idx" ON "legal_profiles"("firmId");
CREATE INDEX "legal_profiles_verified_idx" ON "legal_profiles"("verified");
ALTER TABLE "legal_profiles" ADD CONSTRAINT "legal_profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "legal_profiles" ADD CONSTRAINT "legal_profiles_firmId_fkey" FOREIGN KEY ("firmId") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "legal_consultations" (
    "id" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "requesterUserId" TEXT NOT NULL,
    "otherPartyUserId" TEXT NOT NULL,
    "lawyerUserId" TEXT NOT NULL,
    "firmId" TEXT,
    "fee" DECIMAL(15,2) NOT NULL,
    "platformFeePercent" DECIMAL(5,2) NOT NULL,
    "platformFeeAmount" DECIMAL(15,2) NOT NULL,
    "lawyerAmount" DECIMAL(15,2) NOT NULL,
    "status" "LegalConsultationStatus" NOT NULL DEFAULT 'AWAITING_CONSENT',
    "consentAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "paymentReference" TEXT,
    "witnessedAt" TIMESTAMP(3),
    "witnessStatement" TEXT,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "legal_consultations_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "legal_consultations_threadId_idx" ON "legal_consultations"("threadId");
CREATE INDEX "legal_consultations_lawyerUserId_idx" ON "legal_consultations"("lawyerUserId");
CREATE INDEX "legal_consultations_firmId_idx" ON "legal_consultations"("firmId");
CREATE INDEX "legal_consultations_requesterUserId_idx" ON "legal_consultations"("requesterUserId");
ALTER TABLE "legal_consultations" ADD CONSTRAINT "legal_consultations_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "chat_threads"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "legal_consultations" ADD CONSTRAINT "legal_consultations_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "vehicles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "legal_invites" (
    "id" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "kind" TEXT NOT NULL,
    "firmName" TEXT,
    "firmId" TEXT,
    "tokenHash" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "invitedBy" TEXT NOT NULL,
    "acceptedUserId" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "legal_invites_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "legal_invites_tokenHash_key" ON "legal_invites"("tokenHash");
CREATE INDEX "legal_invites_status_idx" ON "legal_invites"("status");
