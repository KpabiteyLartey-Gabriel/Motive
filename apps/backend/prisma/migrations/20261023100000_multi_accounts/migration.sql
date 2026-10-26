-- Multi-account system: one user can hold Driver, Owner, and
-- Service Provider accounts at the same time (plus company memberships).
CREATE TYPE "ServiceProviderStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'SUSPENDED');

CREATE TABLE "service_providers" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "businessName" TEXT NOT NULL,
    "serviceType" TEXT NOT NULL,
    "phone" TEXT,
    "address" TEXT,
    "city" TEXT,
    "region" TEXT,
    "status" "ServiceProviderStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "service_providers_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "service_providers_userId_key" ON "service_providers"("userId");
CREATE INDEX "service_providers_userId_idx" ON "service_providers"("userId");

ALTER TABLE "service_providers" ADD CONSTRAINT "service_providers_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
