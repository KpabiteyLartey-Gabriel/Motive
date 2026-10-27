import { BadRequestException, ConflictException, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { CompanyType, IdentityDocumentType, UserRole } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { CreateCompanyAccountDto, CreateServiceProviderDto } from './dto/accounts.dto';
import { GHANA_CARD_FORMAT_MESSAGE, normalizeGhanaCardNumber } from '../../common/ghana-card';

export type AccountStatus = 'NOT_CREATED' | 'IN_PROGRESS' | 'PENDING_REVIEW' | 'VERIFIED' | 'ACTIVE';

const COMPANY_LOCKED_REASON =
  'Company accounts can only be created by a user without a Driver, Owner or Service Provider account.';

@Injectable()
export class AccountsService {
  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly storage?: StorageService,
  ) {}

  private async loadUser(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true, firstName: true, lastName: true, email: true, phone: true,
        primaryRole: true, status: true, emailVerifiedAt: true, createdAt: true, lastLoginAt: true,
        driver: true, owner: true, serviceProvider: true,
        identityVerifications: true,
        licenceVerification: true,
        companyMembers: {
          where: { isActive: true },
          include: { company: { select: { id: true, name: true, type: true, status: true } } },
          orderBy: { joinedAt: 'asc' },
        },
      },
    });
    if (!user) throw new NotFoundException('User not found');
    return user as any;
  }

  private identityFor(user: any, kind: 'DRIVER' | 'OWNER') {
    const v = (user?.identityVerifications || []).find((x: any) => x.accountKind === kind);
    return v ? { status: v.status, ghanaCardNumber: v.ghanaCardNumber, livenessPassed: !!v.livenessPassed, reviewNote: v.reviewNote || null, submittedAt: v.updatedAt } : null;
  }

  private licenceFor(user: any) {
    const v = user?.licenceVerification;
    return v ? { status: v.status, licenseNumber: v.licenseNumber, reviewNote: v.reviewNote || null, submittedAt: v.updatedAt } : null;
  }

  // Identity verification (National ID, licence, face checks) is no
  // longer part of any account flow. A Driver/Owner account exists once
  // it has been created through the paid creation flow, and that is all
  // its status says. Legacy identity records stay readable below for
  // history, but they never gate the account.
  private driverAccount(driver: any, identity: any = null, licenceVerification: any = null) {
    if (!driver) return { kind: 'DRIVER', status: 'NOT_CREATED' as AccountStatus, needs: [], dashboardPath: '/driver/dashboard', identityVerification: identity, licenceVerification };
    return {
      kind: 'DRIVER', status: 'VERIFIED' as AccountStatus, needs: [], dashboardPath: '/driver/dashboard',
      ghanaCardNumber: driver.ghanaCardNumber || driver.identityDocNumber || null,
      licenseNumber: driver.licenseNumber || null,
      identityVerification: identity,
      licenceVerification,
    };
  }

  private ownerAccount(owner: any, identity: any = null) {
    if (!owner) return { kind: 'OWNER', status: 'NOT_CREATED' as AccountStatus, needs: [], dashboardPath: '/owner/dashboard', identityVerification: identity };
    return { kind: 'OWNER', status: 'VERIFIED' as AccountStatus, needs: [], dashboardPath: '/owner/dashboard', ghanaCardNumber: owner.ghanaCardNumber || null, identityVerification: identity };
  }

  private serviceProviderAccount(sp: any) {
    if (!sp) return { kind: 'SERVICE_PROVIDER', status: 'NOT_CREATED' as AccountStatus, needs: [], dashboardPath: '/portal' };
    return {
      kind: 'SERVICE_PROVIDER', status: 'ACTIVE' as AccountStatus, needs: [], dashboardPath: '/portal',
      businessName: sp.businessName, serviceType: sp.serviceType, city: sp.city || null,
    };
  }

  async getMyAccounts(userId: string) {
    const user = await this.loadUser(userId);
    const canCreateCompany = !user.driver && !user.owner && !user.serviceProvider;
    const memberships = (user.companyMembers || []).map((m: any) => ({
      membershipId: m.id, companyId: m.company.id, companyName: m.company.name,
      companyType: m.company.type, companyStatus: m.company.status,
      role: m.role, title: m.title || null, joinedAt: m.joinedAt,
    }));
    const createdCompanies = memberships.filter((m: any) => m.role === UserRole.COMPANY_ADMIN);

    return {
      user: {
        id: user.id, firstName: user.firstName, lastName: user.lastName, email: user.email, phone: user.phone,
        primaryRole: user.primaryRole, status: user.status, emailVerifiedAt: user.emailVerifiedAt,
        createdAt: user.createdAt, lastLoginAt: user.lastLoginAt,
      },
      accounts: [
        this.driverAccount(user.driver, this.identityFor(user, 'DRIVER'), this.licenceFor(user)),
        this.ownerAccount(user.owner, this.identityFor(user, 'OWNER')),
        this.serviceProviderAccount(user.serviceProvider),
        {
          kind: 'COMPANY',
          status: (createdCompanies.length ? 'ACTIVE' : 'NOT_CREATED') as AccountStatus,
          needs: [],
          dashboardPath: '/company/dashboard',
          canCreate: canCreateCompany,
          lockedReason: canCreateCompany ? null : COMPANY_LOCKED_REASON,
        },
      ],
      canCreateCompany,
      memberships,
    };
  }

  private async addRole(userId: string, roleName: UserRole, companyId?: string, grantedBy?: string) {
    const role = await this.prisma.role.findUnique({ where: { name: roleName } });
    if (!role) return;
    const existing = await this.prisma.userRoleAssignment.findFirst({
      where: { userId, roleId: role.id, companyId: companyId ?? null },
    });
    if (!existing) {
      await this.prisma.userRoleAssignment.create({ data: { userId, roleId: role.id, companyId, grantedBy } });
    }
  }

  private async ensurePrimary(user: any, role: UserRole) {
    if (user.primaryRole === UserRole.PENDING) {
      await this.prisma.user.update({ where: { id: user.id }, data: { primaryRole: role } });
    }
  }

  async createDriver(userId: string) {
    const user = await this.loadUser(userId);
    if (user.driver) throw new ConflictException('You already have a Driver account.');
    await this.prisma.driver.create({ data: { userId } });
    await this.addRole(userId, UserRole.DRIVER);
    await this.ensurePrimary(user, UserRole.DRIVER);
    return this.getMyAccounts(userId);
  }

  async createOwner(userId: string) {
    const user = await this.loadUser(userId);
    if (user.owner) throw new ConflictException('You already have an Owner account.');
    await this.prisma.owner.create({ data: { userId } });
    await this.addRole(userId, UserRole.OWNER);
    await this.ensurePrimary(user, UserRole.OWNER);
    return this.getMyAccounts(userId);
  }

  async createServiceProvider(userId: string, dto: CreateServiceProviderDto) {
    const user = await this.loadUser(userId);
    if (user.serviceProvider) throw new ConflictException('You already have a Service Provider account.');
    await this.prisma.serviceProvider.create({
      data: {
        userId,
        businessName: dto.businessName.trim(),
        serviceType: dto.serviceType.trim(),
        phone: dto.phone?.trim() || user.phone || null,
        address: dto.address?.trim() || null,
        city: dto.city?.trim() || null,
        region: dto.region?.trim() || null,
      },
    });
    await this.addRole(userId, UserRole.SERVICE_PROVIDER);
    await this.ensurePrimary(user, UserRole.SERVICE_PROVIDER);
    return this.getMyAccounts(userId);
  }

  async createCompany(userId: string, dto: CreateCompanyAccountDto) {
    const user = await this.loadUser(userId);
    if (user.driver || user.owner || user.serviceProvider) {
      throw new BadRequestException(COMPANY_LOCKED_REASON);
    }
    const company = await this.prisma.company.create({
      data: {
        name: dto.name.trim(),
        type: dto.type || CompanyType.TRANSPORT,
        email: dto.email?.trim() || user.email || undefined,
        phone: dto.phone?.trim() || user.phone || undefined,
        city: dto.city?.trim() || undefined,
        region: dto.region?.trim() || undefined,
        status: 'ACTIVE' as any,
      },
    });
    await this.prisma.companyMember.create({
      data: { companyId: company.id, userId, role: UserRole.COMPANY_ADMIN },
    });
    await this.addRole(userId, UserRole.COMPANY_ADMIN, company.id, userId);
    if (user.primaryRole === UserRole.PENDING || String(user.primaryRole).startsWith('COMPANY')) {
      await this.prisma.user.update({ where: { id: userId }, data: { primaryRole: UserRole.COMPANY_ADMIN } });
    }
    return this.getMyAccounts(userId);
  }

  private async assertGhanaCardFree(userId: string, ghanaCardNumber: string) {
    const [asDriver, asOwner] = await Promise.all([
      this.prisma.driver.findUnique({ where: { ghanaCardNumber } }),
      this.prisma.owner.findUnique({ where: { ghanaCardNumber } }),
    ]);
    const takenBy = asDriver?.userId || asOwner?.userId;
    if (takenBy && takenBy !== userId) {
      throw new ConflictException('This National ID is already registered to another account. If this is yours, contact support.');
    }
  }

  async submitNationalId(userId: string, kind: 'DRIVER' | 'OWNER', ghanaCardNumberRaw: string) {
    const ghanaCardNumber = normalizeGhanaCardNumber(ghanaCardNumberRaw);
    if (!ghanaCardNumber) throw new BadRequestException(GHANA_CARD_FORMAT_MESSAGE);
    // The profile may only come from the paid creation flow. Someone with
    // no profile and no completed creation order cannot open one here.
    const existing = await this.loadUser(userId);
    const hasProfile = kind === 'DRIVER' ? !!existing.driver : !!existing.owner;
    if (!hasProfile) {
      const orders = (this.prisma as any).accountCreationOrder;
      const order = orders ? await orders.findFirst({ where: { userId, kind, status: 'COMPLETED' } }).catch(() => null) : null;
      if (!order) {
        throw new BadRequestException(`Create your ${kind === 'DRIVER' ? 'Driver' : 'Owner'} account first — confirm your interest and pay the account creation charge in My Account.`);
      }
    }
    await this.assertGhanaCardFree(userId, ghanaCardNumber);
    if (kind === 'DRIVER') {
      await this.prisma.driver.upsert({
        where: { userId },
        create: { userId, ghanaCardNumber, identityDocType: IdentityDocumentType.GHANA_CARD, identityDocNumber: ghanaCardNumber },
        update: { ghanaCardNumber, identityDocType: IdentityDocumentType.GHANA_CARD, identityDocNumber: ghanaCardNumber, nationalIdVerifiedAt: null, nationalIdVerifiedBy: null },
      });
      await this.addRole(userId, UserRole.DRIVER);
    } else {
      await this.prisma.owner.upsert({
        where: { userId },
        create: { userId, ghanaCardNumber },
        update: { ghanaCardNumber, nationalIdVerifiedAt: null, nationalIdVerifiedBy: null, verifiedAt: null, verifiedBy: null },
      });
      await this.addRole(userId, UserRole.OWNER);
    }
    // The identity flow creates the profile directly (no separate create
    // call), so promote the login account's primary role here too —
    // otherwise verified Drivers/Owners keep landing on the plain portal.
    const fresh = await this.loadUser(userId);
    await this.ensurePrimary(fresh, kind === 'DRIVER' ? UserRole.DRIVER : UserRole.OWNER);
    return this.getMyAccounts(userId);
  }

  // Identity check for Driver/Owner: Ghana Card number + front and back of
  // the card + a live camera capture. Stored as PENDING_REVIEW — a person
  // compares the face to the card before the account counts as verified.
  async submitIdentityVerification(
    userId: string,
    kind: 'DRIVER' | 'OWNER',
    ghanaCardNumberRaw: string,
    files: { idFront?: any; idBack?: any; selfie?: any },
    livenessChallenge?: string,
    livenessPassed?: boolean,
  ) {
    const ghanaCardNumber = normalizeGhanaCardNumber(ghanaCardNumberRaw);
    if (!ghanaCardNumber) throw new BadRequestException(GHANA_CARD_FORMAT_MESSAGE);
    if (!files?.idFront || !files?.idBack) {
      throw new BadRequestException('Upload the front and back of your Ghana Card.');
    }
    if (!files?.selfie) {
      throw new BadRequestException('Complete the live camera check so we can match your face to your card.');
    }
    if (!this.storage) throw new ConflictException('Document storage is not available right now');
    await this.assertGhanaCardFree(userId, ghanaCardNumber);

    // Make sure the personal account exists, then attach the number to it.
    await this.submitNationalId(userId, kind, ghanaCardNumber);

    const folder = `identity/${userId}/${kind.toLowerCase()}`;
    const [front, back, selfie] = await Promise.all([
      this.storage.uploadFile(files.idFront, folder),
      this.storage.uploadFile(files.idBack, folder),
      this.storage.uploadFile(files.selfie, folder),
    ]);

    const kindRole = kind === 'DRIVER' ? UserRole.DRIVER : UserRole.OWNER;
    await (this.prisma as any).identityVerification.upsert({
      where: { userId_accountKind: { userId, accountKind: kindRole } },
      create: {
        userId, accountKind: kindRole, ghanaCardNumber,
        idFrontUrl: front.url, idFrontFileName: files.idFront.originalname || front.fileName,
        idBackUrl: back.url, idBackFileName: files.idBack.originalname || back.fileName,
        livenessSelfieUrl: selfie.url,
        livenessChallenge: livenessChallenge || null,
        livenessCapturedAt: new Date(),
        livenessPassed: !!livenessPassed,
        status: 'PENDING_REVIEW',
      },
      update: {
        ghanaCardNumber,
        idFrontUrl: front.url, idFrontFileName: files.idFront.originalname || front.fileName,
        idBackUrl: back.url, idBackFileName: files.idBack.originalname || back.fileName,
        livenessSelfieUrl: selfie.url,
        livenessChallenge: livenessChallenge || null,
        livenessCapturedAt: new Date(),
        livenessPassed: !!livenessPassed,
        status: 'PENDING_REVIEW', reviewNote: null, reviewedBy: null, reviewedAt: null,
      },
    });
    return this.getMyAccounts(userId);
  }

  // Driver phase 2: locked until phase 1 (Ghana Card + live face check)
  // has been submitted. Stores licence details + front/back for review.
  async submitLicenceVerification(
    userId: string,
    dto: { licenseNumber: string; licenseClass?: string; licenseExpiryDate?: string },
    files: { licenceFront?: any; licenceBack?: any },
  ) {
    const identity = await (this.prisma as any).identityVerification.findUnique({
      where: { userId_accountKind: { userId, accountKind: UserRole.DRIVER } },
    });
    if (!identity) {
      throw new BadRequestException('Complete Phase 1 first: Ghana Card with the live face check. The licence step unlocks after that.');
    }
    if (!files?.licenceFront || !files?.licenceBack) {
      throw new BadRequestException("Upload the front and back of your Driver's Licence.");
    }
    if (!this.storage) throw new ConflictException('Document storage is not available right now');

    // Saves licence number/class/expiry on the driver profile (validates
    // the number and its uniqueness) — throws before we store any files.
    await this.submitDriverLicence(userId, dto);

    const folder = `identity/${userId}/driver-licence`;
    const [front, back] = await Promise.all([
      this.storage.uploadFile(files.licenceFront, folder),
      this.storage.uploadFile(files.licenceBack, folder),
    ]);
    await (this.prisma as any).licenceVerification.upsert({
      where: { userId },
      create: {
        userId, licenseNumber: dto.licenseNumber.trim().toUpperCase(),
        licenceFrontUrl: front.url, licenceFrontFileName: files.licenceFront.originalname || front.fileName,
        licenceBackUrl: back.url, licenceBackFileName: files.licenceBack.originalname || back.fileName,
        status: 'PENDING_REVIEW',
      },
      update: {
        licenseNumber: dto.licenseNumber.trim().toUpperCase(),
        licenceFrontUrl: front.url, licenceFrontFileName: files.licenceFront.originalname || front.fileName,
        licenceBackUrl: back.url, licenceBackFileName: files.licenceBack.originalname || back.fileName,
        status: 'PENDING_REVIEW', reviewNote: null, reviewedBy: null, reviewedAt: null,
      },
    });
    return this.getMyAccounts(userId);
  }

  async submitDriverLicence(userId: string, dto: { licenseNumber: string; licenseClass?: string; licenseExpiryDate?: string }) {
    const licenseNumber = (dto.licenseNumber || '').trim().toUpperCase();
    if (licenseNumber.length < 4) throw new BadRequestException("Enter your Driver's Licence number.");
    const existing = await this.prisma.driver.findUnique({ where: { licenseNumber } });
    if (existing && existing.userId !== userId) {
      throw new ConflictException("This Driver's Licence is already registered to another driver.");
    }
    await this.prisma.driver.upsert({
      where: { userId },
      create: {
        userId, licenseNumber,
        licenseClass: dto.licenseClass || null,
        licenseExpiryDate: dto.licenseExpiryDate ? new Date(dto.licenseExpiryDate) : null,
      },
      update: {
        licenseNumber,
        ...(dto.licenseClass !== undefined ? { licenseClass: dto.licenseClass || null } : {}),
        ...(dto.licenseExpiryDate !== undefined ? { licenseExpiryDate: dto.licenseExpiryDate ? new Date(dto.licenseExpiryDate) : null } : {}),
        licenceVerifiedAt: null, licenceVerifiedBy: null,
      },
    });
    await this.addRole(userId, UserRole.DRIVER);
    const fresh = await this.loadUser(userId);
    await this.ensurePrimary(fresh, UserRole.DRIVER);
    return this.getMyAccounts(userId);
  }
}
