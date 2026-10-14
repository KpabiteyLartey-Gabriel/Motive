import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { AuditAction, TrackingDeviceStatus, UserRole } from '@prisma/client';
import {
  RegisterDeviceDto,
  UpdateDeviceStatusDto,
  IngestLocationDto,
  CreateGeofenceDto,
  CreateLocationShareDto,
} from './dto/tracking.dto';

@Injectable()
export class TrackingService {
  private readonly logger = new Logger(TrackingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  // ── Verify OWNER-only vehicle access ────────────────────────
  // Tracking is restricted to the vehicle owner (plus admin roles).
  // Drivers and other users must use a share token instead.
  private async assertOwnerAccess(vehicleId: string, userId: string, userRole: string) {
    const adminRoles: UserRole[] = [UserRole.ADMIN, UserRole.SUPER_ADMIN];
    if (adminRoles.includes(userRole as UserRole)) return;

    if (userRole === UserRole.COMPANY_ADMIN || userRole === UserRole.FLEET_MANAGER) {
      const vehicle = await this.getVehicleOrThrow(vehicleId);
      await this.assertFleetVehicleAccess(vehicle, userId, userRole);
      return;
    }

    if (userRole !== UserRole.OWNER) {
      throw new ForbiddenException('Only vehicle owners can access live tracking. Use a share link to view location.');
    }

    const vehicle = await this.prisma.vehicle.findUnique({ where: { id: vehicleId } });
    if (!vehicle) throw new NotFoundException('Vehicle not found');

    const owner = await this.prisma.owner.findUnique({ where: { userId } });
    if (!owner || vehicle.ownerId !== owner.id) {
      throw new ForbiddenException('You do not own this vehicle');
    }
  }

  // Fleet access: platform admins see everything; company admins and
  // fleet managers act only on vehicles their company manages; owners
  // act only on their own vehicles.
  async assertFleetVehicleAccess(vehicle: any, userId: string, userRole: string) {
    if (userRole === UserRole.ADMIN || userRole === UserRole.SUPER_ADMIN) return;
    if (userRole === UserRole.COMPANY_ADMIN || userRole === UserRole.FLEET_MANAGER) {
      if (!vehicle.managingCompanyId) throw new ForbiddenException('This vehicle is not managed by any company');
      const member = await this.prisma.companyMember.findFirst({
        where: { userId, companyId: vehicle.managingCompanyId, isActive: true },
      });
      if (!member) throw new ForbiddenException('This vehicle is not managed by your company');
      return;
    }
    if (userRole === UserRole.OWNER) {
      const owner = await this.prisma.owner.findUnique({ where: { userId } });
      if (!owner || vehicle.ownerId !== owner.id) throw new ForbiddenException('You do not own this vehicle');
      return;
    }
    throw new ForbiddenException('Access denied to this vehicle');
  }

  private async getVehicleOrThrow(vehicleId: string) {
    const vehicle = await this.prisma.vehicle.findUnique({ where: { id: vehicleId } });
    if (!vehicle) throw new NotFoundException('Vehicle not found');
    return vehicle;
  }

  // ── Register tracking device ────────────────────────────────
  async registerDevice(dto: RegisterDeviceDto, actorId: string, actorRole: string = UserRole.SUPER_ADMIN) {
    const vehicle = await this.prisma.vehicle.findUnique({ where: { id: dto.vehicleId } });
    if (!vehicle) throw new NotFoundException('Vehicle not found');
    await this.assertFleetVehicleAccess(vehicle, actorId, actorRole);

    const existing = await this.prisma.trackingDevice.findUnique({ where: { vehicleId: dto.vehicleId } });
    if (existing) throw new BadRequestException('Vehicle already has a tracking device registered');

    const device = await this.prisma.trackingDevice.create({
      data: {
        vehicleId: dto.vehicleId,
        deviceSerial: dto.deviceSerial,
        deviceModel: dto.deviceModel,
        simNumber: dto.simNumber,
        notes: dto.notes,
        status: TrackingDeviceStatus.INACTIVE,
        installedBy: actorId,
        installedAt: new Date(),
      },
      include: { vehicle: { select: { id: true, registrationNumber: true, make: true, model: true } } },
    });

    await this.audit.log({ actorId, action: AuditAction.CREATE, resource: 'tracking_device', resourceId: device.id, newData: { vehicleId: dto.vehicleId, deviceSerial: dto.deviceSerial } });
    return device;
  }

  // ── Get device for a vehicle ────────────────────────────────
  async getDeviceForVehicle(vehicleId: string, userId: string, userRole: string) {
    await this.assertOwnerAccess(vehicleId, userId, userRole);
    const device = await this.prisma.trackingDevice.findUnique({
      where: { vehicleId },
      include: { vehicle: { select: { id: true, registrationNumber: true, make: true, model: true } } },
    });
    if (!device) throw new NotFoundException('No tracking device registered for this vehicle');
    return device;
  }

  // ── Update device status ───────────────────────────────────
  async updateDeviceStatus(deviceId: string, dto: UpdateDeviceStatusDto, actorId: string, actorRole: string = UserRole.SUPER_ADMIN) {
    const device = await this.prisma.trackingDevice.findUnique({ where: { id: deviceId }, include: { vehicle: true } });
    if (!device) throw new NotFoundException('Device not found');
    await this.assertFleetVehicleAccess((device as any).vehicle, actorId, actorRole);

    const updated = await this.prisma.trackingDevice.update({
      where: { id: deviceId },
      data: { status: dto.status, ...(dto.status === TrackingDeviceStatus.ACTIVE ? { lastSeenAt: new Date() } : {}) },
    });

    await this.audit.log({ actorId, action: AuditAction.UPDATE, resource: 'tracking_device', resourceId: deviceId, newData: { status: dto.status } });
    return updated;
  }

  // ── Ingest location (called by device/GPS server) ──────────
  async ingestLocation(dto: IngestLocationDto) {
    const device = await this.prisma.trackingDevice.findUnique({ where: { deviceSerial: dto.deviceSerial } });
    if (!device) throw new NotFoundException('Device not found');
    if (device.status === TrackingDeviceStatus.INACTIVE) throw new BadRequestException('Device is inactive');

    const recordedAt = dto.recordedAt ? new Date(dto.recordedAt) : new Date();

    const record = await this.prisma.locationRecord.create({
      data: {
        deviceId: device.id,
        vehicleId: device.vehicleId,
        latitude: dto.latitude,
        longitude: dto.longitude,
        altitude: dto.altitude,
        speed: dto.speed,
        heading: dto.heading,
        accuracy: dto.accuracy,
        address: dto.address,
        isMoving: dto.isMoving ?? false,
        recordedAt,
      },
    });

    // Update device lastSeenAt
    await this.prisma.trackingDevice.update({
      where: { id: device.id },
      data: { lastSeenAt: new Date(), status: TrackingDeviceStatus.ACTIVE },
    });

    // Speed monitoring: raise a SPEEDING alert (throttled to one per
    // vehicle per 10 minutes so a fast trip does not flood the feed).
    const SPEED_LIMIT_KMH = 100;
    if (dto.speed != null && Number(dto.speed) > SPEED_LIMIT_KMH) {
      const recent = await this.prisma.trackingAlert.findFirst({
        where: {
          vehicleId: device.vehicleId, type: 'SPEEDING',
          triggeredAt: { gte: new Date(Date.now() - 10 * 60 * 1000) },
        },
      });
      if (!recent) {
        await this.prisma.trackingAlert.create({
          data: {
            vehicleId: device.vehicleId,
            deviceId: device.id,
            type: 'SPEEDING',
            description: `Speed ${Number(dto.speed)} km/h exceeds limit of ${SPEED_LIMIT_KMH} km/h`,
            latitude: dto.latitude,
            longitude: dto.longitude,
          },
        });
      }
    }

    return record;
  }

  // ── Remote device commands (engine off/on, …) ───────────────
  async issueCommand(vehicleId: string, dto: { type: 'ENGINE_OFF' | 'ENGINE_ON'; reason?: string }, userId: string, userRole: string) {
    const vehicle = await this.getVehicleOrThrow(vehicleId);
    await this.assertFleetVehicleAccess(vehicle, userId, userRole);
    const device = await this.prisma.trackingDevice.findUnique({ where: { vehicleId } });
    if (!device) throw new NotFoundException('No tracking device registered for this vehicle');

    const command = await this.prisma.deviceCommand.create({
      data: { deviceId: device.id, vehicleId, type: dto.type as any, reason: dto.reason, issuedBy: userId },
    });
    await this.audit.log({ actorId: userId, action: AuditAction.CREATE, resource: 'device_command', resourceId: command.id, newData: { vehicleId, type: dto.type } });
    return command;
  }

  async listCommands(vehicleId: string, userId: string, userRole: string) {
    const vehicle = await this.getVehicleOrThrow(vehicleId);
    await this.assertFleetVehicleAccess(vehicle, userId, userRole);
    const commands = await this.prisma.deviceCommand.findMany({
      where: { vehicleId }, orderBy: { createdAt: 'desc' }, take: 50,
    });
    return { vehicleId, commands };
  }

  // Device-side: poll pending commands (marks them SENT), same trust
  // model as location ingestion (device identified by serial).
  async listPendingCommands(deviceSerial: string) {
    const device = await this.prisma.trackingDevice.findUnique({ where: { deviceSerial } });
    if (!device) throw new NotFoundException('Device not found');
    const pending = await this.prisma.deviceCommand.findMany({
      where: { deviceId: device.id, status: 'PENDING' as any }, orderBy: { createdAt: 'asc' },
    });
    if (pending.length) {
      await this.prisma.deviceCommand.updateMany({
        where: { id: { in: pending.map((c: any) => c.id) } },
        data: { status: 'SENT' as any, deliveredAt: new Date() },
      });
    }
    return { deviceSerial, commands: pending };
  }

  async acknowledgeCommand(commandId: string, deviceSerial: string) {
    const command = await this.prisma.deviceCommand.findUnique({ where: { id: commandId }, include: { device: true } });
    if (!command) throw new NotFoundException('Command not found');
    if ((command as any).device.deviceSerial !== deviceSerial) {
      throw new ForbiddenException('Command does not belong to this device');
    }
    return this.prisma.deviceCommand.update({
      where: { id: commandId },
      data: { status: 'ACKNOWLEDGED' as any, acknowledgedAt: new Date() },
    });
  }

  // ── Get last known location ─────────────────────────────────
  async getLastLocation(vehicleId: string, userId: string, userRole: string) {
    await this.assertOwnerAccess(vehicleId, userId, userRole);

    const device = await this.prisma.trackingDevice.findUnique({ where: { vehicleId } });
    if (!device) throw new NotFoundException('No tracking device for this vehicle');

    const last = await this.prisma.locationRecord.findFirst({
      where: { vehicleId },
      orderBy: { recordedAt: 'desc' },
    });

    return { device, lastLocation: last ?? null };
  }

  // ── Get location history ────────────────────────────────────
  async getLocationHistory(
    vehicleId: string,
    userId: string,
    userRole: string,
    params: { from?: string; to?: string; limit?: number },
  ) {
    await this.assertOwnerAccess(vehicleId, userId, userRole);

    const { from, to, limit = 100 } = params;
    const where: any = { vehicleId };
    if (from || to) {
      where.recordedAt = {};
      if (from) where.recordedAt.gte = new Date(from);
      if (to) where.recordedAt.lte = new Date(to);
    }

    const records = await this.prisma.locationRecord.findMany({
      where,
      orderBy: { recordedAt: 'desc' },
      take: Math.min(limit, 500),
    });

    return { vehicleId, count: records.length, records };
  }

  // ── List devices (company roles see only their fleet) ──────
  async listDevices(params: { page?: number; limit?: number; status?: string }, actor?: { id: string; role: string }) {
    const { page = 1, limit = 20, status } = params;
    const skip = (Math.max(1, Math.floor(Number(page)) || 1) - 1) * (Math.max(1, Math.floor(Number(limit)) || 20));
    const where: any = {};
    if (status) where.status = status;
    if (actor && (actor.role === UserRole.COMPANY_ADMIN || actor.role === UserRole.FLEET_MANAGER)) {
      const memberships = await this.prisma.companyMember.findMany({
        where: { userId: actor.id, isActive: true }, select: { companyId: true },
      });
      where.vehicle = { managingCompanyId: { in: memberships.map((m: any) => m.companyId) } };
    }

    const [devices, total] = await this.prisma.$transaction([
      this.prisma.trackingDevice.findMany({
        where, skip, take: Math.max(1, Math.floor(Number(limit)) || 20), orderBy: { createdAt: 'desc' },
        include: {
          vehicle: { select: { id: true, registrationNumber: true, make: true, model: true, status: true } },
        },
      }),
      this.prisma.trackingDevice.count({ where }),
    ]);

    return { devices, pagination: { total, page, limit, totalPages: Math.ceil(total / (Math.max(1, Math.floor(Number(limit)) || 20))) } };
  }

  // ── Admin: list all alerts ──────────────────────────────────
  async listAlerts(params: { page?: number; limit?: number; vehicleId?: string; isRead?: boolean }) {
    const { page = 1, limit = 20, vehicleId, isRead } = params;
    const skip = (Math.max(1, Math.floor(Number(page)) || 1) - 1) * (Math.max(1, Math.floor(Number(limit)) || 20));
    const where: any = {};
    if (vehicleId) where.vehicleId = vehicleId;
    if (isRead !== undefined) where.isRead = isRead;

    const [alerts, total] = await this.prisma.$transaction([
      this.prisma.trackingAlert.findMany({
        where, skip, take: Math.max(1, Math.floor(Number(limit)) || 20), orderBy: { triggeredAt: 'desc' },
      }),
      this.prisma.trackingAlert.count({ where }),
    ]);

    return { alerts, pagination: { total, page, limit, totalPages: Math.ceil(total / (Math.max(1, Math.floor(Number(limit)) || 20))) } };
  }

  // ── Mark alert read ─────────────────────────────────────────
  async markAlertRead(alertId: string, userId: string) {
    const alert = await this.prisma.trackingAlert.findUnique({ where: { id: alertId } });
    if (!alert) throw new NotFoundException('Alert not found');

    return this.prisma.trackingAlert.update({
      where: { id: alertId },
      data: { isRead: true, readAt: new Date(), readBy: userId },
    });
  }

  // ── Create geofence ─────────────────────────────────────────
  async createGeofence(dto: CreateGeofenceDto, userId: string) {
    if (dto.type === 'CIRCLE' && (!dto.centerLat || !dto.centerLng || !dto.radiusMeters)) {
      throw new BadRequestException('Circle geofence requires centerLat, centerLng, and radiusMeters');
    }
    if (dto.type === 'POLYGON' && (!dto.polygon || dto.polygon.length < 3)) {
      throw new BadRequestException('Polygon geofence requires at least 3 points');
    }

    return this.prisma.geofence.create({
      data: {
        name: dto.name,
        description: dto.description,
        type: dto.type ?? 'CIRCLE',
        centerLat: dto.centerLat,
        centerLng: dto.centerLng,
        radiusMeters: dto.radiusMeters,
        polygon: dto.polygon as any,
        ownerId: userId,
      },
    });
  }

  // ── List geofences ──────────────────────────────────────────
  async listGeofences(userId: string, userRole: string) {
    const adminRoles: UserRole[] = [UserRole.ADMIN, UserRole.SUPER_ADMIN];
    const where: any = adminRoles.includes(userRole as UserRole)
      ? { isActive: true }
      : { isActive: true, ownerId: userId };

    return this.prisma.geofence.findMany({ where, orderBy: { createdAt: 'desc' } });
  }

  // ── Create a location share link ────────────────────────────
  async createLocationShare(dto: CreateLocationShareDto, userId: string) {
    // Only owners can share their own vehicles
    const owner = await this.prisma.owner.findUnique({ where: { userId } });
    if (!owner) throw new ForbiddenException('Only vehicle owners can share vehicle locations');

    const vehicle = await this.prisma.vehicle.findUnique({ where: { id: dto.vehicleId } });
    if (!vehicle) throw new NotFoundException('Vehicle not found');
    if (vehicle.ownerId !== owner.id) throw new ForbiddenException('You do not own this vehicle');

    const device = await this.prisma.trackingDevice.findUnique({ where: { vehicleId: dto.vehicleId } });
    if (!device) throw new BadRequestException('This vehicle has no tracking device installed');

    const expiresAt = new Date(Date.now() + dto.durationHours * 60 * 60 * 1000);

    const share = await this.prisma.locationShare.create({
      data: {
        vehicleId: dto.vehicleId,
        ownerId: userId,
        label: dto.label,
        expiresAt,
      },
    });

    await this.audit.log({
      actorId: userId,
      action: AuditAction.CREATE,
      resource: 'location_share',
      resourceId: share.id,
      newData: { vehicleId: dto.vehicleId, expiresAt, durationHours: dto.durationHours },
    });

    return {
      id: share.id,
      token: share.token,
      vehicleId: share.vehicleId,
      label: share.label,
      expiresAt: share.expiresAt,
    };
  }

  // ── List share links created by this owner ──────────────────
  async listLocationShares(userId: string) {
    const shares = await this.prisma.locationShare.findMany({
      where: { ownerId: userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    return shares;
  }

  // ── Revoke a share link ─────────────────────────────────────
  async revokeLocationShare(shareId: string, userId: string) {
    const share = await this.prisma.locationShare.findUnique({ where: { id: shareId } });
    if (!share) throw new NotFoundException('Share not found');
    if (share.ownerId !== userId) throw new ForbiddenException('You cannot revoke this share');

    const updated = await this.prisma.locationShare.update({
      where: { id: shareId },
      data: { revokedAt: new Date() },
    });

    await this.audit.log({
      actorId: userId,
      action: AuditAction.UPDATE,
      resource: 'location_share',
      resourceId: shareId,
      newData: { revokedAt: updated.revokedAt },
    });

    return updated;
  }

  // ── Resolve a share token (public — no auth required) ───────
  // Returns only the last location and a safe vehicle label.
  // Throws if token is expired, revoked, or not found.
  async resolveShareToken(token: string) {
    const share = await this.prisma.locationShare.findUnique({ where: { token } });

    if (!share) throw new NotFoundException('Share link not found or has expired');
    if (share.revokedAt) throw new ForbiddenException('This share link has been revoked');
    if (share.expiresAt < new Date()) throw new ForbiddenException('This share link has expired');

    const device = await this.prisma.trackingDevice.findUnique({ where: { vehicleId: share.vehicleId } });
    if (!device) throw new NotFoundException('Tracking device not found for this vehicle');

    const lastLocation = await this.prisma.locationRecord.findFirst({
      where: { vehicleId: share.vehicleId },
      orderBy: { recordedAt: 'desc' },
    });

    // Return only the minimum safe data — no owner details, no history
    const vehicle = await this.prisma.vehicle.findUnique({
      where: { id: share.vehicleId },
      select: { make: true, model: true, year: true, registrationNumber: true, color: true },
    });

    return {
      label: share.label,
      vehicle,
      expiresAt: share.expiresAt,
      lastLocation: lastLocation
        ? {
            latitude: lastLocation.latitude,
            longitude: lastLocation.longitude,
            speed: lastLocation.speed,
            heading: lastLocation.heading,
            isMoving: lastLocation.isMoving,
            recordedAt: lastLocation.recordedAt,
          }
        : null,
    };
  }
}
