import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { AuditAction, IncidentStatus, UserRole } from '@prisma/client';
import { CreateIncidentDto, UpdateIncidentStatusDto } from './dto/incident.dto';

@Injectable()
export class IncidentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  private generateIncidentNumber(): string {
    const ts = Date.now().toString(36).toUpperCase();
    const rand = Math.random().toString(36).substring(2, 5).toUpperCase();
    return `INC-${ts}-${rand}`;
  }

  // ── Create ─────────────────────────────────────────────────
  async create(userId: string, dto: CreateIncidentDto) {
    // If vehicleId provided, verify access
    if (dto.vehicleId) {
      const vehicle = await this.prisma.vehicle.findUnique({ where: { id: dto.vehicleId } });
      if (!vehicle) throw new NotFoundException('Vehicle not found');

      const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { primaryRole: true } });
      const adminRoles: UserRole[] = [UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.COMPANY_ADMIN, UserRole.FLEET_MANAGER];
      if (!adminRoles.includes(user?.primaryRole as UserRole)) {
        const driver = await this.prisma.driver.findUnique({ where: { userId } });
        const owner = await this.prisma.owner.findUnique({ where: { userId } });
        const isDriver = driver && vehicle.currentDriverId === driver.id;
        const isOwner = owner && vehicle.ownerId === owner.id;
        if (!isDriver && !isOwner) throw new ForbiddenException('Access denied to this vehicle');
      }
    }

    const driverProfile = await this.prisma.driver.findUnique({ where: { userId }, select: { id: true } });

    const incident = await this.prisma.incident.create({
      data: {
        incidentNumber: this.generateIncidentNumber(),
        vehicleId: dto.vehicleId,
        driverId: driverProfile?.id,
        contractId: dto.contractId,
        reportedBy: userId,
        type: dto.type,
        status: IncidentStatus.REPORTED,
        title: dto.title,
        description: dto.description,
        incidentDate: new Date(dto.incidentDate),
        location: dto.location,
        latitude: dto.latitude,
        longitude: dto.longitude,
        policeReference: dto.policeReference,
        insuranceClaim: dto.insuranceClaim,
        estimatedDamage: dto.estimatedDamage,
        currency: 'GHS',
      },
      include: { evidence: true },
    });

    await this.audit.log({
      actorId: userId,
      action: AuditAction.CREATE,
      resource: 'incident',
      resourceId: incident.id,
      newData: { type: dto.type, vehicleId: dto.vehicleId },
    });

    return incident;
  }

  // ── List ───────────────────────────────────────────────────
  async findAll(params: {
    page?: number;
    limit?: number;
    status?: string;
    type?: string;
    vehicleId?: string;
    userId: string;
    userRole: string;
  }) {
    const { page = 1, limit = 20, status, type, vehicleId, userId, userRole } = params;
    const skip = (Math.max(1, Math.floor(Number(page)) || 1) - 1) * (Math.max(1, Math.floor(Number(limit)) || 20));
    const where: any = {};

    if (status) where.status = status;
    if (type) where.type = type;
    if (vehicleId) where.vehicleId = vehicleId;

    const adminRoles: UserRole[] = [UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.COMPANY_ADMIN, UserRole.FLEET_MANAGER];
    if (!adminRoles.includes(userRole as UserRole)) {
      // Drivers see their own incidents; owners see incidents on their vehicles
      const driver = await this.prisma.driver.findUnique({ where: { userId }, select: { id: true } });
      const owner = await this.prisma.owner.findUnique({ where: { userId }, select: { id: true } });

      const orConditions: any[] = [{ reportedBy: userId }];
      if (driver) orConditions.push({ driverId: driver.id });
      if (owner) {
        const ownerVehicles = await this.prisma.vehicle.findMany({ where: { ownerId: owner.id }, select: { id: true } });
        if (ownerVehicles.length > 0) {
          orConditions.push({ vehicleId: { in: ownerVehicles.map((v) => v.id) } });
        }
      }
      where.OR = orConditions;
    }

    const [incidents, total] = await this.prisma.$transaction([
      this.prisma.incident.findMany({
        where, skip, take: Math.max(1, Math.floor(Number(limit)) || 20), orderBy: { incidentDate: 'desc' },
        include: { evidence: { select: { id: true, type: true, fileName: true, uploadedAt: true } } },
      }),
      this.prisma.incident.count({ where }),
    ]);

    return { incidents, pagination: { total, page, limit, totalPages: Math.ceil(total / (Math.max(1, Math.floor(Number(limit)) || 20))) } };
  }

  // ── Get by ID ──────────────────────────────────────────────
  async findById(incidentId: string, userId: string, userRole: string) {
    const incident = await this.prisma.incident.findUnique({
      where: { id: incidentId },
      include: { evidence: true },
    });
    if (!incident) throw new NotFoundException('Incident not found');

    const adminRoles: UserRole[] = [UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.COMPANY_ADMIN, UserRole.FLEET_MANAGER];
    if (!adminRoles.includes(userRole as UserRole)) {
      const driver = await this.prisma.driver.findUnique({ where: { userId }, select: { id: true } });
      const owner = await this.prisma.owner.findUnique({ where: { userId }, select: { id: true } });
      let hasAccess = incident.reportedBy === userId;
      if (driver) hasAccess = hasAccess || incident.driverId === driver.id;
      if (owner && incident.vehicleId) {
        const vehicle = await this.prisma.vehicle.findUnique({ where: { id: incident.vehicleId }, select: { ownerId: true } });
        hasAccess = hasAccess || vehicle?.ownerId === owner.id;
      }
      if (!hasAccess) throw new ForbiddenException('Access denied to this incident');
    }

    return incident;
  }

  // ── Update status ──────────────────────────────────────────
  async updateStatus(incidentId: string, userId: string, dto: UpdateIncidentStatusDto, userRole: string) {
    const adminRoles: UserRole[] = [UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.COMPANY_ADMIN, UserRole.FLEET_MANAGER];
    if (!adminRoles.includes(userRole as UserRole)) {
      throw new ForbiddenException('Only admin/fleet users can update incident status');
    }

    await this.findById(incidentId, userId, 'ADMIN');

    const updated = await this.prisma.incident.update({
      where: { id: incidentId },
      data: {
        status: dto.status,
        ...(dto.resolutionNotes ? { resolutionNotes: dto.resolutionNotes } : {}),
        ...(dto.linkedDisputeId ? { linkedDisputeId: dto.linkedDisputeId } : {}),
        ...(dto.status === IncidentStatus.RESOLVED || dto.status === IncidentStatus.CLOSED
          ? { resolvedAt: new Date() }
          : {}),
      },
      include: { evidence: true },
    });

    await this.audit.log({ actorId: userId, action: AuditAction.UPDATE, resource: 'incident', resourceId: incidentId, newData: { status: dto.status } });
    return updated;
  }

  // ── Admin: list all incidents ───────────────────────────────
  async listAll(params: { page?: number; limit?: number; status?: string; type?: string; vehicleId?: string }) {
    const { page = 1, limit = 20, status, type, vehicleId } = params;
    const skip = (Math.max(1, Math.floor(Number(page)) || 1) - 1) * (Math.max(1, Math.floor(Number(limit)) || 20));
    const where: any = {};
    if (status) where.status = status;
    if (type) where.type = type;
    if (vehicleId) where.vehicleId = vehicleId;

    const [incidents, total] = await this.prisma.$transaction([
      this.prisma.incident.findMany({
        where, skip, take: Math.max(1, Math.floor(Number(limit)) || 20), orderBy: { incidentDate: 'desc' },
        include: {
          evidence: { select: { id: true, type: true, fileName: true } },
        },
      }),
      this.prisma.incident.count({ where }),
    ]);

    return { incidents, pagination: { total, page, limit, totalPages: Math.ceil(total / (Math.max(1, Math.floor(Number(limit)) || 20))) } };
  }
}
