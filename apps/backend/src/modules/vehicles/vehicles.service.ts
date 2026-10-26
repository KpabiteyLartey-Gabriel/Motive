import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateVehicleDto } from './dto/create-vehicle.dto';
import { VehicleStatus, UserRole, OperatingModel, VehicleVerificationStatus } from '@prisma/client';

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

    const { publish, managingCompanyId: requestedCompanyId, ...vehicleData } = dto as any;
    const imageUrls = dto.imageUrls ? this.validatePhotoUrls(dto.imageUrls) : [];

    // Listing a vehicle for hiring is a company business — for every
    // contract type (Work & Pay, DriveOn, Rental). A company member lists
    // under their own company; an individual owner must join a company and
    // place the vehicle with them, and that company lists it.
    let managingCompanyId = companyMember?.companyId || null;
    if (companyMember && requestedCompanyId && requestedCompanyId !== companyMember.companyId) {
      throw new BadRequestException('A company can only list vehicles under its own company.');
    }
    if (!companyMember && requestedCompanyId) {
      const company = await this.assertActiveCompany(requestedCompanyId);
      managingCompanyId = company.id;
    }
    if (publish && !managingCompanyId) {
      throw new BadRequestException('Only companies can list vehicles for hiring. Join a company and place this vehicle with them, then publish — or save it as a draft.');
    }

    return this.prisma.vehicle.create({
      data: {
        ...vehicleData,
        imageUrls,
        ownerId,
        managingCompanyId,
        // Every vehicle starts as a private DRAFT. It can only be published
        // (AVAILABLE) after a Super Admin verifies it — see updateStatus.
        status: VehicleStatus.DRAFT,
        verificationStatus: VehicleVerificationStatus.NOT_SUBMITTED,
      },
    });
  }

  private async assertActiveCompany(companyId: string) {
    const company = await this.prisma.company.findUnique({ where: { id: companyId } });
    if (!company) throw new NotFoundException('The chosen company was not found');
    if (company.status !== 'ACTIVE') {
      throw new BadRequestException('The chosen company is not active yet, so it cannot rent vehicles out. Please choose another company.');
    }
    return company;
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
      // Listing for hiring is company-only, for every contract type: the
      // vehicle must be placed with a company before it can go live. An
      // owner who wants a vehicle listed has to join a company first.
      if (status === VehicleStatus.AVAILABLE && !vehicle.managingCompanyId) {
        throw new BadRequestException('Only companies can list vehicles for hiring. Join a company and place this vehicle with them, then the company can list it.');
      }
    }

    // Every published vehicle must first be verified by a Super Admin, who
    // confirms the submitted identity (registration number, chassis number,
    // engine number, colour, type, year…) against the evidence images.
    if (status === VehicleStatus.AVAILABLE && vehicle.verificationStatus !== VehicleVerificationStatus.APPROVED) {
      if (vehicle.verificationStatus === VehicleVerificationStatus.PENDING_REVIEW) {
        throw new BadRequestException('This vehicle is waiting for verification. A Super Admin must verify it before it can be published.');
      }
      if (vehicle.verificationStatus === VehicleVerificationStatus.REJECTED) {
        throw new BadRequestException(`This vehicle was not verified${vehicle.verificationNote ? `: ${vehicle.verificationNote}` : ''}. Fix the issues, resubmit for verification, and publish after approval.`);
      }
      throw new BadRequestException('This vehicle has not been verified yet. Add its chassis number, upload the required evidence images, and submit it for verification by a Super Admin.');
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

  async changeOperatingModel(vehicleId: string, newModel: OperatingModel, requestingUserId: string, requestingUserRole: string, managingCompanyId?: string) {
    const vehicle = await this.prisma.vehicle.findUnique({ where: { id: vehicleId } });
    if (!vehicle) throw new NotFoundException('Vehicle not found');
    await this.assertVehicleAccess(vehicle, requestingUserId, requestingUserRole);

    if (vehicle.operatingModel === newModel) {
      // Same type: this is how an owner places the vehicle with a company
      // (for any contract type) so the company can list it for hiring.
      if (managingCompanyId && requestingUserRole !== UserRole.DRIVER && managingCompanyId !== vehicle.managingCompanyId) {
        if (!vehicle.managingCompanyId || requestingUserRole === UserRole.OWNER) {
          const company = await this.assertActiveCompany(managingCompanyId);
          const updated = await this.prisma.vehicle.update({ where: { id: vehicleId }, data: { managingCompanyId: company.id } });
          return { changed: false, approvalRequired: false, companyUpdated: true, vehicle: updated };
        }
      }
      return { changed: false, approvalRequired: false, vehicle };
    }

    // Changing type can also place the vehicle with a chosen company.
    let placedCompanyId: string | null = null;
    if (managingCompanyId && managingCompanyId !== vehicle.managingCompanyId) {
      const company = await this.assertActiveCompany(managingCompanyId);
      placedCompanyId = company.id;
    }
    const typeData: any = { operatingModel: newModel };
    if (placedCompanyId) typeData.managingCompanyId = placedCompanyId;

    const driver = await this.getAssignedDriver(vehicle);
    const isAssignedDriver = !!driver && requestingUserRole === UserRole.DRIVER && driver.userId === requestingUserId;

    // No driver yet: the owner/fleet side can set the type freely.
    if (!driver) {
      if (requestingUserRole === UserRole.DRIVER) {
        throw new ForbiddenException('Only the vehicle owner can set the contract type before a driver is assigned');
      }
      const updated = await this.prisma.vehicle.update({ where: { id: vehicleId }, data: typeData });
      return { changed: true, approvalRequired: false, vehicle: updated };
    }

    // Work & Pay with a driver: the vehicle is becoming the driver's own,
    // so only the owner can propose a change and the driver must approve it.
    if (vehicle.operatingModel === 'WORK_AND_PAY') {
      if (isAssignedDriver) {
        throw new ForbiddenException('This is a Work & Pay vehicle: a change of contract type must be proposed by the owner and approved by you, because the vehicle is becoming yours.');
      }
      // Attach the chosen company now (without changing the type yet)
      // so an approval lands the vehicle under that company.
      let currentVehicle: any = vehicle;
      if (placedCompanyId && placedCompanyId !== vehicle.managingCompanyId) {
        currentVehicle = await this.prisma.vehicle.update({ where: { id: vehicleId }, data: { managingCompanyId: placedCompanyId } });
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
      return { changed: false, approvalRequired: true, request, vehicle: currentVehicle };
    }

    // DriveOn / Rental with a driver: the driver (or owner) can change later.
    const updated = await this.prisma.vehicle.update({ where: { id: vehicleId }, data: typeData });
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

  // ── Vehicle verification (Super Admin, before publishing) ───
  // The reviewer confirms the DVLA identity of the vehicle: registration
  // number, chassis number, make/model, year, colour, type
  // and fuel — against clear evidence images the owner must provide:
  // front and rear photos showing the number plate, a close-up of the
  // chassis/VIN plate, and the Vehicle Registration Certificate.
  static readonly EVIDENCE_KINDS = ['frontPlate', 'rearPlate', 'vinPlate', 'registrationCert'] as const;
  static readonly EVIDENCE_LABELS: Record<string, string> = {
    frontPlate: 'front photo showing the number plate',
    rearPlate: 'rear photo showing the number plate',
    vinPlate: 'close-up of the chassis/VIN plate',
    registrationCert: 'Vehicle Registration Certificate (DVLA)',
  };
  private static readonly IDENTITY_FIELDS = ['registrationNumber', 'chassisNumber', 'vin', 'make', 'model', 'year', 'color', 'type', 'fuelType'];

  private invalidateVerificationIfNeeded(vehicle: any, changedKeys: string[]) {
    const identityChanged = changedKeys.some((k) => VehiclesService.IDENTITY_FIELDS.includes(k));
    if (vehicle.verificationStatus === VehicleVerificationStatus.APPROVED && identityChanged) {
      return {
        verificationStatus: VehicleVerificationStatus.NOT_SUBMITTED,
        verifiedAt: null,
        verifiedById: null,
        verificationNote: 'Vehicle details changed after verification — please resubmit for verification.',
        ...(vehicle.status === VehicleStatus.AVAILABLE ? { status: VehicleStatus.DRAFT } : {}),
      };
    }
    if (vehicle.verificationStatus === VehicleVerificationStatus.REJECTED && changedKeys.length > 0) {
      return { verificationStatus: VehicleVerificationStatus.NOT_SUBMITTED };
    }
    return {};
  }

  async updateDetails(vehicleId: string, dto: Record<string, any>, requestingUserId: string, requestingUserRole: string) {
    const vehicle = await this.prisma.vehicle.findUnique({ where: { id: vehicleId } });
    if (!vehicle) throw new NotFoundException('Vehicle not found');
    if (requestingUserRole === UserRole.DRIVER) throw new ForbiddenException('Drivers cannot edit vehicle details');
    await this.assertVehicleAccess(vehicle, requestingUserId, requestingUserRole);

    const data: Record<string, any> = {};
    for (const [k, v] of Object.entries(dto || {})) {
      if (v !== undefined && (vehicle as any)[k] !== v) data[k] = v;
    }
    if (Object.keys(data).length === 0) return vehicle;
    Object.assign(data, this.invalidateVerificationIfNeeded(vehicle, Object.keys(data)));
    return this.prisma.vehicle.update({ where: { id: vehicleId }, data });
  }

  async setVerificationEvidence(vehicleId: string, kind: string, url: string, requestingUserId: string, requestingUserRole: string) {
    if (!(VehiclesService.EVIDENCE_KINDS as readonly string[]).includes(kind)) {
      throw new BadRequestException(`Unknown evidence kind "${kind}". Use one of: ${VehiclesService.EVIDENCE_KINDS.join(', ')}`);
    }
    const [cleanUrl] = this.validatePhotoUrls([url]);
    const vehicle = await this.prisma.vehicle.findUnique({ where: { id: vehicleId } });
    if (!vehicle) throw new NotFoundException('Vehicle not found');
    if (requestingUserRole === UserRole.DRIVER) throw new ForbiddenException('Drivers cannot upload verification evidence');
    await this.assertVehicleAccess(vehicle, requestingUserId, requestingUserRole);

    const evidence = { ...((vehicle.verificationEvidence as Record<string, string>) || {}), [kind]: cleanUrl };
    const data: Record<string, any> = { verificationEvidence: evidence };
    if (vehicle.verificationStatus === VehicleVerificationStatus.APPROVED) {
      Object.assign(data, {
        verificationStatus: VehicleVerificationStatus.NOT_SUBMITTED,
        verifiedAt: null,
        verifiedById: null,
        verificationNote: 'Verification evidence changed — please resubmit for verification.',
        ...(vehicle.status === VehicleStatus.AVAILABLE ? { status: VehicleStatus.DRAFT } : {}),
      });
    }
    return this.prisma.vehicle.update({ where: { id: vehicleId }, data });
  }

  async submitVerification(vehicleId: string, evidenceInput: Record<string, string> | undefined, requestingUserId: string, requestingUserRole: string) {
    const vehicle = await this.prisma.vehicle.findUnique({ where: { id: vehicleId } });
    if (!vehicle) throw new NotFoundException('Vehicle not found');
    if (requestingUserRole === UserRole.DRIVER) throw new ForbiddenException('Drivers cannot submit vehicles for verification');
    await this.assertVehicleAccess(vehicle, requestingUserId, requestingUserRole);
    if (vehicle.verificationStatus === VehicleVerificationStatus.PENDING_REVIEW) {
      throw new BadRequestException('This vehicle is already waiting for verification.');
    }
    if (vehicle.verificationStatus === VehicleVerificationStatus.APPROVED) {
      throw new BadRequestException('This vehicle is already verified.');
    }

    const evidence: Record<string, string> = { ...((vehicle.verificationEvidence as Record<string, string>) || {}) };
    for (const kind of VehiclesService.EVIDENCE_KINDS) {
      const url = evidenceInput?.[kind];
      if (url) evidence[kind] = this.validatePhotoUrls([url])[0];
    }

    const missing: string[] = [];
    if (!vehicle.chassisNumber) missing.push('chassis number');
    if (!vehicle.color) missing.push('vehicle colour');
    for (const kind of VehiclesService.EVIDENCE_KINDS) {
      if (!evidence[kind]) missing.push(VehiclesService.EVIDENCE_LABELS[kind]);
    }
    if (missing.length > 0) {
      throw new BadRequestException(`Before submitting, please add: ${missing.join('; ')}. The Super Admin checks these against your submitted details (registration ${vehicle.registrationNumber}, ${vehicle.make} ${vehicle.model} ${vehicle.year}).`);
    }

    return this.prisma.vehicle.update({
      where: { id: vehicleId },
      data: {
        verificationEvidence: evidence,
        verificationStatus: VehicleVerificationStatus.PENDING_REVIEW,
        verificationSubmittedAt: new Date(),
        verificationNote: null,
      },
    });
  }

  async verificationQueue() {
    return this.prisma.vehicle.findMany({
      where: { verificationStatus: VehicleVerificationStatus.PENDING_REVIEW },
      orderBy: { verificationSubmittedAt: 'asc' },
      include: {
        owner: { include: { user: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } } } },
        managingCompany: { select: { id: true, name: true } },
      },
    });
  }

  async decideVerification(vehicleId: string, approve: boolean, note: string | undefined, superAdminId: string) {
    const vehicle = await this.prisma.vehicle.findUnique({ where: { id: vehicleId } });
    if (!vehicle) throw new NotFoundException('Vehicle not found');
    if (vehicle.verificationStatus !== VehicleVerificationStatus.PENDING_REVIEW) {
      throw new BadRequestException('This vehicle is not waiting for verification.');
    }
    if (!approve && !note?.trim()) {
      throw new BadRequestException('Please say what does not match or is unclear, so the owner can fix it and resubmit.');
    }
    const updated = await this.prisma.vehicle.update({
      where: { id: vehicleId },
      data: approve
        ? { verificationStatus: VehicleVerificationStatus.APPROVED, verifiedAt: new Date(), verifiedById: superAdminId, verificationNote: note?.trim() || null }
        : { verificationStatus: VehicleVerificationStatus.REJECTED, verifiedAt: null, verifiedById: null, verificationNote: note!.trim() },
    });

    // Tell the owner the outcome (best effort).
    try {
      const owner = vehicle.ownerId ? await this.prisma.owner.findUnique({ where: { id: vehicle.ownerId } }) : null;
      const recipientId = owner?.userId;
      if (recipientId) {
        await this.prisma.notification.create({
          data: {
            userId: recipientId,
            channel: 'IN_APP',
            type: approve ? 'VEHICLE_VERIFIED' : 'VEHICLE_VERIFICATION_REJECTED',
            subject: approve ? 'Your vehicle has been verified' : 'Your vehicle could not be verified',
            body: approve
              ? `Your ${vehicle.make} ${vehicle.model} (${vehicle.registrationNumber}) has been verified by our team. You can now publish it.`
              : `Your ${vehicle.make} ${vehicle.model} (${vehicle.registrationNumber}) could not be verified: ${note!.trim()} Please correct the details or images and resubmit.`,
            data: { vehicleId },
            status: 'SENT',
            sentAt: new Date(),
          },
        });
      }
    } catch { /* notification is best effort */ }
    return updated;
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
