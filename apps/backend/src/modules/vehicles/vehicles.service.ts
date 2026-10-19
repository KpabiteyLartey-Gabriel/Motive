import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateVehicleDto } from './dto/create-vehicle.dto';
import { VehicleStatus, UserRole, OperatingModel } from '@prisma/client';

@Injectable()
export class VehiclesService {
  constructor(private readonly prisma: PrismaService) {}

  // OWNER accounts are not always provisioned with an Owner profile
  // (registration historically created only the User). Create it on first
  // use so owners can register vehicles and manage their photos.
  async ensureOwnerProfile(userId: string) {
    const existing = await this.prisma.owner.findUnique({ where: { userId } });
    if (existing) return existing;
    return this.prisma.owner.create({ data: { userId } });
  }

  async create(userId: string, dto: CreateVehicleDto) {
    // Verify the user is an owner or company admin
    let owner = await this.prisma.owner.findUnique({ where: { userId } });
    const companyMember = await this.prisma.companyMember.findFirst({
      where: { userId, isActive: true, role: { in: ['COMPANY_ADMIN', 'FLEET_MANAGER'] as any } },
    });

    if (!owner && !companyMember) {
      const user = await this.prisma.user?.findUnique?.({ where: { id: userId }, select: { primaryRole: true } }).catch(() => null);
      if (user?.primaryRole === UserRole.OWNER) owner = await this.ensureOwnerProfile(userId);
    }

    if (!owner && !companyMember) {
      throw new ForbiddenException('Only vehicle owners or company admins can register vehicles');
    }

    const ownerId = owner?.id || null;
    const managingCompanyId = companyMember?.companyId || null;

    const { publish, ...vehicleData } = dto as any;
    const imageUrls = dto.imageUrls ? this.validatePhotoUrls(dto.imageUrls) : [];
    return this.prisma.vehicle.create({
      data: {
        ...vehicleData,
        imageUrls,
        ownerId,
        managingCompanyId,
        // Publishing makes the vehicle AVAILABLE for contracts/drivers;
        // otherwise it stays a private DRAFT only the owner can see.
        status: publish ? VehicleStatus.AVAILABLE : VehicleStatus.DRAFT,
      },
    });
  }

  async findAll(params: {
    page?: number;
    limit?: number;
    status?: VehicleStatus;
    ownerId?: string;
    userId?: string;
    userRole?: string;
  }) {
    const { page = 1, limit = 20, status, ownerId, userId, userRole } = params;
    const skip = (Math.max(1, Math.floor(Number(page)) || 1) - 1) * (Math.max(1, Math.floor(Number(limit)) || 20));
    const where: any = {};

    if (status) where.status = status;
    if (ownerId) where.ownerId = ownerId;

    // Role-scoped listing. A scoped role must never fall back to an
    // unfiltered list: previously an OWNER without an Owner profile saw
    // every vehicle, then correctly failed the ownership check on upload.
    const take0 = Math.max(1, Math.floor(Number(limit)) || 20);
    const page0 = Math.max(1, Math.floor(Number(page)) || 1);
    const empty = { vehicles: [] as any[], pagination: { total: 0, page: page0, limit: take0, totalPages: 0 } };

    if (userId && userRole === UserRole.OWNER) {
      const owner = await this.ensureOwnerProfile(userId);
      where.ownerId = owner.id;
    } else if (userId && userRole === UserRole.DRIVER) {
      const driver = await this.prisma.driver.findUnique({ where: { userId } });
      if (!driver) return empty;
      // Assigned directly (currentDriverId) or via an ACTIVE contract party —
      // contract activation does not always populate currentDriverId.
      where.OR = [
        { currentDriverId: driver.id },
        { contracts: { some: { status: 'ACTIVE', parties: { some: { OR: [{ driverId: driver.id }, { userId, role: 'DRIVER' }] } } } } },
      ];
    } else if (userId && [UserRole.COMPANY_ADMIN, UserRole.COMPANY_MEMBER, UserRole.FLEET_MANAGER].some((r) => r === userRole)) {
      const memberships = await this.prisma.companyMember.findMany({
        where: { userId, isActive: true }, select: { companyId: true },
      });
      if (!memberships.length) return empty;
      where.managingCompanyId = { in: memberships.map((m: any) => m.companyId) };
    }

    const [vehicles, total] = await this.prisma.$transaction([
      this.prisma.vehicle.findMany({
        where,
        skip,
        take: Math.max(1, Math.floor(Number(limit)) || 20),
        orderBy: { createdAt: 'desc' },
        include: {
          owner: {
            include: {
              user: {
                select: { firstName: true, lastName: true, phone: true },
              },
            },
          },
        },
      }),
      this.prisma.vehicle.count({ where }),
    ]);

    return {
      vehicles,
      pagination: { total, page, limit, totalPages: Math.ceil(total / (Math.max(1, Math.floor(Number(limit)) || 20))) },
    };
  }

