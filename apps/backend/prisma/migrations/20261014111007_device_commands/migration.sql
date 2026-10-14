-- CreateEnum
CREATE TYPE "DeviceCommandType" AS ENUM ('ENGINE_OFF', 'ENGINE_ON');

-- CreateEnum
CREATE TYPE "DeviceCommandStatus" AS ENUM ('PENDING', 'SENT', 'ACKNOWLEDGED', 'FAILED');

-- CreateTable
CREATE TABLE "device_commands" (
    "id" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "type" "DeviceCommandType" NOT NULL,
    "status" "DeviceCommandStatus" NOT NULL DEFAULT 'PENDING',
    "reason" TEXT,
    "issuedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deliveredAt" TIMESTAMP(3),
    "acknowledgedAt" TIMESTAMP(3),

    CONSTRAINT "device_commands_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "device_commands_deviceId_idx" ON "device_commands"("deviceId");

-- CreateIndex
CREATE INDEX "device_commands_vehicleId_idx" ON "device_commands"("vehicleId");

-- CreateIndex
CREATE INDEX "device_commands_status_idx" ON "device_commands"("status");

-- AddForeignKey
ALTER TABLE "device_commands" ADD CONSTRAINT "device_commands_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "tracking_devices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
