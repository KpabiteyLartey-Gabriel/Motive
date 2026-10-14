-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('DRIVER', 'OWNER', 'COMPANY_ADMIN', 'COMPANY_MEMBER', 'FLEET_MANAGER', 'SERVICE_PROVIDER', 'LEGAL_PROFESSIONAL', 'ADMIN', 'SUPER_ADMIN');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('PENDING_VERIFICATION', 'ACTIVE', 'SUSPENDED', 'DEACTIVATED');

-- CreateEnum
CREATE TYPE "GenderType" AS ENUM ('MALE', 'FEMALE', 'OTHER', 'PREFER_NOT_TO_SAY');

-- CreateEnum
CREATE TYPE "IdentityDocumentType" AS ENUM ('GHANA_CARD', 'PASSPORT', 'VOTERS_ID', 'DRIVERS_LICENSE');

-- CreateEnum
CREATE TYPE "CompanyType" AS ENUM ('TRANSPORT', 'FLEET_MANAGEMENT', 'VEHICLE_PLACEMENT', 'MAINTENANCE', 'LEGAL_DISPUTE_RESOLUTION');

-- CreateEnum
CREATE TYPE "CompanyStatus" AS ENUM ('PENDING_VERIFICATION', 'ACTIVE', 'SUSPENDED', 'DEACTIVATED');

