import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { IdentityDocumentType, UserRole } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AccountType } from './dto/onboarding.dto';
import { GHANA_CARD_FORMAT_MESSAGE, normalizeGhanaCardNumber } from '../../common/ghana-card';

export type VerificationStepStatus = 'NOT_SUBMITTED' | 'PENDING_REVIEW' | 'VERIFIED';

function identityStatus(profile: any): VerificationStepStatus {
  if (!profile) return 'NOT_SUBMITTED';
  if (profile.nationalIdVerifiedAt || profile.verifiedAt) return 'VERIFIED';
  if (profile.ghanaCardNumber || profile.identityDocNumber) return 'PENDING_REVIEW';
  return 'NOT_SUBMITTED';
}

function licenceStatus(driver: any): VerificationStepStatus {
  if (!driver) return 'NOT_SUBMITTED';
  if (driver.licenceVerifiedAt) return 'VERIFIED';
  if (driver.licenseNumber) return 'PENDING_REVIEW';
  return 'NOT_SUBMITTED';
}

@Injectable()
export class OnboardingService {
  constructor(private readonly prisma: PrismaService) {}

  async getState(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true, firstName: true, lastName: true, email: true, phone: true,
        primaryRole: true, status: true, authProvider: true, onboardingCompletedAt: true,
        driver: true, owner: true,
      },
    });
    if (!user) throw new NotFoundException('User not found');

    const accountType = user.primaryRole === UserRole.DRIVER || user.primaryRole === UserRole.OWNER ? user.primaryRole : null;
    const profile: any = accountType === UserRole.DRIVER ? user.driver : accountType === UserRole.OWNER ? user.owner : null;
    const idStatus = identityStatus(profile);
    const licStatus = accountType === UserRole.DRIVER ? licenceStatus(user.driver) : null;

    // National ID and Driver's Licence verification are no longer part
    // of onboarding. An account is fully set up once its type exists
    // (created through the paid flow in My Account).
    const steps = [
      { key: 'account', label: 'Create account', status: 'VERIFIED' as VerificationStepStatus, done: true },
      { key: 'accountType', label: 'Choose account type', status: (accountType ? 'VERIFIED' : 'NOT_SUBMITTED') as VerificationStepStatus, done: !!accountType },
    ];

    const submitted = steps.every((s) => s.done);
    const verified = submitted;
    const nextStep = steps.find((s) => !s.done)?.key || 'done';

    // Once every required detail has been submitted, onboarding is complete
    // from the user's side even while a Super Admin review is pending.
    if (submitted && !user.onboardingCompletedAt) {
      await this.prisma.user.update({ where: { id: userId }, data: { onboardingCompletedAt: new Date() } });
    }

    return {
      userId: user.id,
      name: `${user.firstName} ${user.lastName}`.trim(),
      email: user.email, phone: user.phone,
      authProvider: user.authProvider || 'LOCAL',
      accountStatus: user.status,
      accountType,
      steps,
      // submitted = user finished their part; verified = Super Admin approved.
      completed: submitted,
      submitted,
      verified,
      nextStep,
      nationalId: {
        status: idStatus,
        ghanaCardNumber: profile?.ghanaCardNumber || profile?.identityDocNumber || null,
        verifiedAt: profile?.nationalIdVerifiedAt || profile?.verifiedAt || null,
      },
      licence: accountType === UserRole.DRIVER ? {
        status: licStatus,
        licenseNumber: user.driver?.licenseNumber || null,
        licenseClass: user.driver?.licenseClass || null,
        licenseExpiryDate: user.driver?.licenseExpiryDate || null,
        verifiedAt: user.driver?.licenceVerifiedAt || null,
      } : null,
      dashboardPath: accountType === UserRole.OWNER ? '/owner/dashboard' : accountType === UserRole.DRIVER ? '/driver/dashboard' : '/onboarding',
    };
  }

  async setAccountType(userId: string, accountType: AccountType) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, primaryRole: true, driver: { select: { id: true, ghanaCardNumber: true, licenseNumber: true } }, owner: { select: { id: true, ghanaCardNumber: true } } },
    });
    if (!user) throw new NotFoundException('User not found');

    const allowedFrom: UserRole[] = [UserRole.PENDING, UserRole.DRIVER, UserRole.OWNER];
    if (!allowedFrom.includes(user.primaryRole as UserRole)) {
      throw new BadRequestException('This account type cannot be changed during onboarding. Please contact support.');
    }

    const target = accountType as unknown as UserRole;
    if (user.primaryRole === target) {
      // Make sure the profile exists, then return current state.
      await this.ensureProfile(userId, target);
      return this.getState(userId);
    }

    // Switching before verification is allowed so a wrong tap can be fixed.
    // Once identity is verified the type is locked.
    const currentProfile: any = user.primaryRole === UserRole.DRIVER ? user.driver : user.primaryRole === UserRole.OWNER ? user.owner : null;
    if (currentProfile?.ghanaCardNumber) {
      const state = await this.getState(userId);
      if (state.nationalId.status === 'VERIFIED') {
        throw new BadRequestException('Your account type cannot be changed after your National ID has been verified. Please contact support.');
      }
    }

    const role = await this.prisma.role.findUnique({ where: { name: target } });

    await this.prisma.$transaction(async (tx: any) => {
      await tx.userRoleAssignment.deleteMany({ where: { userId } });
      if (role) await tx.userRoleAssignment.create({ data: { userId, roleId: role.id } });
      await tx.user.update({ where: { id: userId }, data: { primaryRole: target, onboardingCompletedAt: null } });
      if (target === UserRole.DRIVER) {
        await tx.driver.upsert({ where: { userId }, create: { userId }, update: {} });
      } else {
        await tx.owner.upsert({ where: { userId }, create: { userId }, update: {} });
      }
    });

    return this.getState(userId);
  }

  private async ensureProfile(userId: string, role: UserRole) {
    if (role === UserRole.DRIVER) await this.prisma.driver.upsert({ where: { userId }, create: { userId }, update: {} });
    if (role === UserRole.OWNER) await this.prisma.owner.upsert({ where: { userId }, create: { userId }, update: {} });
  }

  async submitNationalId(userId: string, ghanaCardNumberRaw: string) {
    const ghanaCardNumber = normalizeGhanaCardNumber(ghanaCardNumberRaw);
    if (!ghanaCardNumber) throw new BadRequestException(GHANA_CARD_FORMAT_MESSAGE);

    const state = await this.getState(userId);
    if (!state.accountType) throw new BadRequestException('Choose whether you are a Driver or an Owner first.');

    // Ghana Card numbers are unique across both profile tables.
    const [driverOwner, ownerOwner] = await Promise.all([
      this.prisma.driver.findUnique({ where: { ghanaCardNumber } }),
      this.prisma.owner.findUnique({ where: { ghanaCardNumber } }),
    ]);
    const takenBy = driverOwner?.userId || ownerOwner?.userId;
    if (takenBy && takenBy !== userId) {
      throw new ConflictException('This National ID is already registered to another account. If this is yours, contact support or ask a Super Admin to check it.');
    }

    if (state.accountType === UserRole.OWNER) {
      await this.prisma.owner.upsert({
        where: { userId },
        create: { userId, ghanaCardNumber },
        update: { ghanaCardNumber, nationalIdVerifiedAt: null, nationalIdVerifiedBy: null, verifiedAt: null, verifiedBy: null },
      });
    } else {
      if (driverOwner && driverOwner.userId !== userId) throw new ConflictException('This National ID is already registered to another driver.');
      await this.prisma.driver.upsert({
        where: { userId },
        create: { userId, ghanaCardNumber, identityDocType: IdentityDocumentType.GHANA_CARD, identityDocNumber: ghanaCardNumber },
        update: { ghanaCardNumber, identityDocType: IdentityDocumentType.GHANA_CARD, identityDocNumber: ghanaCardNumber, nationalIdVerifiedAt: null, nationalIdVerifiedBy: null },
      });
    }
    return this.getState(userId);
  }

  async submitDriverLicence(userId: string, dto: { licenseNumber: string; licenseClass?: string; licenseExpiryDate?: string }) {
    const state = await this.getState(userId);
    if (state.accountType !== UserRole.DRIVER) {
      throw new BadRequestException("Only Driver accounts need a Driver's Licence. Choose Driver as your account type first.");
    }
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
    return this.getState(userId);
  }
}
