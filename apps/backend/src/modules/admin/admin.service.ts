import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { AuditAction, DriverStatus, OwnerStatus, VehicleStatus, CompanyStatus, NotificationChannel, UserRole, UserStatus } from '@prisma/client';
import { Optional } from '@nestjs/common';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    @Optional() private readonly notifications?: NotificationsService,
  ) {}

  // ── Announcements (admin → users push + in-app) ──────────────
  async createAnnouncement(actorId: string, dto: { subject: string; body: string; role?: UserRole }) {
    if (!dto?.subject?.trim() || !dto?.body?.trim()) {
      throw new BadRequestException('An announcement needs both a title and a message.');
    }
    if (!this.notifications) throw new BadRequestException('Notifications are not available right now.');

    const users = await this.prisma.user.findMany({
      where: {
        deletedAt: null,
        status: { not: UserStatus.DEACTIVATED },
        ...(dto.role ? { primaryRole: dto.role } : {}),
      },
      select: { id: true },
    });
    const userIds = users.map((u) => u.id);

    const params = { type: 'ADMIN_ANNOUNCEMENT', subject: dto.subject.trim(), body: dto.body.trim() };
    await this.notifications.sendBulk(userIds, { ...params, channel: NotificationChannel.IN_APP });
    await this.notifications.sendBulk(userIds, { ...params, channel: NotificationChannel.PUSH });

    await this.audit.log({
      actorId,
      action: AuditAction.CREATE,
      resource: 'announcement',
      resourceId: 'broadcast',
      newData: { subject: params.subject, role: dto.role || 'ALL', recipients: userIds.length },
    }).catch(() => null);

    return { success: true, recipients: userIds.length, message: `Announcement sent to ${userIds.length} user${userIds.length === 1 ? '' : 's'}.` };
  }

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

  /**
   * Keep the login account status in step with the role-profile status an
   * admin just set. Portals read the account status (e.g. the driver
   * dashboard's "Account status"), so verifying only the profile left
   * verified people looking "Pending verification" forever. A deactivated
   * account is never resurrected by a profile change.
   */
  private async syncUserStatusForProfile(userId: string, profileStatus: DriverStatus | OwnerStatus) {
    const map: Partial<Record<string, UserStatus>> = {
      VERIFIED: UserStatus.ACTIVE,
      ACTIVE: UserStatus.ACTIVE,
      SUSPENDED: UserStatus.SUSPENDED,
      INACTIVE: UserStatus.PENDING_VERIFICATION,
    };
    const next = map[profileStatus];
    if (!next) return;
    await this.prisma.user.updateMany({
      where: { id: userId, status: { not: UserStatus.DEACTIVATED } },
      data: { status: next },
    });
  }

  // Portals and post-login routing key off primaryRole. A user who became
  // a Driver/Owner through the identity flow can still be PENDING, so a
  // verification must promote them or their portal never changes.
  private async promotePrimaryIfPending(userId: string, role: UserRole) {
    await this.prisma.user.updateMany({
      where: { id: userId, primaryRole: UserRole.PENDING },
      data: { primaryRole: role },
    });
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
        ...(status === DriverStatus.VERIFIED ? { verifiedAt: new Date(), verifiedBy: actorId, nationalIdVerifiedAt: new Date(), nationalIdVerifiedBy: actorId, licenceVerifiedAt: new Date(), licenceVerifiedBy: actorId } : {}),
      },
    });
    await this.syncUserStatusForProfile(updated.userId, status);
    if (status === DriverStatus.VERIFIED) await this.promotePrimaryIfPending(updated.userId, UserRole.DRIVER);

    await this.audit.log({ actorId, action: AuditAction.VERIFY, resource: 'driver', resourceId: driverId, newData: { status } });
    return updated;
  }

  /**
   * Create the Driver profile for a DRIVER-role account that has none
   * (accounts registered before profiles were provisioned at signup, so
   * they cannot appear in the drivers list or be verified). Idempotent —
   * returns the existing profile when one already exists.
   */
  async provisionDriverProfile(userId: string, actorId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true, primaryRole: true,
        driver: { select: { id: true } },
      },
    });
    if (!user) throw new NotFoundException('User not found');
    if (user.primaryRole !== UserRole.DRIVER) {
      throw new BadRequestException('Only accounts with the Driver role can be given a driver profile');
    }
    const include = {
      user: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
    };
    if (user.driver) {
      return this.prisma.driver.findUnique({ where: { id: user.driver.id }, include });
    }
    const created = await this.prisma.driver.create({ data: { userId: user.id }, include });
    await this.audit.log({
      actorId,
      action: AuditAction.CREATE,
      resource: 'driver',
      resourceId: created.id,
      newData: { provisionedForUserId: user.id },
    });
    return created;
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
        ...(status === OwnerStatus.VERIFIED ? { verifiedAt: new Date(), verifiedBy: actorId, nationalIdVerifiedAt: new Date(), nationalIdVerifiedBy: actorId } : {}),
      },
    });
    await this.syncUserStatusForProfile(updated.userId, status);
    if (status === OwnerStatus.VERIFIED) await this.promotePrimaryIfPending(updated.userId, UserRole.OWNER);

    await this.audit.log({ actorId, action: AuditAction.VERIFY, resource: 'owner', resourceId: ownerId, newData: { status } });
    return updated;
  }

  // ── Manual verification (Super Admin) ──────────────────────
  // One queue for every Driver/Owner so a Super Admin can verify a user
  // by hand when self-onboarding stalls, or for test accounts that have
  // no real Ghana Card / licence. Verification is per-document: National
  // ID for everyone, plus Driver's Licence for drivers.
  private verificationRow(user: any, profile: any, accountType: 'DRIVER' | 'OWNER', identityVerification: any = null, licenceVerification: any = null) {
    const idVerified = !!(profile?.nationalIdVerifiedAt || profile?.verifiedAt);
    const hasIdentitySubmission = !!identityVerification || !!(profile?.ghanaCardNumber || profile?.identityDocNumber);
    const idStatus = idVerified ? 'VERIFIED' : identityVerification?.status === 'REJECTED' ? 'REJECTED' : hasIdentitySubmission ? 'PENDING_REVIEW' : 'NOT_SUBMITTED';
    const licenceVerified = accountType === 'DRIVER' ? !!profile?.licenceVerifiedAt : null;
    const licenceStatus = accountType !== 'DRIVER' ? null : licenceVerified ? 'VERIFIED' : licenceVerification?.status === 'REJECTED' ? 'REJECTED' : profile?.licenseNumber ? 'PENDING_REVIEW' : 'NOT_SUBMITTED';
    return {
      userId: user.id,
      profileId: profile?.id || null,
      accountType,
      firstName: user.firstName, lastName: user.lastName,
      email: user.email || null, phone: user.phone || null,
      authProvider: user.authProvider || 'LOCAL',
      accountStatus: user.status,
      profileStatus: profile?.status || null,
      onboardingCompletedAt: user.onboardingCompletedAt || null,
      ghanaCardNumber: identityVerification?.ghanaCardNumber || profile?.ghanaCardNumber || profile?.identityDocNumber || null,
      identityStatus: idStatus,
      identityVerification: identityVerification ? {
        status: identityVerification.status,
        ghanaCardNumber: identityVerification.ghanaCardNumber,
        idFrontUrl: identityVerification.idFrontUrl,
        idBackUrl: identityVerification.idBackUrl,
        livenessSelfieUrl: identityVerification.livenessSelfieUrl,
        livenessPassed: !!identityVerification.livenessPassed,
        livenessChallenge: identityVerification.livenessChallenge || null,
        livenessCapturedAt: identityVerification.livenessCapturedAt || null,
        reviewNote: identityVerification.reviewNote || null,
        submittedAt: identityVerification.updatedAt || identityVerification.createdAt,
      } : null,
      licenceVerification: licenceVerification ? {
        status: licenceVerification.status,
        licenseNumber: licenceVerification.licenseNumber,
        licenceFrontUrl: licenceVerification.licenceFrontUrl,
        licenceBackUrl: licenceVerification.licenceBackUrl,
        reviewNote: licenceVerification.reviewNote || null,
        submittedAt: licenceVerification.updatedAt || licenceVerification.createdAt,
      } : null,
      nationalIdVerifiedAt: profile?.nationalIdVerifiedAt || profile?.verifiedAt || null,
      licenseNumber: accountType === 'DRIVER' ? profile?.licenseNumber || null : null,
      licenseClass: accountType === 'DRIVER' ? profile?.licenseClass || null : null,
      licenseExpiryDate: accountType === 'DRIVER' ? profile?.licenseExpiryDate || null : null,
      licenceStatus,
      licenceVerifiedAt: accountType === 'DRIVER' ? profile?.licenceVerifiedAt || null : null,
      createdAt: profile?.createdAt || user.createdAt,
      fullyVerified: idStatus === 'VERIFIED' && (accountType !== 'DRIVER' || licenceStatus === 'VERIFIED'),
    };
  }

  async listVerifications(params: { search?: string; status?: string } = {}) {
    const userSelect = { id: true, firstName: true, lastName: true, email: true, phone: true, status: true, authProvider: true, onboardingCompletedAt: true, createdAt: true };
    const [drivers, owners, pendingUsers, identityRows, licenceRows] = await Promise.all([
      this.prisma.driver.findMany({ include: { user: { select: userSelect } }, orderBy: { createdAt: 'desc' } }),
      this.prisma.owner.findMany({ include: { user: { select: userSelect } }, orderBy: { createdAt: 'desc' } }),
      this.prisma.user.findMany({
        where: { primaryRole: UserRole.PENDING, deletedAt: null },
        select: userSelect,
        orderBy: { createdAt: 'desc' },
      }),
      (this.prisma as any).identityVerification?.findMany ? (this.prisma as any).identityVerification.findMany() : Promise.resolve([]),
      (this.prisma as any).licenceVerification?.findMany ? (this.prisma as any).licenceVerification.findMany() : Promise.resolve([]),
    ]);
    const identityByUserKind = new Map<string, any>();
    for (const v of identityRows || []) identityByUserKind.set(`${v.userId}:${v.accountKind}`, v);
    const licenceByUser = new Map<string, any>();
    for (const v of licenceRows || []) licenceByUser.set(v.userId, v);

    let rows = [
      ...drivers.map((d: any) => this.verificationRow(d.user, d, 'DRIVER' as const, identityByUserKind.get(`${d.userId}:DRIVER`) || null, licenceByUser.get(d.userId) || null)),
      ...owners.map((o: any) => this.verificationRow(o.user, o, 'OWNER' as const, identityByUserKind.get(`${o.userId}:OWNER`) || null, null)),
      ...pendingUsers.map((u: any) => ({ ...this.verificationRow(u, null, 'OWNER' as const), accountType: null, profileId: null })),
    ];

    const search = (params.search || '').trim().toLowerCase();
    if (search) {
      rows = rows.filter((r: any) => [r.firstName, r.lastName, r.email, r.phone, r.ghanaCardNumber, r.licenseNumber].filter(Boolean).join(' ').toLowerCase().includes(search));
    }
    const status = (params.status || '').toUpperCase();
    if (status === 'PENDING_REVIEW') rows = rows.filter((r: any) => r.identityStatus === 'PENDING_REVIEW' || r.licenceStatus === 'PENDING_REVIEW');
    else if (status === 'NOT_SUBMITTED') rows = rows.filter((r: any) => r.identityStatus === 'NOT_SUBMITTED');
    else if (status === 'VERIFIED') rows = rows.filter((r: any) => r.fullyVerified);
    else if (status === 'NEEDS_LICENCE') rows = rows.filter((r: any) => r.licenceStatus === 'PENDING_REVIEW');

    rows.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return {
      verifications: rows,
      counts: {
        total: rows.length,
        pendingIdentity: rows.filter((r: any) => r.identityStatus === 'PENDING_REVIEW').length,
        pendingLicence: rows.filter((r: any) => r.licenceStatus === 'PENDING_REVIEW').length,
        verified: rows.filter((r: any) => r.fullyVerified).length,
      },
    };
  }

  async manualVerifyUser(userId: string, dto: { target: 'IDENTITY' | 'LICENCE' | 'ALL'; verified: boolean }, actorId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { driver: true, owner: true },
    });
    if (!user) throw new NotFoundException('User not found');

    // Multi-account users may have a Driver/Owner profile while their
    // primary role is something else — verify the profile they actually hold.
    const accountType = (user.primaryRole === UserRole.DRIVER || user.primaryRole === UserRole.OWNER)
      ? user.primaryRole
      : user.driver ? UserRole.DRIVER : user.owner ? UserRole.OWNER : user.primaryRole;
    if (accountType !== UserRole.DRIVER && accountType !== UserRole.OWNER) {
      throw new BadRequestException('This user has not chosen a Driver or Owner account type yet, so there is nothing to verify. Ask them to finish step 2 of onboarding first.');
    }
    const target = dto?.target || 'ALL';
    const verified = dto?.verified !== false;
    const now = verified ? new Date() : null;
    const by = verified ? actorId : null;

    if (accountType === UserRole.OWNER) {
      if (target === 'LICENCE') throw new BadRequestException('Owners do not have a Driver\u2019s Licence to verify.');
      if (!user.owner) throw new NotFoundException('Owner profile not found');
      await this.prisma.owner.update({
        where: { id: user.owner.id },
        data: {
          nationalIdVerifiedAt: now, nationalIdVerifiedBy: by,
          verifiedAt: now, verifiedBy: by,
          status: verified ? OwnerStatus.VERIFIED : OwnerStatus.PENDING_VERIFICATION,
        },
      });
    } else {
      if (!user.driver) throw new NotFoundException('Driver profile not found');
      const data: any = {};
      if (target === 'IDENTITY' || target === 'ALL') { data.nationalIdVerifiedAt = now; data.nationalIdVerifiedBy = by; }
      if (target === 'LICENCE' || target === 'ALL') { data.licenceVerifiedAt = now; data.licenceVerifiedBy = by; }
      const nextDriver = { ...user.driver, ...data };
      const fullyVerified = !!nextDriver.nationalIdVerifiedAt && !!nextDriver.licenceVerifiedAt;
      data.status = fullyVerified ? DriverStatus.VERIFIED : DriverStatus.PENDING_VERIFICATION;
      if (fullyVerified) { data.verifiedAt = now; data.verifiedBy = by; }
      else if (!verified) { data.verifiedAt = null; data.verifiedBy = null; }
      await this.prisma.driver.update({ where: { id: user.driver.id }, data });
    }

    // Reflect the outcome on the login account + onboarding completion.
    const fullyVerified = accountType === UserRole.OWNER ? verified : (() => {
      const d: any = user.driver;
      const idV = target === 'IDENTITY' || target === 'ALL' ? verified : !!d.nationalIdVerifiedAt;
      const licV = target === 'LICENCE' || target === 'ALL' ? verified : !!d.licenceVerifiedAt;
      return idV && licV;
    })();
    await this.prisma.user.updateMany({
      where: { id: userId, status: { not: UserStatus.DEACTIVATED } },
      data: {
        status: fullyVerified ? UserStatus.ACTIVE : UserStatus.PENDING_VERIFICATION,
        ...(fullyVerified ? { onboardingCompletedAt: user.onboardingCompletedAt || new Date() } : {}),
      },
    });
    if (fullyVerified) await this.promotePrimaryIfPending(userId, accountType);

    // Keep the submitted identity/licence records in step with the decision
    // so the queue shows what was actually reviewed and approved.
    const submissionStatus = verified ? 'APPROVED' : 'REJECTED';
    if ((target === 'IDENTITY' || target === 'ALL') && (this.prisma as any).identityVerification?.updateMany) {
      await (this.prisma as any).identityVerification.updateMany({
        where: { userId, accountKind: accountType },
        data: { status: submissionStatus, reviewedBy: actorId, reviewedAt: new Date() },
      }).catch(() => null);
    }
    if (accountType === UserRole.DRIVER && (target === 'LICENCE' || target === 'ALL') && (this.prisma as any).licenceVerification?.updateMany) {
      await (this.prisma as any).licenceVerification.updateMany({
        where: { userId },
        data: { status: submissionStatus, reviewedBy: actorId, reviewedAt: new Date() },
      }).catch(() => null);
    }

    await this.audit.log({ actorId, action: AuditAction.VERIFY, resource: 'user-verification', resourceId: userId, newData: { target, verified, accountType, manual: true } });
    const rows = await this.listVerifications({});
    return rows.verifications.find((r: any) => r.userId === userId) || { userId, fullyVerified };
  }

  // Something was wrong with a submission: send it back. The document is
  // un-verified, the submitted record is marked REJECTED with the reviewer's
  // reason, and the user is told by email + in-app notification exactly
  // what to resubmit.
  async requestResubmission(
    userId: string,
    dto: { target: 'IDENTITY' | 'LICENCE' | 'ALL'; reason: string },
    actorId: string,
  ) {
    const reason = (dto?.reason || '').trim();
    if (!reason) throw new BadRequestException('Tell the user what is wrong so they know what to resubmit.');
    const target = dto?.target || 'ALL';

    // Reuse the (un)verify path: clears verified stamps and marks the
    // submitted records REJECTED.
    await this.manualVerifyUser(userId, { target, verified: false }, actorId);

    if ((this.prisma as any).identityVerification?.updateMany && (target === 'IDENTITY' || target === 'ALL')) {
      const u2 = await this.prisma.user.findUnique({ where: { id: userId }, select: { primaryRole: true, driver: { select: { id: true } }, owner: { select: { id: true } } } });
      const accountKind = (u2?.primaryRole === UserRole.DRIVER || u2?.primaryRole === UserRole.OWNER)
        ? u2.primaryRole
        : u2?.driver ? UserRole.DRIVER : UserRole.OWNER;
      await (this.prisma as any).identityVerification.updateMany({
        where: { userId, accountKind },
        data: { reviewNote: reason },
      }).catch(() => null);
    }
    if ((this.prisma as any).licenceVerification?.updateMany && (target === 'LICENCE' || target === 'ALL')) {
      await (this.prisma as any).licenceVerification.updateMany({
        where: { userId },
        data: { reviewNote: reason },
      }).catch(() => null);
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { firstName: true, driver: { select: { id: true } }, owner: { select: { id: true } } },
    });
    const isDriver = !!user?.driver;
    const what = target === 'IDENTITY'
      ? 'your Ghana Card identity submission (card number, front and back photos, and the live face check)'
      : target === 'LICENCE'
        ? "your Driver's Licence submission (licence details and front and back photos)"
        : 'your identity and licence submissions (Ghana Card, live face check, and licence photos)';
    const subject = 'Please resubmit your verification documents';
    const body = `Hello ${user?.firstName || 'there'}, we reviewed ${what} and we could not accept it yet.\n\nWhat is wrong: ${reason}\n\nPlease open +Motive, go to My Account, choose ${isDriver ? 'Driver Account' : 'Owner Account'} with Add Account, and submit it again. Make sure the photos are clear, all four corners of the card are visible, and the live face check is done in good light.`;
    if (this.notifications) {
      const data = { link: '/portal/account', kind: 'RESUBMISSION_REQUEST', target };
      await this.notifications.send({ userId, channel: NotificationChannel.IN_APP, type: 'VERIFICATION_RESUBMIT', subject, body, data }).catch(() => null);
      await this.notifications.send({ userId, channel: NotificationChannel.EMAIL, type: 'VERIFICATION_RESUBMIT', subject, body, data }).catch(() => null);
    }
    await this.audit.log({ actorId, action: AuditAction.VERIFY, resource: 'user-verification', resourceId: userId, newData: { target, resubmissionRequested: true, reason } });
    const rows = await this.listVerifications({});
    return rows.verifications.find((r: any) => r.userId === userId) || { userId };
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
