import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { AuditAction, DriverStatus, OwnerStatus, VehicleStatus, CompanyStatus } from '@prisma/client';

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  // ── Platform Stats ─────────────────────────────────────────
  async getStats() {
    const [
      totalUsers,
      totalDrivers,
      totalOwners,
      totalCompanies,
      totalVehicles,
      activeContracts,
      pendingDrivers,
      pendingOwners,
      pendingVehicles,
      pendingCompanies,
    ] = await this.prisma.$transaction([
      this.prisma.user.count({ where: { deletedAt: null } }),
      this.prisma.driver.count(),
      this.prisma.owner.count(),
      this.prisma.company.count(),
      this.prisma.vehicle.count(),
      this.prisma.contract.count({ where: { status: 'ACTIVE' } }),
      this.prisma.driver.count({ where: { status: DriverStatus.PENDING_VERIFICATION } }),
      this.prisma.owner.count({ where: { status: OwnerStatus.PENDING_VERIFICATION } }),
      this.prisma.vehicle.count({ where: { status: VehicleStatus.PENDING_VERIFICATION } }),
      this.prisma.company.count({ where: { status: CompanyStatus.PENDING_VERIFICATION } }),
    ]);

    return {
      totalUsers,
      totalDrivers,
      totalOwners,
      totalCompanies,
      totalVehicles,
      activeContracts,
      pendingVerification: {
        drivers: pendingDrivers,
        owners: pendingOwners,
        vehicles: pendingVehicles,
        companies: pendingCompanies,
        total: pendingDrivers + pendingOwners + pendingVehicles + pendingCompanies,
      },
    };
  }

  // ── Drivers ────────────────────────────────────────────────
  async listDrivers(params: {
    page?: number;
    limit?: number;
    search?: string;
    status?: string;
  }) {
    const { page = 1, limit = 20, search, status } = params;
    const skip = (Math.max(1, Math.floor(Number(page)) || 1) - 1) * (Math.max(1, Math.floor(Number(limit)) || 20));
    const where: any = {};

    if (status) where.status = status;
    if (search) {
      where.OR = [
        { user: { firstName: { contains: search, mode: 'insensitive' } } },
        { user: { lastName: { contains: search, mode: 'insensitive' } } },
        { user: { email: { contains: search, mode: 'insensitive' } } },
        { user: { phone: { contains: search } } },
        { licenseNumber: { contains: search } },
      ];
    }

    const [drivers, total] = await this.prisma.$transaction([
      this.prisma.driver.findMany({
        where,
        skip,
        take: Math.max(1, Math.floor(Number(limit)) || 20),
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
        },
      }),
      this.prisma.driver.count({ where }),
    ]);

    return { drivers, pagination: { total, page, limit, totalPages: Math.ceil(total / (Math.max(1, Math.floor(Number(limit)) || 20))) } };
  }

  async verifyDriver(driverId: string, status: DriverStatus, actorId: string) {
    const driver = await this.prisma.driver.findUnique({ where: { id: driverId } });
    if (!driver) throw new NotFoundException('Driver not found');

    const allowed: DriverStatus[] = [DriverStatus.VERIFIED, DriverStatus.ACTIVE, DriverStatus.SUSPENDED, DriverStatus.INACTIVE];
    if (!allowed.includes(status)) {
      throw new BadRequestException(`Invalid status: ${status}`);
    }

    const updated = await this.prisma.driver.update({
      where: { id: driverId },
      data: {
        status,
        ...(status === DriverStatus.VERIFIED ? { verifiedAt: new Date(), verifiedBy: actorId } : {}),
      },
    });

    await this.audit.log({ actorId, action: AuditAction.VERIFY, resource: 'driver', resourceId: driverId, newData: { status } });
    return updated;
  }

  // ── Owners ─────────────────────────────────────────────────
  async listOwners(params: { page?: number; limit?: number; search?: string; status?: string }) {
    const { page = 1, limit = 20, search, status } = params;
    const skip = (Math.max(1, Math.floor(Number(page)) || 1) - 1) * (Math.max(1, Math.floor(Number(limit)) || 20));
    const where: any = {};

    if (status) where.status = status;
    if (search) {
      where.OR = [
        { user: { firstName: { contains: search, mode: 'insensitive' } } },
        { user: { lastName: { contains: search, mode: 'insensitive' } } },
        { user: { email: { contains: search, mode: 'insensitive' } } },
        { user: { phone: { contains: search } } },
      ];
    }

    const [owners, total] = await this.prisma.$transaction([
      this.prisma.owner.findMany({
        where,
        skip,
        take: Math.max(1, Math.floor(Number(limit)) || 20),
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
          _count: { select: { vehicles: true } },
        },
      }),
      this.prisma.owner.count({ where }),
    ]);

    return { owners, pagination: { total, page, limit, totalPages: Math.ceil(total / (Math.max(1, Math.floor(Number(limit)) || 20))) } };
  }

  async verifyOwner(ownerId: string, status: OwnerStatus, actorId: string) {
    const owner = await this.prisma.owner.findUnique({ where: { id: ownerId } });
    if (!owner) throw new NotFoundException('Owner not found');

    const allowed: OwnerStatus[] = [OwnerStatus.VERIFIED, OwnerStatus.ACTIVE, OwnerStatus.SUSPENDED, OwnerStatus.INACTIVE];
    if (!allowed.includes(status)) throw new BadRequestException(`Invalid status: ${status}`);

    const updated = await this.prisma.owner.update({
      where: { id: ownerId },
      data: {
        status,
        ...(status === OwnerStatus.VERIFIED ? { verifiedAt: new Date(), verifiedBy: actorId } : {}),
      },
    });

    await this.audit.log({ actorId, action: AuditAction.VERIFY, resource: 'owner', resourceId: ownerId, newData: { status } });
    return updated;
  }

  // ── Companies ──────────────────────────────────────────────
  async listCompanies(params: { page?: number; limit?: number; search?: string; status?: string; type?: string }) {
    const { page = 1, limit = 20, search, status, type } = params;
    const skip = (Math.max(1, Math.floor(Number(page)) || 1) - 1) * (Math.max(1, Math.floor(Number(limit)) || 20));
    const where: any = {};

    if (status) where.status = status;
    if (type) where.type = type;
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { registrationNumber: { contains: search } },
      ];
    }

    const [companies, total] = await this.prisma.$transaction([
      this.prisma.company.findMany({
        where, skip, take: Math.max(1, Math.floor(Number(limit)) || 20), orderBy: { createdAt: 'desc' },
        include: { _count: { select: { members: true, vehicles: true } } },
      }),
      this.prisma.company.count({ where }),
    ]);

    return { companies, pagination: { total, page, limit, totalPages: Math.ceil(total / (Math.max(1, Math.floor(Number(limit)) || 20))) } };
  }

  async verifyCompany(companyId: string, status: CompanyStatus, actorId: string) {
    const company = await this.prisma.company.findUnique({ where: { id: companyId } });
    if (!company) throw new NotFoundException('Company not found');

    const allowed: CompanyStatus[] = [CompanyStatus.ACTIVE, CompanyStatus.SUSPENDED, CompanyStatus.DEACTIVATED];
    if (!allowed.includes(status)) throw new BadRequestException(`Invalid status: ${status}`);

    const updated = await this.prisma.company.update({
      where: { id: companyId },
      data: {
        status,
        ...(status === CompanyStatus.ACTIVE ? { verifiedAt: new Date(), verifiedBy: actorId } : {}),
      },
    });

    await this.audit.log({ actorId, action: AuditAction.VERIFY, resource: 'company', resourceId: companyId, newData: { status } });
    return updated;
  }

  // ── Vehicles ───────────────────────────────────────────────
  async verifyVehicle(vehicleId: string, status: VehicleStatus, actorId: string) {
    const vehicle = await this.prisma.vehicle.findUnique({ where: { id: vehicleId } });
    if (!vehicle) throw new NotFoundException('Vehicle not found');

    const allowed: VehicleStatus[] = [VehicleStatus.AVAILABLE, VehicleStatus.SUSPENDED, VehicleStatus.ARCHIVED];
    if (!allowed.includes(status)) throw new BadRequestException(`Invalid status: ${status}`);

    const updated = await this.prisma.vehicle.update({ where: { id: vehicleId }, data: { status } });
    await this.audit.log({ actorId, action: AuditAction.VERIFY, resource: 'vehicle', resourceId: vehicleId, newData: { status } });
    return updated;
  }

  // ── Contracts (admin view) ─────────────────────────────────
  async listContracts(params: { page?: number; limit?: number; status?: string; type?: string }) {
    const { page = 1, limit = 20, status, type } = params;
    const skip = (Math.max(1, Math.floor(Number(page)) || 1) - 1) * (Math.max(1, Math.floor(Number(limit)) || 20));
    const where: any = {};
    if (status) where.status = status;
    if (type) where.type = type;

    const [contracts, total] = await this.prisma.$transaction([
      this.prisma.contract.findMany({
        where, skip, take: Math.max(1, Math.floor(Number(limit)) || 20), orderBy: { createdAt: 'desc' },
        include: {
          vehicle: { select: { id: true, registrationNumber: true, make: true, model: true } },
          parties: { select: { userId: true, role: true, signedAt: true } },
          _count: { select: { payments: true } },
        },
      }),
      this.prisma.contract.count({ where }),
    ]);

    return { contracts, pagination: { total, page, limit, totalPages: Math.ceil(total / (Math.max(1, Math.floor(Number(limit)) || 20))) } };
  }

  // ── Payments (admin view) ──────────────────────────────────
  async listPayments(params: { page?: number; limit?: number; status?: string; contractId?: string }) {
    const { page = 1, limit = 20, status, contractId } = params;
    const skip = (Math.max(1, Math.floor(Number(page)) || 1) - 1) * (Math.max(1, Math.floor(Number(limit)) || 20));
    const where: any = {};
    if (status) where.status = status;
    if (contractId) where.contractId = contractId;

    const [payments, total] = await this.prisma.$transaction([
      this.prisma.payment.findMany({
        where, skip, take: Math.max(1, Math.floor(Number(limit)) || 20), orderBy: { createdAt: 'desc' },
      }),
      this.prisma.payment.count({ where }),
    ]);

    return { payments, pagination: { total, page, limit, totalPages: Math.ceil(total / (Math.max(1, Math.floor(Number(limit)) || 20))) } };
  }

  // ── Disputes (admin view) ──────────────────────────────────
  async listDisputes(params: { page?: number; limit?: number; status?: string; type?: string }) {
    const { page = 1, limit = 20, status, type } = params;
    const skip = (Math.max(1, Math.floor(Number(page)) || 1) - 1) * (Math.max(1, Math.floor(Number(limit)) || 20));
    const where: any = {};
    if (status) where.status = status;
    if (type) where.type = type;

    const [disputes, total] = await this.prisma.$transaction([
      this.prisma.dispute.findMany({
        where, skip, take: Math.max(1, Math.floor(Number(limit)) || 20), orderBy: { createdAt: 'desc' },
        include: {
          parties:  { select: { userId: true, role: true } },
          _count:   { select: { messages: true, evidence: true } },
        },
      }),
      this.prisma.dispute.count({ where }),
    ]);

    return { disputes, pagination: { total, page, limit, totalPages: Math.ceil(total / (Math.max(1, Math.floor(Number(limit)) || 20))) } };
  }

  // ── Maintenance (admin view) ───────────────────────────────
  async listMaintenance(params: { page?: number; limit?: number; status?: string }) {
    const { page = 1, limit = 20, status } = params;
    const skip = (Math.max(1, Math.floor(Number(page)) || 1) - 1) * (Math.max(1, Math.floor(Number(limit)) || 20));
    const where: any = {};
    if (status) where.status = status;

    const [requests, total] = await this.prisma.$transaction([
      this.prisma.maintenanceRequest.findMany({
        where, skip, take: Math.max(1, Math.floor(Number(limit)) || 20), orderBy: { createdAt: 'desc' },
      }),
      this.prisma.maintenanceRequest.count({ where }),
    ]);

    return { requests, pagination: { total, page, limit, totalPages: Math.ceil(total / (Math.max(1, Math.floor(Number(limit)) || 20))) } };
  }

  // ── Tracking devices (admin) ───────────────────────────────
  async listTrackingDevices(params: { page?: number; limit?: number; status?: string }) {
    const { page = 1, limit = 20, status } = params;
    const skip = (Math.max(1, Math.floor(Number(page)) || 1) - 1) * (Math.max(1, Math.floor(Number(limit)) || 20));
    const where: any = {};
    if (status) where.status = status;

    const [devices, total] = await this.prisma.$transaction([
      this.prisma.trackingDevice.findMany({
        where, skip, take: Math.max(1, Math.floor(Number(limit)) || 20), orderBy: { createdAt: 'desc' },
        include: { vehicle: { select: { id: true, registrationNumber: true, make: true, model: true } } },
      }),
      this.prisma.trackingDevice.count({ where }),
    ]);

    return { devices, pagination: { total, page, limit, totalPages: Math.ceil(total / (Math.max(1, Math.floor(Number(limit)) || 20))) } };
  }

  // ── Incidents (admin) ──────────────────────────────────────
  async listIncidents(params: { page?: number; limit?: number; status?: string; type?: string }) {
    const { page = 1, limit = 20, status, type } = params;
    const skip = (Math.max(1, Math.floor(Number(page)) || 1) - 1) * (Math.max(1, Math.floor(Number(limit)) || 20));
    const where: any = {};
    if (status) where.status = status;
    if (type) where.type = type;

    const [incidents, total] = await this.prisma.$transaction([
      this.prisma.incident.findMany({
        where, skip, take: Math.max(1, Math.floor(Number(limit)) || 20), orderBy: { incidentDate: 'desc' },
        include: { evidence: { select: { id: true, type: true, fileName: true } } },
      }),
      this.prisma.incident.count({ where }),
    ]);

    return { incidents, pagination: { total, page, limit, totalPages: Math.ceil(total / (Math.max(1, Math.floor(Number(limit)) || 20))) } };
  }

  // ── Compliance (admin) ─────────────────────────────────────
  async listCompliance(params: { page?: number; limit?: number; status?: string; documentType?: string }) {
    const { page = 1, limit = 20, status, documentType } = params;
    const skip = (Math.max(1, Math.floor(Number(page)) || 1) - 1) * (Math.max(1, Math.floor(Number(limit)) || 20));
    const where: any = {};
    if (status) where.status = status;
    if (documentType) where.documentType = documentType;

    const [records, total] = await this.prisma.$transaction([
      this.prisma.complianceRecord.findMany({ where, skip, take: Math.max(1, Math.floor(Number(limit)) || 20), orderBy: { expiryDate: 'asc' } }),
      this.prisma.complianceRecord.count({ where }),
    ]);

    return { records, pagination: { total, page, limit, totalPages: Math.ceil(total / (Math.max(1, Math.floor(Number(limit)) || 20))) } };
  }

  // ── Audit Logs ─────────────────────────────────────────────
  async listAuditLogs(params: {
    page?: number;
    limit?: number;
    resource?: string;
    actorId?: string;
    action?: string;
  }) {
    const { page = 1, limit = 30, resource, actorId, action } = params;
    const skip = (Math.max(1, Math.floor(Number(page)) || 1) - 1) * (Math.max(1, Math.floor(Number(limit)) || 20));
    const where: any = {};

    if (resource) where.resource = resource;
    if (actorId) where.actorId = actorId;
    if (action) where.action = action;

    const [logs, total] = await this.prisma.$transaction([
      this.prisma.auditLog.findMany({
        where, skip, take: Math.max(1, Math.floor(Number(limit)) || 20),
        orderBy: { createdAt: 'desc' },
        include: {
          actor: { select: { id: true, firstName: true, lastName: true, email: true } },
        },
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return { logs, pagination: { total, page, limit, totalPages: Math.ceil(total / (Math.max(1, Math.floor(Number(limit)) || 20))) } };
  }
}
