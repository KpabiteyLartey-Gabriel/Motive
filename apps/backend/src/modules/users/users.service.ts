import { Injectable, Optional, Logger, NotFoundException, ForbiddenException, BadRequestException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { createHash, randomInt } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { UserRole, UserStatus } from '@prisma/client';
import { UpdateProfileDto } from './dto/account-settings.dto';
import { MessagingService } from '../messaging/messaging.service';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly messaging?: MessagingService,
  ) {}

  async findById(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id, deletedAt: null },
      select: {
        id: true,
        email: true,
        phone: true,
        firstName: true,
        lastName: true,
        otherNames: true,
        gender: true,
        dateOfBirth: true,
        profilePhotoUrl: true,
        primaryRole: true,
        status: true,
        emailVerifiedAt: true,
        phoneVerifiedAt: true,
        lastLoginAt: true,
        createdAt: true,
        updatedAt: true,
        driver: {
          select: {
            id: true,
            status: true,
            licenseNumber: true,
          },
        },
        owner: {
          select: {
            id: true,
            status: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  async findAll(params: {
    page?: number;
    limit?: number;
    role?: UserRole;
    search?: string;
  }) {
    const { page = 1, limit = 20, role, search } = params;
    const skip = (Math.max(1, Math.floor(Number(page)) || 1) - 1) * (Math.max(1, Math.floor(Number(limit)) || 20));

    const where: any = { deletedAt: null };

    if (role) {
      where.primaryRole = role;
    }

    if (search) {
      where.OR = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search } },
      ];
    }

    const [users, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        skip,
        take: Math.max(1, Math.floor(Number(limit)) || 20),
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          email: true,
          phone: true,
          firstName: true,
          lastName: true,
          primaryRole: true,
          status: true,
          createdAt: true,
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      users,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / (Math.max(1, Math.floor(Number(limit)) || 20))),
      },
    };
  }

  async updateStatus(id: string, status: UserStatus, actorId: string) {
    const user = await this.prisma.user.findUnique({ where: { id, deletedAt: null } });
    if (!user) throw new NotFoundException('User not found');
    if (user.id === actorId) throw new BadRequestException('You cannot change your own status');

    return this.prisma.user.update({
      where: { id },
      data: { status },
      select: {
        id: true, email: true, phone: true,
        firstName: true, lastName: true,
        primaryRole: true, status: true, updatedAt: true,
      },
    });
  }

  async updateRole(id: string, role: UserRole, actorId: string) {
    const user = await this.prisma.user.findUnique({ where: { id, deletedAt: null } });
    if (!user) throw new NotFoundException('User not found');
    if (user.id === actorId) throw new BadRequestException('You cannot change your own role');

    // Update primary role and ensure role assignment exists
    const roleRecord = await this.prisma.role.findUnique({ where: { name: role } });
    if (!roleRecord) throw new BadRequestException(`Invalid role: ${role}`);

    const existing = await this.prisma.userRoleAssignment.findFirst({
      where: { userId: id, roleId: roleRecord.id },
    });

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id },
        data: { primaryRole: role },
      }),
      ...(existing ? [] : [
        this.prisma.userRoleAssignment.create({
          data: { userId: id, roleId: roleRecord.id },
        }),
      ]),
    ]);

    return this.findById(id);
  }

  // ── Own account settings ────────────────────────────────────
  private async getUserOrThrow(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id, deletedAt: null } });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  private async revokeRefreshTokens(userId: string) {
    await this.prisma.refreshToken.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } });
  }

  async updateProfile(id: string, dto: UpdateProfileDto) {
    await this.getUserOrThrow(id);
    // Whitelist: profile fields only — role/status can never change here.
    const data: any = {};
    for (const key of ['firstName', 'lastName', 'otherNames', 'phone', 'gender'] as const) {
      if (dto[key] !== undefined) data[key] = dto[key];
    }
    if (dto.dateOfBirth !== undefined) data.dateOfBirth = dto.dateOfBirth ? new Date(dto.dateOfBirth) : null;
    await this.prisma.user.update({ where: { id }, data });
    return this.findById(id);
  }

  async setProfilePhoto(id: string, profilePhotoUrl: string) {
    await this.getUserOrThrow(id);
    await this.prisma.user.update({ where: { id }, data: { profilePhotoUrl } });
    return this.findById(id);
  }

  async changePassword(id: string, currentPassword: string, newPassword: string) {
    if (!newPassword || newPassword.length < 8) {
      throw new BadRequestException('New password must be at least 8 characters');
    }
    const user: any = await this.getUserOrThrow(id);
    if (!user.passwordHash || !(await bcrypt.compare(currentPassword, user.passwordHash))) {
      throw new UnauthorizedException('Current password is incorrect');
    }
    const passwordHash = await bcrypt.hash(newPassword, 12);
    await this.prisma.user.update({ where: { id }, data: { passwordHash } });
    await this.revokeRefreshTokens(id);
    return { success: true, message: 'Password updated. Other sessions have been signed out.' };
  }

  // ── Email / phone verification (6-digit codes) ───────────────

  private hashCode(code: string): string {
    return createHash('sha256').update(code).digest('hex');
  }

  async sendVerificationCode(userId: string, channel: 'email' | 'phone') {
    const user: any = await this.getUserOrThrow(userId);
    const isEmail = channel === 'email';
    const type = isEmail ? 'EMAIL_VERIFY' : 'PHONE_VERIFY';
    const target = isEmail ? user.email : user.phone;
    const alreadyVerified = isEmail ? !!user.emailVerifiedAt : !!user.phoneVerifiedAt;

    if (alreadyVerified) return { success: true, alreadyVerified: true, message: `Your ${channel} is already verified.` };
    if (!target) throw new BadRequestException(`No ${channel} address on this account to verify.`);

    // One live code per user + channel
    await this.prisma.verificationCode.updateMany({
      where: { userId, type, usedAt: null },
      data: { usedAt: new Date() },
    });

    const code = String(randomInt(100000, 1000000));
    await this.prisma.verificationCode.create({
      data: { userId, type, code: this.hashCode(code), expiresAt: new Date(Date.now() + 10 * 60 * 1000) },
    });

    const text = `Your +Motive verification code is ${code}. It expires in 10 minutes. Do not share it with anyone.`;
    if (this.messaging) {
      if (isEmail) {
        await this.messaging.sendEmail(target, 'Verify your +Motive email', text).catch((e) => this.logger.warn(`Verify email failed: ${e?.message}`));
      } else {
        await this.messaging.sendSms(target, text).catch((e) => this.logger.warn(`Verify SMS failed: ${e?.message}`));
      }
    } else {
      this.logger.warn(`Messaging unavailable — verification code for user ${userId} not sent`);
    }

    return { success: true, alreadyVerified: false, message: `We sent a 6-digit code to your ${channel}. It expires in 10 minutes.` };
  }

  async confirmVerificationCode(userId: string, channel: 'email' | 'phone', code: string) {
    const type = channel === 'email' ? 'EMAIL_VERIFY' : 'PHONE_VERIFY';
    const clean = (code || '').trim();
    if (!/^\d{6}$/.test(clean)) throw new BadRequestException('Enter the 6-digit code we sent you.');

    const record = await this.prisma.verificationCode.findFirst({
      where: { userId, type, usedAt: null },
      orderBy: { createdAt: 'desc' },
    });
    if (!record || record.expiresAt < new Date() || record.code !== this.hashCode(clean)) {
      throw new BadRequestException('That code is incorrect or has expired. Request a new one.');
    }

    await this.prisma.$transaction([
      this.prisma.verificationCode.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
      this.prisma.user.update({
        where: { id: userId },
        data: channel === 'email' ? { emailVerifiedAt: new Date() } : { phoneVerifiedAt: new Date() },
      }),
    ]);

    return { success: true, message: `Your ${channel} is now verified.` };
  }

  // Admin-only: set a known test password so admins can sign in as a test
  // account. Passwords are bcrypt-hashed at rest and can never be viewed.
  async adminResetPassword(id: string, newPassword: string, actorId: string) {
    if (!newPassword || newPassword.length < 8) {
      throw new BadRequestException('Password must be at least 8 characters');
    }
    const target: any = await this.getUserOrThrow(id);
    const actor: any = await this.prisma.user.findUnique({ where: { id: actorId }, select: { primaryRole: true } });
    if (target.primaryRole === UserRole.SUPER_ADMIN && actor?.primaryRole !== UserRole.SUPER_ADMIN) {
      throw new ForbiddenException('Only a Super Admin can reset a Super Admin password');
    }
    const passwordHash = await bcrypt.hash(newPassword, 12);
    await this.prisma.user.update({ where: { id }, data: { passwordHash } });
    await this.revokeRefreshTokens(id);
    return { success: true, email: target.email, phone: target.phone, message: 'Password reset. Previous sessions have been signed out.' };
  }

  async deactivateMyAccount(id: string) {
    await this.getUserOrThrow(id);
    const user = await this.prisma.user.update({
      where: { id },
      data: { status: UserStatus.DEACTIVATED },
      select: { id: true, email: true, primaryRole: true, status: true },
    });
    await this.revokeRefreshTokens(id);
    return user;
  }

  async ensureOwnership(resourceUserId: string, requestingUserId: string, allowedRoles: string[]) {
    if (resourceUserId === requestingUserId) return;

    const requestingUser = await this.prisma.user.findUnique({
      where: { id: requestingUserId },
      select: { primaryRole: true },
    });

    if (!requestingUser || !allowedRoles.includes(requestingUser.primaryRole)) {
      throw new ForbiddenException('Access denied to this resource');
    }
  }
}
