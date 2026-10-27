CREATE TYPE "ServiceRequestStatus" AS ENUM ('REQUESTED', 'ACCEPTED', 'DECLINED', 'COMPLETED', 'CANCELLED');
CREATE TABLE "service_requests" ("id" TEXT NOT NULL, "providerServiceId" TEXT NOT NULL, "serviceProviderId" TEXT NOT NULL, "requestedBy" TEXT NOT NULL, "vehicleId" TEXT, "vehicleLabel" TEXT, "preferredDate" TIMESTAMP(3), "contactPhone" TEXT, "notes" TEXT, "status" "ServiceRequestStatus" NOT NULL DEFAULT 'REQUESTED', "providerNote" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "service_requests_pkey" PRIMARY KEY ("id"));
CREATE INDEX "service_requests_serviceProviderId_status_idx" ON "service_requests"("serviceProviderId", "status");
CREATE INDEX "service_requests_requestedBy_idx" ON "service_requests"("requestedBy");
ALTER TABLE "service_requests" ADD CONSTRAINT "service_requests_providerServiceId_fkey" FOREIGN KEY ("providerServiceId") REFERENCES "provider_services"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "service_requests" ADD CONSTRAINT "service_requests_serviceProviderId_fkey" FOREIGN KEY ("serviceProviderId") REFERENCES "service_providers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
