-- CreateEnum
CREATE TYPE "VehicleModelChangeStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');

-- CreateTable
CREATE TABLE "vehicle_operating_model_changes" (
    "id" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "fromModel" "OperatingModel",
    "toModel" "OperatingModel" NOT NULL,
    "requestedById" TEXT NOT NULL,
    "driverId" TEXT NOT NULL,
    "status" "VehicleModelChangeStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedAt" TIMESTAMP(3),
    "decidedById" TEXT,

    CONSTRAINT "vehicle_operating_model_changes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "vehicle_operating_model_changes_vehicleId_idx" ON "vehicle_operating_model_changes"("vehicleId");

-- CreateIndex
CREATE INDEX "vehicle_operating_model_changes_driverId_idx" ON "vehicle_operating_model_changes"("driverId");

-- CreateIndex
CREATE INDEX "vehicle_operating_model_changes_status_idx" ON "vehicle_operating_model_changes"("status");

-- AddForeignKey
ALTER TABLE "vehicle_operating_model_changes" ADD CONSTRAINT "vehicle_operating_model_changes_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "vehicles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
