-- Explore marketplace: driver interests, in-app chat, contract access codes.
CREATE TYPE "VehicleInterestStatus" AS ENUM ('PENDING', 'APPROVED', 'DECLINED', 'RELEASED');
CREATE TYPE "ContractAccessCodeStatus" AS ENUM ('ACTIVE', 'USED', 'REVOKED');

CREATE TABLE "vehicle_interests" (
  "id" TEXT NOT NULL,
  "vehicleId" TEXT NOT NULL,
  "driverId" TEXT NOT NULL,
  "driverUserId" TEXT NOT NULL,
  "status" "VehicleInterestStatus" NOT NULL DEFAULT 'PENDING',
  "message" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "decidedAt" TIMESTAMP(3),
  "decidedById" TEXT,
  CONSTRAINT "vehicle_interests_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "vehicle_interests_vehicleId_driverId_key" ON "vehicle_interests"("vehicleId", "driverId");
CREATE INDEX "vehicle_interests_vehicleId_idx" ON "vehicle_interests"("vehicleId");
CREATE INDEX "vehicle_interests_driverUserId_idx" ON "vehicle_interests"("driverUserId");
CREATE INDEX "vehicle_interests_status_idx" ON "vehicle_interests"("status");
ALTER TABLE "vehicle_interests" ADD CONSTRAINT "vehicle_interests_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "vehicles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "vehicle_interests" ADD CONSTRAINT "vehicle_interests_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "drivers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "chat_threads" (
  "id" TEXT NOT NULL,
  "vehicleId" TEXT NOT NULL,
  "interestId" TEXT NOT NULL,
  "ownerUserId" TEXT NOT NULL,
  "driverUserId" TEXT NOT NULL,
  "lastMessageAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "chat_threads_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "chat_threads_interestId_key" ON "chat_threads"("interestId");
CREATE INDEX "chat_threads_ownerUserId_idx" ON "chat_threads"("ownerUserId");
CREATE INDEX "chat_threads_driverUserId_idx" ON "chat_threads"("driverUserId");
CREATE INDEX "chat_threads_vehicleId_idx" ON "chat_threads"("vehicleId");
ALTER TABLE "chat_threads" ADD CONSTRAINT "chat_threads_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "vehicles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "chat_threads" ADD CONSTRAINT "chat_threads_interestId_fkey" FOREIGN KEY ("interestId") REFERENCES "vehicle_interests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "chat_messages" (
  "id" TEXT NOT NULL,
  "threadId" TEXT NOT NULL,
  "senderUserId" TEXT NOT NULL,
  "body" TEXT,
  "attachmentUrl" TEXT,
  "attachmentName" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "readAt" TIMESTAMP(3),
  CONSTRAINT "chat_messages_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "chat_messages_threadId_idx" ON "chat_messages"("threadId");
CREATE INDEX "chat_messages_senderUserId_idx" ON "chat_messages"("senderUserId");
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "chat_threads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "contract_access_codes" (
  "id" TEXT NOT NULL,
  "contractId" TEXT NOT NULL,
  "vehicleId" TEXT NOT NULL,
  "driverUserId" TEXT NOT NULL,
  "codeHash" TEXT NOT NULL,
  "status" "ContractAccessCodeStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "usedAt" TIMESTAMP(3),
  CONSTRAINT "contract_access_codes_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "contract_access_codes_contractId_idx" ON "contract_access_codes"("contractId");
CREATE INDEX "contract_access_codes_driverUserId_idx" ON "contract_access_codes"("driverUserId");
CREATE INDEX "contract_access_codes_vehicleId_idx" ON "contract_access_codes"("vehicleId");
ALTER TABLE "contract_access_codes" ADD CONSTRAINT "contract_access_codes_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "contracts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "contract_access_codes" ADD CONSTRAINT "contract_access_codes_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "vehicles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