  async findById(id: string, requestingUserId: string, requestingUserRole: string) {
    const vehicle = await this.prisma.vehicle.findUnique({
      where: { id },
      include: {
        owner: {
          include: {
            user: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
          },
        },
        currentDriver: {
          include: {
            user: { select: { id: true, firstName: true, lastName: true, phone: true } },
          },
        },
        documents: true,
      },
    });

    if (!vehicle) throw new NotFoundException('Vehicle not found');

    // Resource-level authorization: prevent IDOR
    await this.assertVehicleAccess(vehicle, requestingUserId, requestingUserRole);

    return vehicle;
  }

  async updateStatus(vehicleId: string, status: VehicleStatus, requestingUserId: string, requestingUserRole: string) {
    const vehicle = await this.prisma.vehicle.findUnique({ where: { id: vehicleId } });
    if (!vehicle) throw new NotFoundException('Vehicle not found');

    await this.assertVehicleAccess(vehicle, requestingUserId, requestingUserRole);

    // Owners (and fleet roles) may only publish/unpublish their own vehicle:
    // DRAFT -> AVAILABLE (publish) and AVAILABLE -> DRAFT (unpublish).
    // Lifecycle states (ASSIGNED, ACTIVE, UNDER_MAINTENANCE, …) are driven
    // by contracts and maintenance, never set directly here.
    const isAdmin = requestingUserRole === UserRole.ADMIN || requestingUserRole === UserRole.SUPER_ADMIN;
    if (!isAdmin) {
      const publishable = vehicle.status === VehicleStatus.DRAFT || vehicle.status === VehicleStatus.AVAILABLE;
      const targetOk = status === VehicleStatus.DRAFT || status === VehicleStatus.AVAILABLE;
      if (!publishable || !targetOk) {
        throw new ForbiddenException('You can only publish a draft vehicle or unpublish an available one. This vehicle is managed by its contract or maintenance state.');
      }
    }

    return this.prisma.vehicle.update({
      where: { id: vehicleId },
      data: { status },
    });
  }

  // ── Contract type (operating model) changes ─────────────────
  // The type is chosen before publishing. After a driver is assigned:
  //  - Work & Pay: the vehicle is becoming the driver's own, so an owner's
  //    change must be approved by the assigned driver first.
  //  - DriveOn / Rental: no ownership is promised, so the owner or the
  //    assigned driver can change the type directly.
  private async getAssignedDriver(vehicle: any) {
    if (vehicle.currentDriverId) {
      return this.prisma.driver.findUnique({ where: { id: vehicle.currentDriverId } });
    }
    const contract = await this.prisma.contract.findFirst({
      where: { vehicleId: vehicle.id, status: 'ACTIVE' },
      include: { parties: true },
      orderBy: { createdAt: 'desc' },
    });
    // Contract parties may carry only a userId (driverId is often null),
    // so match the DRIVER party by role as well as by driverId.
    const party = (contract?.parties || []).find((p: any) => p.role === 'DRIVER' || p.driverId);
    if (party?.driverId) {
      return this.prisma.driver.findUnique({ where: { id: party.driverId } });
    }
    if (party?.userId) {
      return this.prisma.driver.findUnique({ where: { userId: party.userId } });
    }
    return null;
  }

