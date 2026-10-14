import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { AuditAction, ComplianceStatus, UserRole } from '@prisma/client';
import { CreateComplianceRecordDto, UpdateComplianceStatusDto } from './dto/compliance.dto';

@Injectable()
export class ComplianceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  // ── Compute current status from expiry date ─────────────────
  private computeStatus(expiryDate?: Date | null): ComplianceStatus {
    if (!expiryDate) return ComplianceStatus.VALID;
    const now = new Date();
    const thirtyDays = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    if (expiryDate < now) return ComplianceStatus.EXPIRED;
    if (expiryDate < thirtyDays) return ComplianceStatus.EXPIRING_SOON;
    return ComplianceStatus.VALID;
  }

  // ── Verify access to vehicle/driver ────────────────────────
  private async assertVehicleOrDriverAccess(
    vehicleId: string | undefined,
    driverId: string | undefined,
    userId: string,
    userRole: string,
  ) {
    const adminRoles: UserRole[] = [UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.COMPANY_ADMIN, UserRole.FLEET_MANAGER, UserRole.SERVICE_PROVIDER];
    if (adminRoles.includes(userRole as UserRole)) return;

    if (vehicleId) {
      const vehicle = await this.prisma.vehicle.findUnique({ where: { id: vehicleId } });
      if (!vehicle) throw new NotFoundException('Vehicle not found');
      const owner = await this.prisma.owner.findUnique({ where: { userId }, select: { id: true } });
      const driver = await this.prisma.driver.findUnique({ where: { userId }, select: { id: true } });
      const isOwner = owner && vehicle.ownerId === owner.id;
      const isDriver = driver && vehicle.currentDriverId === driver.id;
      if (!isOwner && !isDriver) throw new ForbiddenException('Access denied to this vehicle');
    }

    if (driverId) {
      const driver = await this.prisma.driver.findUnique({ where: { id: driverId }, select: { userId: true } });
      if (!driver) throw new NotFoundException('Driver not found');
      if (driver.userId !== userId) throw new ForbiddenException('Access denied to this driver record');
    }
  }

  // ── Create record ───────────────────────────────────────────
  async create(userId: string, dto: CreateComplianceRecordDto, userRole: string = UserRole.ADMIN) {
    if (!dto.vehicleId && !dto.driverId) {
      throw new BadRequestException('Either vehicleId or driverId must be provided');
    }

    await this.assertVehicleOrDriverAccess(dto.vehicleId, dto.driverId, userId, userRole);

    const expiryDate = dto.expiryDate ? new Date(dto.expiryDate) : undefined;
    const computedStatus = this.computeStatus(expiryDate);

    const record = await this.prisma.complianceRecord.create({
      data: {
        vehicleId: dto.vehicleId,
        driverId: dto.driverId,
        documentType: dto.documentType,
        status: computedStatus,
        documentNumber: dto.documentNumber,
        issuer: dto.issuer,
        issueDate: dto.issueDate ? new Date(dto.issueDate) : undefined,
        expiryDate,
        fileUrl: dto.fileUrl,
        fileName: dto.fileName,
        notes: dto.notes,
        createdBy: userId,
        lastCheckedAt: new Date(),
      },
    });

    await this.audit.log({ actorId: userId, action: AuditAction.CREATE, resource: 'compliance', resourceId: record.id, newData: { documentType: dto.documentType } });
    return record;
  }

  // ── List for vehicle ────────────────────────────────────────
  async listForVehicle(vehicleId: string, userId: string, userRole: string) {
    await this.assertVehicleOrDriverAccess(vehicleId, undefined, userId, userRole);
    return this.prisma.complianceRecord.findMany({
      where: { vehicleId },
      orderBy: { expiryDate: 'asc' },
    });
  }

  // ── List for driver ─────────────────────────────────────────
  async listForDriver(driverId: string, userId: string, userRole: string) {
    const driver = await this.prisma.driver.findUnique({ where: { id: driverId }, select: { userId: true } });
    if (!driver) throw new NotFoundException('Driver not found');

    const adminRoles: UserRole[] = [UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.COMPANY_ADMIN, UserRole.FLEET_MANAGER];
    if (!adminRoles.includes(userRole as UserRole) && driver.userId !== userId) {
      throw new ForbiddenException('Access denied');
    }

    return this.prisma.complianceRecord.findMany({
      where: { driverId },
      orderBy: { expiryDate: 'asc' },
    });
  }

  // ── Get by ID ───────────────────────────────────────────────
  async findById(recordId: string, userId: string, userRole: string) {
    const record = await this.prisma.complianceRecord.findUnique({ where: { id: recordId } });
    if (!record) throw new NotFoundException('Compliance record not found');
    await this.assertVehicleOrDriverAccess(record.vehicleId ?? undefined, record.driverId ?? undefined, userId, userRole);
    return record;
  }

  // ── Update status ───────────────────────────────────────────
  async updateStatus(recordId: string, userId: string, dto: UpdateComplianceStatusDto, userRole: string) {
    const adminRoles: UserRole[] = [UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.COMPANY_ADMIN, UserRole.FLEET_MANAGER, UserRole.SERVICE_PROVIDER];
    if (!adminRoles.includes(userRole as UserRole)) {
      throw new ForbiddenException('Only admin/fleet users can update compliance status');
    }

    const record = await this.prisma.complianceRecord.findUnique({ where: { id: recordId } });
    if (!record) throw new NotFoundException('Compliance record not found');

    const expiryDate = dto.expiryDate ? new Date(dto.expiryDate) : record.expiryDate;
    const computedStatus = dto.status === ComplianceStatus.PENDING_RENEWAL
      ? ComplianceStatus.PENDING_RENEWAL
      : this.computeStatus(expiryDate);

    const updated = await this.prisma.complianceRecord.update({
      where: { id: recordId },
      data: {
        status: computedStatus,
        notes: dto.notes ?? record.notes,
        expiryDate: expiryDate ?? undefined,
        lastCheckedAt: new Date(),
      },
    });

    await this.audit.log({ actorId: userId, action: AuditAction.UPDATE, resource: 'compliance', resourceId: recordId, newData: { status: computedStatus } });
    return updated;
  }

  // ── Admin: list all with optional filters ───────────────────
  async listAll(params: { page?: number; limit?: number; status?: string; documentType?: string; vehicleId?: string; driverId?: string }) {
    const { page = 1, limit = 20, status, documentType, vehicleId, driverId } = params;
    const skip = (Math.max(1, Math.floor(Number(page)) || 1) - 1) * (Math.max(1, Math.floor(Number(limit)) || 20));
    const where: any = {};
    if (status) where.status = status;
    if (documentType) where.documentType = documentType;
    if (vehicleId) where.vehicleId = vehicleId;
    if (driverId) where.driverId = driverId;

    const [records, total] = await this.prisma.$transaction([
      this.prisma.complianceRecord.findMany({ where, skip, take: Math.max(1, Math.floor(Number(limit)) || 20), orderBy: { expiryDate: 'asc' } }),
      this.prisma.complianceRecord.count({ where }),
    ]);

    return { records, pagination: { total, page, limit, totalPages: Math.ceil(total / (Math.max(1, Math.floor(Number(limit)) || 20))) } };
  }

  // ── Refresh all computed statuses (called by cron or admin) ─
  async refreshAllStatuses() {
    const records = await this.prisma.complianceRecord.findMany({
      where: { expiryDate: { not: null } },
      select: { id: true, expiryDate: true },
    });

    let updated = 0;
    for (const record of records) {
      const newStatus = this.computeStatus(record.expiryDate);
      await this.prisma.complianceRecord.update({
        where: { id: record.id },
        data: { status: newStatus, lastCheckedAt: new Date() },
      });
      updated++;
    }

    return { refreshed: updated };
  }
}
