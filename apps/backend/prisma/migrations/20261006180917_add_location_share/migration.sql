-- CreateEnum
CREATE TYPE "TrackingDeviceStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'OFFLINE', 'FAULT');

-- CreateEnum
CREATE TYPE "IncidentType" AS ENUM ('ACCIDENT', 'BREAKDOWN', 'THEFT', 'DAMAGE', 'TRAFFIC', 'OTHER');

-- CreateEnum
CREATE TYPE "IncidentStatus" AS ENUM ('REPORTED', 'UNDER_REVIEW', 'RESOLVED', 'CLOSED');

-- CreateEnum
CREATE TYPE "ComplianceDocumentType" AS ENUM ('INSURANCE', 'ROADWORTHINESS', 'VEHICLE_REGISTRATION', 'DRIVER_LICENSE', 'BUSINESS_LICENSE', 'OTHER');

-- CreateEnum
CREATE TYPE "ComplianceStatus" AS ENUM ('VALID', 'EXPIRING_SOON', 'EXPIRED', 'PENDING_RENEWAL');

-- CreateEnum
CREATE TYPE "OwnershipTransferStatus" AS ENUM ('PENDING_ELIGIBILITY', 'ELIGIBLE', 'REQUESTED', 'DOCUMENTS_REQUIRED', 'UNDER_REVIEW', 'APPROVED', 'TRANSFERRED', 'REJECTED', 'CANCELLED');