  async changeOperatingModel(vehicleId: string, newModel: OperatingModel, requestingUserId: string, requestingUserRole: string) {
    const vehicle = await this.prisma.vehicle.findUnique({ where: { id: vehicleId } });
    if (!vehicle) throw new NotFoundException('Vehicle not found');
    await this.assertVehicleAccess(vehicle, requestingUserId, requestingUserRole);

    if (vehicle.operatingModel === newModel) {
      return { changed: false, approvalRequired: false, vehicle };
    }

    const driver = await this.getAssignedDriver(vehicle);
    const isAssignedDriver = !!driver && requestingUserRole === UserRole.DRIVER && driver.userId === requestingUserId;

    // No driver yet: the owner/fleet side can set the type freely.
    if (!driver) {
      if (requestingUserRole === UserRole.DRIVER) {
        throw new ForbiddenException('Only the vehicle owner can set the contract type before a driver is assigned');
      }
      const updated = await this.prisma.vehicle.update({ where: { id: vehicleId }, data: { operatingModel: newModel } });
      return { changed: true, approvalRequired: false, vehicle: updated };
    }

    // Work & Pay with a driver: the vehicle is becoming the driver's own,
    // so only the owner can propose a change and the driver must approve it.
    if (vehicle.operatingModel === 'WORK_AND_PAY') {
      if (isAssignedDriver) {
        throw new ForbiddenException('This is a Work & Pay vehicle: a change of contract type must be proposed by the owner and approved by you, because the vehicle is becoming yours.');
      }
      await this.prisma.vehicleOperatingModelChange.updateMany({
        where: { vehicleId, status: 'PENDING' },
        data: { status: 'CANCELLED' },
      });
      const request = await this.prisma.vehicleOperatingModelChange.create({
        data: {
          vehicleId,
          fromModel: vehicle.operatingModel,
          toModel: newModel,
          requestedById: requestingUserId,
          driverId: driver.id,
          status: 'PENDING',
        },
      });
      await this.prisma.notification.create({
        data: {
          userId: driver.userId,
          channel: 'IN_APP',
          type: 'VEHICLE_MODEL_CHANGE_REQUEST',
          subject: 'Contract type change needs your approval',
          body: `The owner wants to change your Work & Pay vehicle (${vehicle.registrationNumber}) from Work & Pay to ${String(newModel).replace(/_/g, ' ')}. Because this vehicle is becoming yours under Work & Pay, it can only change if you approve. Open your Vehicle tab to approve or reject.`,
          data: { vehicleId, requestId: request.id, fromModel: vehicle.operatingModel, toModel: newModel },
          status: 'SENT',
          sentAt: new Date(),
        },
      });
      return { changed: false, approvalRequired: true, request, vehicle };
    }

    // DriveOn / Rental with a driver: the driver (or owner) can change later.
    const updated = await this.prisma.vehicle.update({ where: { id: vehicleId }, data: { operatingModel: newModel } });
    return { changed: true, approvalRequired: false, vehicle: updated };
  }

  async decideModelChange(vehicleId: string, requestId: string, approve: boolean, driverUserId: string) {
    const request = await this.prisma.vehicleOperatingModelChange.findUnique({ where: { id: requestId } });
    if (!request || request.vehicleId !== vehicleId) throw new NotFoundException('Change request not found');
    if (request.status !== 'PENDING') throw new BadRequestException('This change request has already been decided');

    const driver = await this.prisma.driver.findUnique({ where: { userId: driverUserId } });
    if (!driver || driver.id !== request.driverId) {
      throw new ForbiddenException('Only the assigned driver can approve or reject this change');
    }

    if (!approve) {
      const rejected = await this.prisma.vehicleOperatingModelChange.update({
        where: { id: requestId },
        data: { status: 'REJECTED', decidedAt: new Date(), decidedById: driverUserId },
      });
      return { changed: false, approved: false, request: rejected };
    }

    const [, updatedVehicle] = await this.prisma.$transaction([
      this.prisma.vehicleOperatingModelChange.update({
        where: { id: requestId },
        data: { status: 'APPROVED', decidedAt: new Date(), decidedById: driverUserId },
      }),
      this.prisma.vehicle.update({ where: { id: vehicleId }, data: { operatingModel: request.toModel } }),
    ]);
    return { changed: true, approved: true, vehicle: updatedVehicle };
  }

