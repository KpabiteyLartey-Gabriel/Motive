import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { AuditAction, MaintenanceStatus, UserRole } from '@prisma/client';
import { CreateMaintenanceRequestDto, UpdateMaintenanceStatusDto } from './dto/maintenance.dto';

@Injectable()
export class MaintenanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  // ── Create request ─────────────────────────────────────────
  async create(userId: string, dto: CreateMaintenanceRequestDto) {
    // Verify user has access to the vehicle
    const vehicle = await this.prisma.vehicle.findUnique({ where: { id: dto.vehicleId } });
    if (!vehicle) throw new NotFoundException('Vehicle not found');

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { primaryRole: true },
    });

    const adminRoles: UserRole[] = [UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.COMPANY_ADMIN, UserRole.FLEET_MANAGER];
    const isAdmin = adminRoles.includes(user?.primaryRole as UserRole);

    if (!isAdmin) {
      // Driver or Owner must have a relationship to the vehicle
      const driver = await this.prisma.driver.findUnique({ where: { userId } });
      const owner = await this.prisma.owner.findUnique({ where: { userId } });
      const isDriver = driver && vehicle.currentDriverId === driver.id;
      const isOwner = owner && vehicle.ownerId === owner.id;
      if (!isDriver && !isOwner) {
        throw new ForbiddenException('Access denied to this vehicle');
      }
    }

    const request = await this.prisma.maintenanceRequest.create({
      data: {
        vehicleId: dto.vehicleId,
        requestedBy: userId,
        type: dto.type,
        description: dto.description,
        urgency: dto.urgency ?? 'NORMAL',
        estimatedCost: dto.estimatedCost,
        status: MaintenanceStatus.REQUESTED,
        currency: 'GHS',
      },
    });

    await this.audit.log({
      actorId: userId,
      action: AuditAction.CREATE,
      resource: 'maintenance',
      resourceId: request.id,
      newData: { type: dto.type, vehicleId: dto.vehicleId },
    });

    return request;
  }

  // ── List ───────────────────────────────────────────────────
  async findAll(params: {
    page?: number;
    limit?: number;
    status?: string;
    vehicleId?: string;
    userId: string;
    userRole: string;
  }) {
    const { page = 1, limit = 20, status, vehicleId, userId, userRole } = params;
    const skip = (Math.max(1, Math.floor(Number(page)) || 1) - 1) * (Math.max(1, Math.floor(Number(limit)) || 20));
    const where: any = {};

    if (status) where.status = status;
    if (vehicleId) where.vehicleId = vehicleId;

    // Non-admins scope to their vehicles
    const adminRoles: UserRole[] = [UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.COMPANY_ADMIN, UserRole.FLEET_MANAGER];
    if (!adminRoles.includes(userRole as UserRole)) {
      const driver = await this.prisma.driver.findUnique({ where: { userId } });
      const owner = await this.prisma.owner.findUnique({ where: { userId } });
      const vehicleIds: string[] = [];

      if (driver) {
        const driverVehicles = await this.prisma.vehicle.findMany({
          where: { currentDriverId: driver.id },
          select: { id: true },
        });
        vehicleIds.push(...driverVehicles.map((v) => v.id));
      }
      if (owner) {
        const ownerVehicles = await this.prisma.vehicle.findMany({
          where: { ownerId: owner.id },
          select: { id: true },
        });
        vehicleIds.push(...ownerVehicles.map((v) => v.id));
      }

      if (!vehicleId) where.vehicleId = { in: vehicleIds };
    }

    const [requests, total] = await this.prisma.$transaction([
      this.prisma.maintenanceRequest.findMany({
        where, skip, take: Math.max(1, Math.floor(Number(limit)) || 20), orderBy: { createdAt: 'desc' },
      }),
      this.prisma.maintenanceRequest.count({ where }),
    ]);

    return { requests, pagination: { total, page, limit, totalPages: Math.ceil(total / (Math.max(1, Math.floor(Number(limit)) || 20))) } };
  }

  // ── Get by ID ──────────────────────────────────────────────
  async findById(requestId: string, userId: string, userRole: string) {
    const request = await this.prisma.maintenanceRequest.findUnique({
      where: { id: requestId },
    });
    if (!request) throw new NotFoundException('Maintenance request not found');

    const adminRoles: UserRole[] = [UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.COMPANY_ADMIN, UserRole.FLEET_MANAGER];
    if (!adminRoles.includes(userRole as UserRole)) {
      const driver = await this.prisma.driver.findUnique({ where: { userId } });
      const owner = await this.prisma.owner.findUnique({ where: { userId } });
      const vehicle = await this.prisma.vehicle.findUnique({ where: { id: request.vehicleId } });
      const allowed =
        (driver && vehicle?.currentDriverId === driver.id) ||
        (owner && vehicle?.ownerId === owner.id) ||
        request.requestedBy === userId;
      if (!allowed) throw new ForbiddenException('Access denied');
    }

    return request;
  }

  // ── Update status ──────────────────────────────────────────
  async updateStatus(requestId: string, userId: string, dto: UpdateMaintenanceStatusDto, userRole: string) {
    const request = await this.findById(requestId, userId, userRole);

    const updated = await this.prisma.maintenanceRequest.update({
      where: { id: requestId },
      data: {
        status: dto.status as MaintenanceStatus,
        ...(dto.actualCost !== undefined ? { actualCost: dto.actualCost } : {}),
        ...(dto.notes ? { notes: dto.notes } : {}),
        ...(dto.status === 'APPROVED' ? { approvedAt: new Date(), approvedBy: userId } : {}),
        ...(dto.status === 'COMPLETED' ? { completedDate: new Date() } : {}),
      },
    });

    await this.audit.log({
      actorId: userId,
      action: AuditAction.UPDATE,
      resource: 'maintenance',
      resourceId: requestId,
      newData: { status: dto.status },
    });

    return updated;
  }
}