-- CreateEnum
CREATE TYPE "DriverStatus" AS ENUM ('PENDING_VERIFICATION', 'VERIFIED', 'ACTIVE', 'INACTIVE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "OwnerStatus" AS ENUM ('PENDING_VERIFICATION', 'VERIFIED', 'ACTIVE', 'INACTIVE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "VehicleStatus" AS ENUM ('DRAFT', 'PENDING_VERIFICATION', 'AVAILABLE', 'PENDING_ASSIGNMENT', 'ASSIGNED', 'ACTIVE', 'UNDER_MAINTENANCE', 'SUSPENDED', 'IN_DISPUTE', 'COMPLETED_WORK_AND_PAY', 'OWNERSHIP_TRANSFER_PENDING', 'TRANSFERRED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "OperatingModel" AS ENUM ('WORK_AND_PAY', 'RENTAL', 'DRIVING_ON');

-- CreateEnum
CREATE TYPE "FuelType" AS ENUM ('PETROL', 'DIESEL', 'ELECTRIC', 'HYBRID', 'LPG');

-- CreateEnum
CREATE TYPE "TransmissionType" AS ENUM ('MANUAL', 'AUTOMATIC');

-- CreateEnum
CREATE TYPE "VehicleType" AS ENUM ('SEDAN', 'SUV', 'PICKUP', 'MINIBUS', 'BUS', 'TRUCK', 'MOTORCYCLE', 'TRICYCLE', 'OTHER');

-- CreateEnum
CREATE TYPE "DocumentStatus" AS ENUM ('PENDING', 'VERIFIED', 'REJECTED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "ContractType" AS ENUM ('WORK_AND_PAY', 'RENTAL', 'DRIVING_ON', 'FLEET_MANAGEMENT', 'VEHICLE_PLACEMENT', 'MAINTENANCE_SERVICE', 'LEGAL_SERVICE');

-- CreateEnum
CREATE TYPE "ContractStatus" AS ENUM ('DRAFT', 'PENDING_SIGNATURES', 'ACTIVE', 'SUSPENDED', 'TERMINATED', 'EXPIRED', 'COMPLETED', 'IN_DISPUTE');

-- CreateEnum
CREATE TYPE "PaymentObligationType" AS ENUM ('INSTALLMENT', 'DAILY_SALES', 'WEEKLY_SALES', 'MANAGEMENT_FEE', 'PLACEMENT_FEE', 'MAINTENANCE_FEE', 'SERVICE_FEE');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('INITIATED', 'PENDING', 'PROCESSING', 'SUCCESSFUL', 'FAILED', 'REVERSED', 'REFUNDED', 'DISPUTED', 'SETTLED');

-- CreateEnum
CREATE TYPE "TransactionType" AS ENUM ('PAYMENT_IN', 'PAYMENT_OUT', 'FEE', 'REFUND', 'REVERSAL', 'ADJUSTMENT', 'SETTLEMENT');

-- CreateEnum
CREATE TYPE "TransactionDirection" AS ENUM ('DEBIT', 'CREDIT');

-- CreateEnum
CREATE TYPE "SettlementStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "MaintenanceStatus" AS ENUM ('REQUESTED', 'APPROVED', 'SCHEDULED', 'IN_PROGRESS', 'WAITING_FOR_PARTS', 'COMPLETED', 'CANCELLED', 'DISPUTED');

-- CreateEnum
CREATE TYPE "DisputeStatus" AS ENUM ('OPEN', 'UNDER_REVIEW', 'EVIDENCE_REQUESTED', 'AWAITING_RESPONSE', 'MEDIATION', 'ESCALATED', 'RESOLVED', 'CLOSED', 'REOPENED');

-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('IN_APP', 'SMS', 'EMAIL', 'PUSH');

-- CreateEnum
CREATE TYPE "NotificationStatus" AS ENUM ('PENDING', 'SENT', 'DELIVERED', 'FAILED', 'READ');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('CREATE', 'READ', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT', 'REGISTER', 'VERIFY', 'APPROVE', 'REJECT', 'SUSPEND', 'ACTIVATE', 'ASSIGN', 'UNASSIGN', 'PAYMENT_CREATE', 'PAYMENT_SUCCESS', 'PAYMENT_FAILED', 'PAYMENT_REVERSED', 'PAYMENT_REFUNDED', 'CONTRACT_CREATE', 'CONTRACT_ACCEPT', 'CONTRACT_TERMINATE', 'OWNERSHIP_TRANSFER_REQUEST', 'OWNERSHIP_TRANSFER_COMPLETE', 'ROLE_CHANGE', 'PERMISSION_CHANGE', 'DOCUMENT_UPLOAD', 'DOCUMENT_VERIFY', 'DISPUTE_CREATE', 'DISPUTE_RESOLVE');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "passwordHash" TEXT,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "otherNames" TEXT,
    "gender" "GenderType",
    "dateOfBirth" TIMESTAMP(3),
    "profilePhotoUrl" TEXT,
    "primaryRole" "UserRole" NOT NULL,
    "status" "UserStatus" NOT NULL DEFAULT 'PENDING_VERIFICATION',
    "emailVerifiedAt" TIMESTAMP(3),
    "phoneVerifiedAt" TIMESTAMP(3),
    "lastLoginAt" TIMESTAMP(3),
    "failedLoginAttempts" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ipAddress" TEXT,
    "userAgent" TEXT,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "password_resets" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_resets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification_codes" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "verification_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permissions" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "resource" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_permissions" (
    "id" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "permissionId" TEXT NOT NULL,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_role_assignments" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "companyId" TEXT,
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "grantedBy" TEXT,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "user_role_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "drivers" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "licenseNumber" TEXT,
    "licenseClass" TEXT,
    "licenseExpiryDate" TIMESTAMP(3),
    "identityDocType" "IdentityDocumentType",
    "identityDocNumber" TEXT,
    "ghanaCardNumber" TEXT,
    "address" TEXT,
    "city" TEXT,
    "region" TEXT,
    "emergencyContact" JSONB,
    "status" "DriverStatus" NOT NULL DEFAULT 'PENDING_VERIFICATION',
    "verifiedAt" TIMESTAMP(3),
    "verifiedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "drivers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "driver_documents" (
    "id" TEXT NOT NULL,
    "driverId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileSize" INTEGER,
    "mimeType" TEXT,
    "status" "DocumentStatus" NOT NULL DEFAULT 'PENDING',
    "expiryDate" TIMESTAMP(3),
    "verifiedAt" TIMESTAMP(3),
    "verifiedBy" TEXT,
    "rejectedAt" TIMESTAMP(3),
    "rejectReason" TEXT,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "driver_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "owners" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "ghanaCardNumber" TEXT,
    "address" TEXT,
    "city" TEXT,
    "region" TEXT,
    "bankName" TEXT,
    "bankAccountNumber" TEXT,
    "momoNumber" TEXT,
    "momoProvider" TEXT,
    "status" "OwnerStatus" NOT NULL DEFAULT 'PENDING_VERIFICATION',
    "verifiedAt" TIMESTAMP(3),
    "verifiedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "owners_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "companies" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "CompanyType" NOT NULL,
    "registrationNumber" TEXT,
    "tinNumber" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "city" TEXT,
    "region" TEXT,
    "logoUrl" TEXT,
    "bankName" TEXT,
    "bankAccountNumber" TEXT,
    "momoNumber" TEXT,
    "momoProvider" TEXT,
    "status" "CompanyStatus" NOT NULL DEFAULT 'PENDING_VERIFICATION',
    "verifiedAt" TIMESTAMP(3),
    "verifiedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "companies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "company_members" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'COMPANY_MEMBER',
    "title" TEXT,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leftAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "company_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vehicles" (
    "id" TEXT NOT NULL,
    "registrationNumber" TEXT NOT NULL,
    "vin" TEXT,
    "make" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "color" TEXT,
    "type" "VehicleType" NOT NULL,
    "fuelType" "FuelType" NOT NULL,
    "transmission" "TransmissionType" NOT NULL,
    "mileage" INTEGER,
    "engineNumber" TEXT,
    "chassisNumber" TEXT,
    "location" TEXT,
    "region" TEXT,
    "estimatedValue" DECIMAL(15,2),
    "currency" TEXT NOT NULL DEFAULT 'GHS',
    "status" "VehicleStatus" NOT NULL DEFAULT 'DRAFT',
    "operatingModel" "OperatingModel",
    "ownerId" TEXT,
    "managingCompanyId" TEXT,
    "currentDriverId" TEXT,
    "imageUrls" TEXT[],
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vehicles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vehicle_documents" (
    "id" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileSize" INTEGER,
    "mimeType" TEXT,
    "status" "DocumentStatus" NOT NULL DEFAULT 'PENDING',
    "expiryDate" TIMESTAMP(3),
    "verifiedAt" TIMESTAMP(3),
    "verifiedBy" TEXT,
    "rejectedAt" TIMESTAMP(3),
    "rejectReason" TEXT,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "uploadedBy" TEXT,

    CONSTRAINT "vehicle_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "driver_assignments" (
    "id" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "driverId" TEXT NOT NULL,
    "contractId" TEXT,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "assignedBy" TEXT,
    "notes" TEXT,

    CONSTRAINT "driver_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contracts" (
    "id" TEXT NOT NULL,
    "contractNumber" TEXT NOT NULL,
    "type" "ContractType" NOT NULL,
    "status" "ContractStatus" NOT NULL DEFAULT 'DRAFT',
    "vehicleId" TEXT,
    "title" TEXT,
    "description" TEXT,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "terms" JSONB,
    "responsibilityMatrix" JSONB,
    "notes" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "parentContractId" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contracts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contract_parties" (
    "id" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "userId" TEXT,
    "driverId" TEXT,
    "companyId" TEXT,
    "role" TEXT NOT NULL,
    "signedAt" TIMESTAMP(3),
    "signature" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contract_parties_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_and_pay_terms" (
    "id" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "vehicleValue" DECIMAL(15,2) NOT NULL,
    "depositAmount" DECIMAL(15,2) NOT NULL,
    "totalPayable" DECIMAL(15,2) NOT NULL,
    "installmentAmount" DECIMAL(15,2) NOT NULL,
    "installmentFrequency" TEXT NOT NULL,
    "totalInstallments" INTEGER NOT NULL,
    "paidInstallments" INTEGER NOT NULL DEFAULT 0,
    "totalPaid" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "remainingBalance" DECIMAL(15,2) NOT NULL,
    "latePenaltyRate" DECIMAL(5,4),
    "gracePeriodDays" INTEGER NOT NULL DEFAULT 3,
    "ownershipEligible" BOOLEAN NOT NULL DEFAULT false,
    "currency" TEXT NOT NULL DEFAULT 'GHS',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "work_and_pay_terms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rental_terms" (
    "id" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "salaryAmount" DECIMAL(15,2),
    "revenueSharePercent" DECIMAL(5,4),
    "paymentFrequency" TEXT NOT NULL,
    "driverPaysInsurance" BOOLEAN NOT NULL DEFAULT false,
    "driverPaysMaintenance" BOOLEAN NOT NULL DEFAULT false,
    "driverPaysFuel" BOOLEAN NOT NULL DEFAULT true,
    "workingHoursPerDay" DECIMAL(4,2),
    "workingDaysPerWeek" INTEGER,
    "currency" TEXT NOT NULL DEFAULT 'GHS',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rental_terms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "driving_on_terms" (
    "id" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "dailySalesAmount" DECIMAL(15,2) NOT NULL,
    "paymentFrequency" TEXT NOT NULL,
    "driverPaysInsurance" BOOLEAN NOT NULL DEFAULT false,
    "driverPaysMaintenance" BOOLEAN NOT NULL DEFAULT false,
    "driverPaysFuel" BOOLEAN NOT NULL DEFAULT true,
    "currency" TEXT NOT NULL DEFAULT 'GHS',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "driving_on_terms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_obligations" (
    "id" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "type" "PaymentObligationType" NOT NULL,
    "driverId" TEXT,
    "ownerId" TEXT,
    "companyId" TEXT,
    "amount" DECIMAL(15,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'GHS',
    "dueDate" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_obligations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_schedules" (
    "id" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "paymentObligationId" TEXT NOT NULL,
    "installmentNumber" INTEGER NOT NULL,
    "amount" DECIMAL(15,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'GHS',
    "dueDate" TIMESTAMP(3) NOT NULL,
    "paidAt" TIMESTAMP(3),
    "paidAmount" DECIMAL(15,2),
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "penaltyAmount" DECIMAL(15,2),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" TEXT NOT NULL,
    "paymentNumber" TEXT NOT NULL,
    "contractId" TEXT,
    "paymentObligationId" TEXT,
    "paymentScheduleId" TEXT,
    "driverId" TEXT,
    "ownerId" TEXT,
    "companyId" TEXT,
    "vehicleId" TEXT,
    "amount" DECIMAL(15,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'GHS',
    "payerPhone" TEXT,
    "payerName" TEXT,
    "paymentMethod" TEXT,
    "paymentProvider" TEXT,
    "providerReference" TEXT,
    "providerTransactionId" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'INITIATED',
    "initiatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "settlementStatus" "SettlementStatus" NOT NULL DEFAULT 'PENDING',
    "settledAt" TIMESTAMP(3),
    "webhookReceivedAt" TIMESTAMP(3),
    "metadata" JSONB,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transactions" (
    "id" TEXT NOT NULL,
    "transactionNumber" TEXT NOT NULL,
    "paymentId" TEXT,
    "contractId" TEXT,
    "vehicleId" TEXT,
    "driverId" TEXT,
    "ownerId" TEXT,
    "companyId" TEXT,
    "amount" DECIMAL(15,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'GHS',
    "type" "TransactionType" NOT NULL,
    "direction" "TransactionDirection" NOT NULL,
    "status" "PaymentStatus" NOT NULL,
    "description" TEXT,
    "reference" TEXT,
    "providerReference" TEXT,
    "settlementStatus" "SettlementStatus" NOT NULL DEFAULT 'PENDING',
    "settledAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "maintenance_requests" (
    "id" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "requestedBy" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "urgency" TEXT NOT NULL DEFAULT 'NORMAL',
    "status" "MaintenanceStatus" NOT NULL DEFAULT 'REQUESTED',
    "serviceProvider" TEXT,
    "scheduledDate" TIMESTAMP(3),
    "completedDate" TIMESTAMP(3),
    "estimatedCost" DECIMAL(15,2),
    "actualCost" DECIMAL(15,2),
    "currency" TEXT NOT NULL DEFAULT 'GHS',
    "paidBy" TEXT,
    "notes" TEXT,
    "approvedAt" TIMESTAMP(3),
    "approvedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "maintenance_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "disputes" (
    "id" TEXT NOT NULL,
    "disputeNumber" TEXT NOT NULL,
    "contractId" TEXT,
    "vehicleId" TEXT,
    "filedBy" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" "DisputeStatus" NOT NULL DEFAULT 'OPEN',
    "assignedTo" TEXT,
    "priority" TEXT NOT NULL DEFAULT 'NORMAL',
    "resolvedAt" TIMESTAMP(3),
    "resolution" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "disputes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dispute_parties" (
    "id" TEXT NOT NULL,
    "disputeId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dispute_parties_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dispute_messages" (
    "id" TEXT NOT NULL,
    "disputeId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "isInternal" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dispute_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dispute_evidence" (
    "id" TEXT NOT NULL,
    "disputeId" TEXT NOT NULL,
    "uploadedBy" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "description" TEXT,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dispute_evidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "channel" "NotificationChannel" NOT NULL,
    "type" TEXT NOT NULL,
    "subject" TEXT,
    "body" TEXT NOT NULL,
    "data" JSONB,
    "status" "NotificationStatus" NOT NULL DEFAULT 'PENDING',
    "sentAt" TIMESTAMP(3),
    "readAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "action" "AuditAction" NOT NULL,
    "resource" TEXT NOT NULL,
    "resourceId" TEXT,
    "previousData" JSONB,
    "newData" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "requestId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_settings" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'string',
    "category" TEXT,
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,

    CONSTRAINT "system_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_phone_key" ON "users"("phone");

-- CreateIndex
CREATE INDEX "users_email_idx" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_phone_idx" ON "users"("phone");

-- CreateIndex
CREATE INDEX "users_status_idx" ON "users"("status");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_token_key" ON "refresh_tokens"("token");

-- CreateIndex
CREATE INDEX "refresh_tokens_userId_idx" ON "refresh_tokens"("userId");

-- CreateIndex
CREATE INDEX "refresh_tokens_token_idx" ON "refresh_tokens"("token");

-- CreateIndex
CREATE UNIQUE INDEX "password_resets_token_key" ON "password_resets"("token");

-- CreateIndex
CREATE INDEX "password_resets_token_idx" ON "password_resets"("token");

-- CreateIndex
CREATE INDEX "verification_codes_userId_type_idx" ON "verification_codes"("userId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "roles_name_key" ON "roles"("name");

-- CreateIndex
CREATE UNIQUE INDEX "permissions_name_key" ON "permissions"("name");

-- CreateIndex
CREATE UNIQUE INDEX "role_permissions_roleId_permissionId_key" ON "role_permissions"("roleId", "permissionId");

-- CreateIndex
CREATE INDEX "user_role_assignments_userId_idx" ON "user_role_assignments"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "user_role_assignments_userId_roleId_companyId_key" ON "user_role_assignments"("userId", "roleId", "companyId");

-- CreateIndex
CREATE UNIQUE INDEX "drivers_userId_key" ON "drivers"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "drivers_licenseNumber_key" ON "drivers"("licenseNumber");

-- CreateIndex
CREATE UNIQUE INDEX "drivers_ghanaCardNumber_key" ON "drivers"("ghanaCardNumber");

-- CreateIndex
CREATE INDEX "drivers_userId_idx" ON "drivers"("userId");

-- CreateIndex
CREATE INDEX "drivers_status_idx" ON "drivers"("status");

-- CreateIndex
CREATE INDEX "driver_documents_driverId_idx" ON "driver_documents"("driverId");

-- CreateIndex
CREATE UNIQUE INDEX "owners_userId_key" ON "owners"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "owners_ghanaCardNumber_key" ON "owners"("ghanaCardNumber");

-- CreateIndex
CREATE INDEX "owners_userId_idx" ON "owners"("userId");

-- CreateIndex
CREATE INDEX "owners_status_idx" ON "owners"("status");

-- CreateIndex
CREATE UNIQUE INDEX "companies_registrationNumber_key" ON "companies"("registrationNumber");

-- CreateIndex
CREATE UNIQUE INDEX "companies_tinNumber_key" ON "companies"("tinNumber");

-- CreateIndex
CREATE INDEX "companies_type_idx" ON "companies"("type");

-- CreateIndex
CREATE INDEX "companies_status_idx" ON "companies"("status");

-- CreateIndex
CREATE INDEX "company_members_companyId_idx" ON "company_members"("companyId");

-- CreateIndex
CREATE INDEX "company_members_userId_idx" ON "company_members"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "company_members_companyId_userId_key" ON "company_members"("companyId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "vehicles_registrationNumber_key" ON "vehicles"("registrationNumber");

-- CreateIndex
CREATE UNIQUE INDEX "vehicles_vin_key" ON "vehicles"("vin");

-- CreateIndex
CREATE INDEX "vehicles_status_idx" ON "vehicles"("status");

-- CreateIndex
CREATE INDEX "vehicles_ownerId_idx" ON "vehicles"("ownerId");

-- CreateIndex
CREATE INDEX "vehicles_managingCompanyId_idx" ON "vehicles"("managingCompanyId");

-- CreateIndex
CREATE INDEX "vehicles_registrationNumber_idx" ON "vehicles"("registrationNumber");

-- CreateIndex
CREATE INDEX "vehicle_documents_vehicleId_idx" ON "vehicle_documents"("vehicleId");

-- CreateIndex
CREATE INDEX "driver_assignments_vehicleId_idx" ON "driver_assignments"("vehicleId");

-- CreateIndex
CREATE INDEX "driver_assignments_driverId_idx" ON "driver_assignments"("driverId");

-- CreateIndex
CREATE INDEX "driver_assignments_isActive_idx" ON "driver_assignments"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "contracts_contractNumber_key" ON "contracts"("contractNumber");

-- CreateIndex
CREATE INDEX "contracts_vehicleId_idx" ON "contracts"("vehicleId");

-- CreateIndex
CREATE INDEX "contracts_status_idx" ON "contracts"("status");

-- CreateIndex
CREATE INDEX "contracts_type_idx" ON "contracts"("type");

-- CreateIndex
CREATE INDEX "contract_parties_contractId_idx" ON "contract_parties"("contractId");

-- CreateIndex
CREATE UNIQUE INDEX "work_and_pay_terms_contractId_key" ON "work_and_pay_terms"("contractId");

-- CreateIndex
CREATE UNIQUE INDEX "rental_terms_contractId_key" ON "rental_terms"("contractId");

-- CreateIndex
CREATE UNIQUE INDEX "driving_on_terms_contractId_key" ON "driving_on_terms"("contractId");

-- CreateIndex
CREATE INDEX "payment_obligations_contractId_idx" ON "payment_obligations"("contractId");

-- CreateIndex
CREATE INDEX "payment_obligations_driverId_idx" ON "payment_obligations"("driverId");

-- CreateIndex
CREATE INDEX "payment_obligations_dueDate_idx" ON "payment_obligations"("dueDate");

-- CreateIndex
CREATE INDEX "payment_schedules_contractId_idx" ON "payment_schedules"("contractId");

-- CreateIndex
CREATE INDEX "payment_schedules_dueDate_idx" ON "payment_schedules"("dueDate");

-- CreateIndex
CREATE UNIQUE INDEX "payments_paymentNumber_key" ON "payments"("paymentNumber");

-- CreateIndex
CREATE UNIQUE INDEX "payments_idempotencyKey_key" ON "payments"("idempotencyKey");

-- CreateIndex
CREATE INDEX "payments_contractId_idx" ON "payments"("contractId");

-- CreateIndex
CREATE INDEX "payments_driverId_idx" ON "payments"("driverId");

-- CreateIndex
CREATE INDEX "payments_status_idx" ON "payments"("status");

-- CreateIndex
CREATE INDEX "payments_idempotencyKey_idx" ON "payments"("idempotencyKey");

-- CreateIndex
CREATE INDEX "payments_providerReference_idx" ON "payments"("providerReference");

-- CreateIndex
CREATE UNIQUE INDEX "transactions_transactionNumber_key" ON "transactions"("transactionNumber");

-- CreateIndex
CREATE INDEX "transactions_paymentId_idx" ON "transactions"("paymentId");

-- CreateIndex
CREATE INDEX "transactions_driverId_idx" ON "transactions"("driverId");

-- CreateIndex
CREATE INDEX "transactions_ownerId_idx" ON "transactions"("ownerId");

-- CreateIndex
CREATE INDEX "transactions_contractId_idx" ON "transactions"("contractId");

-- CreateIndex
CREATE INDEX "maintenance_requests_vehicleId_idx" ON "maintenance_requests"("vehicleId");

-- CreateIndex
CREATE INDEX "maintenance_requests_status_idx" ON "maintenance_requests"("status");

-- CreateIndex
CREATE UNIQUE INDEX "disputes_disputeNumber_key" ON "disputes"("disputeNumber");

-- CreateIndex
CREATE INDEX "disputes_contractId_idx" ON "disputes"("contractId");

-- CreateIndex
CREATE INDEX "disputes_vehicleId_idx" ON "disputes"("vehicleId");

-- CreateIndex
CREATE INDEX "disputes_status_idx" ON "disputes"("status");

-- CreateIndex
CREATE INDEX "dispute_parties_disputeId_idx" ON "dispute_parties"("disputeId");

-- CreateIndex
CREATE INDEX "dispute_messages_disputeId_idx" ON "dispute_messages"("disputeId");

-- CreateIndex
CREATE INDEX "dispute_evidence_disputeId_idx" ON "dispute_evidence"("disputeId");

-- CreateIndex
CREATE INDEX "notifications_userId_idx" ON "notifications"("userId");

-- CreateIndex
CREATE INDEX "notifications_status_idx" ON "notifications"("status");

-- CreateIndex
CREATE INDEX "notifications_type_idx" ON "notifications"("type");

-- CreateIndex
CREATE INDEX "audit_logs_actorId_idx" ON "audit_logs"("actorId");

-- CreateIndex
CREATE INDEX "audit_logs_action_idx" ON "audit_logs"("action");

-- CreateIndex
CREATE INDEX "audit_logs_resource_resourceId_idx" ON "audit_logs"("resource", "resourceId");

-- CreateIndex
CREATE INDEX "audit_logs_createdAt_idx" ON "audit_logs"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "system_settings_key_key" ON "system_settings"("key");

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "password_resets" ADD CONSTRAINT "password_resets_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "verification_codes" ADD CONSTRAINT "verification_codes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_role_assignments" ADD CONSTRAINT "user_role_assignments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_role_assignments" ADD CONSTRAINT "user_role_assignments_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "drivers" ADD CONSTRAINT "drivers_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "driver_documents" ADD CONSTRAINT "driver_documents_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "drivers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "owners" ADD CONSTRAINT "owners_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_members" ADD CONSTRAINT "company_members_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_members" ADD CONSTRAINT "company_members_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "owners"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_managingCompanyId_fkey" FOREIGN KEY ("managingCompanyId") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_currentDriverId_fkey" FOREIGN KEY ("currentDriverId") REFERENCES "drivers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicle_documents" ADD CONSTRAINT "vehicle_documents_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "vehicles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "driver_assignments" ADD CONSTRAINT "driver_assignments_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "vehicles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "driver_assignments" ADD CONSTRAINT "driver_assignments_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "drivers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "vehicles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_parentContractId_fkey" FOREIGN KEY ("parentContractId") REFERENCES "contracts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_parties" ADD CONSTRAINT "contract_parties_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "contracts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_parties" ADD CONSTRAINT "contract_parties_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "drivers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_and_pay_terms" ADD CONSTRAINT "work_and_pay_terms_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "contracts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rental_terms" ADD CONSTRAINT "rental_terms_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "contracts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "driving_on_terms" ADD CONSTRAINT "driving_on_terms_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "contracts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_obligations" ADD CONSTRAINT "payment_obligations_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "contracts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_schedules" ADD CONSTRAINT "payment_schedules_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "contracts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_schedules" ADD CONSTRAINT "payment_schedules_paymentObligationId_fkey" FOREIGN KEY ("paymentObligationId") REFERENCES "payment_obligations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "contracts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_paymentObligationId_fkey" FOREIGN KEY ("paymentObligationId") REFERENCES "payment_obligations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_paymentScheduleId_fkey" FOREIGN KEY ("paymentScheduleId") REFERENCES "payment_schedules"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "payments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dispute_parties" ADD CONSTRAINT "dispute_parties_disputeId_fkey" FOREIGN KEY ("disputeId") REFERENCES "disputes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dispute_messages" ADD CONSTRAINT "dispute_messages_disputeId_fkey" FOREIGN KEY ("disputeId") REFERENCES "disputes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dispute_evidence" ADD CONSTRAINT "dispute_evidence_disputeId_fkey" FOREIGN KEY ("disputeId") REFERENCES "disputes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