-- CreateTable
CREATE TABLE "tracking_devices" (
    "id" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "deviceSerial" TEXT NOT NULL,
    "deviceModel" TEXT,
    "simNumber" TEXT,
    "status" "TrackingDeviceStatus" NOT NULL DEFAULT 'INACTIVE',
    "lastSeenAt" TIMESTAMP(3),
    "firmwareVersion" TEXT,
    "notes" TEXT,
    "installedAt" TIMESTAMP(3),
    "installedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tracking_devices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "location_records" (
    "id" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "latitude" DECIMAL(10,7) NOT NULL,
    "longitude" DECIMAL(10,7) NOT NULL,
    "altitude" DECIMAL(8,2),
    "speed" DECIMAL(6,2),
    "heading" DECIMAL(5,2),
    "accuracy" DECIMAL(6,2),
    "address" TEXT,
    "isMoving" BOOLEAN NOT NULL DEFAULT false,
    "source" TEXT NOT NULL DEFAULT 'GPS',
    "recordedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "location_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "geofences" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "type" TEXT NOT NULL DEFAULT 'CIRCLE',
    "centerLat" DECIMAL(10,7),
    "centerLng" DECIMAL(10,7),
    "radiusMeters" DECIMAL(10,2),
    "polygon" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "ownerId" TEXT,
    "companyId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "geofences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vehicle_geofences" (
    "id" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "geofenceId" TEXT NOT NULL,
    "alertOnEntry" BOOLEAN NOT NULL DEFAULT true,
    "alertOnExit" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vehicle_geofences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tracking_alerts" (
    "id" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "deviceId" TEXT,
    "geofenceId" TEXT,
    "type" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "latitude" DECIMAL(10,7),
    "longitude" DECIMAL(10,7),
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "readAt" TIMESTAMP(3),
    "readBy" TEXT,
    "triggeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tracking_alerts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "location_shares" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "label" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "location_shares_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "incidents" (
    "id" TEXT NOT NULL,
    "incidentNumber" TEXT NOT NULL,
    "vehicleId" TEXT,
    "driverId" TEXT,
    "contractId" TEXT,
    "reportedBy" TEXT NOT NULL,
    "type" "IncidentType" NOT NULL,
    "status" "IncidentStatus" NOT NULL DEFAULT 'REPORTED',
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "incidentDate" TIMESTAMP(3) NOT NULL,
    "location" TEXT,
    "latitude" DECIMAL(10,7),
    "longitude" DECIMAL(10,7),
    "policeReference" TEXT,
    "insuranceClaim" TEXT,
    "estimatedDamage" DECIMAL(15,2),
    "currency" TEXT NOT NULL DEFAULT 'GHS',
    "resolvedAt" TIMESTAMP(3),
    "resolutionNotes" TEXT,
    "linkedDisputeId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "incidents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "incident_evidence" (
    "id" TEXT NOT NULL,
    "incidentId" TEXT NOT NULL,
    "uploadedBy" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileSize" INTEGER,
    "mimeType" TEXT,
    "description" TEXT,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "incident_evidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "compliance_records" (
    "id" TEXT NOT NULL,
    "vehicleId" TEXT,
    "driverId" TEXT,
    "documentType" "ComplianceDocumentType" NOT NULL,
    "status" "ComplianceStatus" NOT NULL DEFAULT 'VALID',
    "documentNumber" TEXT,
    "issuer" TEXT,
    "issueDate" TIMESTAMP(3),
    "expiryDate" TIMESTAMP(3),
    "fileUrl" TEXT,
    "fileName" TEXT,
    "notes" TEXT,
    "lastCheckedAt" TIMESTAMP(3),
    "reminderSentAt" TIMESTAMP(3),
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "compliance_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "push_tokens" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "deviceId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "push_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ownership_transfers" (
    "id" TEXT NOT NULL,
    "transferNumber" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "fromOwnerId" TEXT NOT NULL,
    "toUserId" TEXT NOT NULL,
    "requestedBy" TEXT NOT NULL,
    "status" "OwnershipTransferStatus" NOT NULL DEFAULT 'PENDING_ELIGIBILITY',
    "eligibilityNotes" TEXT,
    "reviewNotes" TEXT,
    "rejectionReason" TEXT,
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "transferredAt" TIMESTAMP(3),
    "requestedAt" TIMESTAMP(3),
    "documentsRequired" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ownership_transfers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tracking_devices_vehicleId_key" ON "tracking_devices"("vehicleId");

-- CreateIndex
CREATE UNIQUE INDEX "tracking_devices_deviceSerial_key" ON "tracking_devices"("deviceSerial");

-- CreateIndex
CREATE INDEX "tracking_devices_vehicleId_idx" ON "tracking_devices"("vehicleId");

-- CreateIndex
CREATE INDEX "tracking_devices_status_idx" ON "tracking_devices"("status");

-- CreateIndex
CREATE INDEX "location_records_deviceId_idx" ON "location_records"("deviceId");

-- CreateIndex
CREATE INDEX "location_records_vehicleId_idx" ON "location_records"("vehicleId");

-- CreateIndex
CREATE INDEX "location_records_recordedAt_idx" ON "location_records"("recordedAt");

-- CreateIndex
CREATE INDEX "geofences_isActive_idx" ON "geofences"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "vehicle_geofences_deviceId_geofenceId_key" ON "vehicle_geofences"("deviceId", "geofenceId");

-- CreateIndex
CREATE INDEX "tracking_alerts_vehicleId_idx" ON "tracking_alerts"("vehicleId");

-- CreateIndex
CREATE INDEX "tracking_alerts_isRead_idx" ON "tracking_alerts"("isRead");

-- CreateIndex
CREATE INDEX "tracking_alerts_triggeredAt_idx" ON "tracking_alerts"("triggeredAt");

-- CreateIndex
CREATE UNIQUE INDEX "location_shares_token_key" ON "location_shares"("token");

-- CreateIndex
CREATE INDEX "location_shares_token_idx" ON "location_shares"("token");

-- CreateIndex
CREATE INDEX "location_shares_vehicleId_idx" ON "location_shares"("vehicleId");

-- CreateIndex
CREATE INDEX "location_shares_ownerId_idx" ON "location_shares"("ownerId");

-- CreateIndex
CREATE UNIQUE INDEX "incidents_incidentNumber_key" ON "incidents"("incidentNumber");

-- CreateIndex
CREATE INDEX "incidents_vehicleId_idx" ON "incidents"("vehicleId");

-- CreateIndex
CREATE INDEX "incidents_driverId_idx" ON "incidents"("driverId");

-- CreateIndex
CREATE INDEX "incidents_status_idx" ON "incidents"("status");

-- CreateIndex
CREATE INDEX "incidents_incidentDate_idx" ON "incidents"("incidentDate");

-- CreateIndex
CREATE INDEX "incident_evidence_incidentId_idx" ON "incident_evidence"("incidentId");

-- CreateIndex
CREATE INDEX "compliance_records_vehicleId_idx" ON "compliance_records"("vehicleId");

-- CreateIndex
CREATE INDEX "compliance_records_driverId_idx" ON "compliance_records"("driverId");

-- CreateIndex
CREATE INDEX "compliance_records_documentType_idx" ON "compliance_records"("documentType");

-- CreateIndex
CREATE INDEX "compliance_records_status_idx" ON "compliance_records"("status");

-- CreateIndex
CREATE INDEX "compliance_records_expiryDate_idx" ON "compliance_records"("expiryDate");

-- CreateIndex
CREATE UNIQUE INDEX "push_tokens_token_key" ON "push_tokens"("token");

-- CreateIndex
CREATE INDEX "push_tokens_userId_idx" ON "push_tokens"("userId");

-- CreateIndex
CREATE INDEX "push_tokens_token_idx" ON "push_tokens"("token");

-- CreateIndex
CREATE UNIQUE INDEX "ownership_transfers_transferNumber_key" ON "ownership_transfers"("transferNumber");

-- CreateIndex
CREATE INDEX "ownership_transfers_vehicleId_idx" ON "ownership_transfers"("vehicleId");

-- CreateIndex
CREATE INDEX "ownership_transfers_contractId_idx" ON "ownership_transfers"("contractId");

-- CreateIndex
CREATE INDEX "ownership_transfers_fromOwnerId_idx" ON "ownership_transfers"("fromOwnerId");

-- CreateIndex
CREATE INDEX "ownership_transfers_toUserId_idx" ON "ownership_transfers"("toUserId");

-- CreateIndex
CREATE INDEX "ownership_transfers_status_idx" ON "ownership_transfers"("status");

-- AddForeignKey
ALTER TABLE "tracking_devices" ADD CONSTRAINT "tracking_devices_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "vehicles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "location_records" ADD CONSTRAINT "location_records_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "tracking_devices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicle_geofences" ADD CONSTRAINT "vehicle_geofences_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "tracking_devices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicle_geofences" ADD CONSTRAINT "vehicle_geofences_geofenceId_fkey" FOREIGN KEY ("geofenceId") REFERENCES "geofences"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tracking_alerts" ADD CONSTRAINT "tracking_alerts_geofenceId_fkey" FOREIGN KEY ("geofenceId") REFERENCES "geofences"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incident_evidence" ADD CONSTRAINT "incident_evidence_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "incidents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "push_tokens" ADD CONSTRAINT "push_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ownership_transfers" ADD CONSTRAINT "ownership_transfers_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "vehicles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ownership_transfers" ADD CONSTRAINT "ownership_transfers_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "contracts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
