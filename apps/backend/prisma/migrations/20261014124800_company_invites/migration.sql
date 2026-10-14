-- CreateEnum
CREATE TYPE "CompanyInviteStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REVOKED', 'EXPIRED');

-- CreateTable
CREATE TABLE "company_invites" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "role" "UserRole" NOT NULL,
    "title" TEXT,
    "tokenHash" TEXT NOT NULL,
    "status" "CompanyInviteStatus" NOT NULL DEFAULT 'PENDING',
    "invitedBy" TEXT NOT NULL,
    "acceptedUserId" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "company_invites_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "company_invites_tokenHash_key" ON "company_invites"("tokenHash");

-- CreateIndex
CREATE INDEX "company_invites_companyId_idx" ON "company_invites"("companyId");

-- CreateIndex
CREATE INDEX "company_invites_status_idx" ON "company_invites"("status");

-- AddForeignKey
ALTER TABLE "company_invites" ADD CONSTRAINT "company_invites_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