  async getPendingModelChange(vehicleId: string) {
    return this.prisma.vehicleOperatingModelChange.findFirst({
      where: { vehicleId, status: 'PENDING' },
      orderBy: { createdAt: 'desc' },
    });
  }

  static readonly MAX_PHOTOS = 10;

  private validatePhotoUrls(urls: unknown): string[] {
    if (!Array.isArray(urls)) throw new BadRequestException('imageUrls must be an array');
    if (urls.length > VehiclesService.MAX_PHOTOS) {
      throw new BadRequestException(`A vehicle can have at most ${VehiclesService.MAX_PHOTOS} photos`);
    }
    const clean = urls.map((u) => (typeof u === 'string' ? u.trim() : ''));
    for (const u of clean) {
      if (!u || !/^(https?:\/\/|\/uploads\/)/i.test(u)) {
        throw new BadRequestException('Each photo must be an http(s) URL or an uploaded photo path (/uploads/…)');
      }
    }
    return [...new Set(clean)];
  }

  private async getVehicleForPhotoChange(id: string, userId: string, userRole: string) {
    const vehicle = await this.prisma.vehicle.findUnique({ where: { id } });
    if (!vehicle) throw new NotFoundException('Vehicle not found');
    if (userRole === UserRole.DRIVER) {
      throw new ForbiddenException('Drivers cannot change vehicle photos');
    }
    if (userRole === UserRole.OWNER) await this.ensureOwnerProfile(userId);
    await this.assertVehicleAccess(vehicle, userId, userRole);
    return vehicle;
  }

  async setPhotos(id: string, imageUrls: string[], userId: string, userRole: string) {
    const urls = this.validatePhotoUrls(imageUrls);
    await this.getVehicleForPhotoChange(id, userId, userRole);
    return this.prisma.vehicle.update({ where: { id }, data: { imageUrls: urls } });
  }

  async addPhotoUrls(id: string, newUrls: string[], userId: string, userRole: string) {
    const added = this.validatePhotoUrls(newUrls);
    if (added.length === 0) throw new BadRequestException('No photos provided');
    const vehicle: any = await this.getVehicleForPhotoChange(id, userId, userRole);
    const merged = this.validatePhotoUrls([...(vehicle.imageUrls || []), ...added]);
    return this.prisma.vehicle.update({ where: { id }, data: { imageUrls: merged } });
  }

  /**
   * Resource-level authorization — prevents IDOR/BOLA.
   * An owner can only access their own vehicles.
   * A driver can only access their currently assigned vehicle.
   * Admins and company members with proper roles see all.
   */
  async assertVehicleAccess(vehicle: any, requestingUserId: string, requestingUserRole: string) {
    const adminRoles = [UserRole.ADMIN, UserRole.SUPER_ADMIN];

    if (adminRoles.some((role) => role === requestingUserRole)) return; // Admins pass

    if (requestingUserRole === UserRole.OWNER) {
      const owner = await this.prisma.owner.findUnique({ where: { userId: requestingUserId } });
      if (!owner || vehicle.ownerId !== owner.id) {
        throw new ForbiddenException('Access denied to this vehicle');
      }
      return;
    }

    if (requestingUserRole === UserRole.DRIVER) {
      const driver = await this.prisma.driver.findUnique({ where: { userId: requestingUserId } });
      if (!driver) {
        throw new ForbiddenException('Access denied to this vehicle');
      }
      if (vehicle.currentDriverId === driver.id) return;
      const assigned = await this.getAssignedDriver(vehicle);
      if (assigned?.id === driver.id) return;
      throw new ForbiddenException('Access denied to this vehicle');
    }

    const companyRoles = [UserRole.COMPANY_ADMIN, UserRole.FLEET_MANAGER, UserRole.COMPANY_MEMBER];
    if (companyRoles.some((role) => role === requestingUserRole)) {
      const member = await this.prisma.companyMember.findFirst({
        where: {
          userId: requestingUserId,
          companyId: vehicle.managingCompanyId,
          isActive: true,
        },
      });
      if (!member) {
        throw new ForbiddenException('Access denied to this vehicle');
      }
      return;
    }

    throw new ForbiddenException('Access denied to this vehicle');
  }
}
