import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateVehicleDto } from './dto/create-vehicle.dto';
import { VehicleStatus, UserRole } from '@prisma/client';

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
      where.currentDriverId = driver.id;
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
      if (!driver || vehicle.currentDriverId !== driver.id) {
        throw new ForbiddenException('Access denied to this vehicle');
      }
      return;
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
