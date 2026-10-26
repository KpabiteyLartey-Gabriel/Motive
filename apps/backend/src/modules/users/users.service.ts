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

  // Databank-style verification email: banner, greeting, one-time code
  // box, 5-minute expiry, sign-off and a dark footer.
  private buildVerificationEmail(user: any, code: string) {
    const name = `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'there';
    const supportEmail = process.env.SUPPORT_EMAIL || process.env.SMTP_USER || 'support@positivemotive.com';
    const supportPhone = process.env.SUPPORT_PHONE || '';
    const text = [
      `Dear ${name},`,
      '',
      'ACCOUNT VERIFICATION',
      `One-time code: ${code}`,
      '',
      'Use the one-time code above to complete your sign-up to Positive Motive (+Motive).',
      'This code expires in 5 minutes.',
      "If you didn't create this account, please ignore this email and contact us immediately.",
      '',
      'Warm regards,',
      'The +Motive Team',
      '',
      `© +Motive. All rights reserved.${supportPhone ? `\n${supportPhone} • ` : '\n'}${supportEmail}`,
    ].join('\n');
    const html = `<!doctype html><html><body style="margin:0;padding:24px;background:#EEF3EC;font-family:Arial,Helvetica,sans-serif;color:#14201A">
<div style="max-width:640px;margin:0 auto;background:#ffffff;border-radius:6px;overflow:hidden">
  <div style="background:#005C33;padding:26px 32px">
    <div style="font-size:26px;font-weight:800;letter-spacing:.5px;color:#ffffff">+MOTIVE</div>
    <div style="margin-top:4px;font-size:13px;color:#BFE8D2">Drive. Earn. Own it.</div>
  </div>
  <div style="height:4px;background:#017A4A"></div>
  <div style="padding:32px">
    <p style="margin:0 0 22px;font-size:17px">Dear <strong>${name}</strong>,</p>
    <p style="margin:0 0 12px;font-size:13px;font-weight:700;letter-spacing:1.2px;color:#017A4A">ACCOUNT VERIFICATION</p>
    <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;margin:0 0 22px">
      <tr>
        <td style="background:#F4F4F4;padding:14px 16px;font-size:15px;color:#333333">One-time code</td>
        <td style="background:#EDF7F0;padding:14px 16px;font-size:18px;font-weight:800;letter-spacing:2px;color:#017A4A;text-align:left">${code}</td>
      </tr>
    </table>
    <p style="margin:0 0 14px;font-size:15px;line-height:1.6">Use the one-time code above to complete your sign-up to Positive Motive (+Motive).</p>
    <p style="margin:0 0 14px;font-size:15px;line-height:1.6">This code expires in 5 minutes.</p>
    <p style="margin:0 0 28px;font-size:15px;line-height:1.6">If you didn&rsquo;t create this account, please ignore this email and contact us immediately.</p>
    <p style="margin:0;font-size:15px;line-height:1.6">Warm regards,<br/><strong>The +Motive Team</strong></p>
  </div>
  <div style="background:#15181A;padding:20px 32px;text-align:center;color:#C9CED1;font-size:13px;line-height:1.7">
    &copy; +Motive. All rights reserved.<br/>${supportPhone ? `${supportPhone} &bull; ` : ''}${supportEmail}
  </div>
</div>
</body></html>`;
    return { text, html, subject: 'Verify your +Motive account' };
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
      data: { userId, type, code: this.hashCode(code), expiresAt: new Date(Date.now() + 5 * 60 * 1000) },
    });

    const text = `Your +Motive verification code is ${code}. It expires in 5 minutes. Do not share it with anyone.`;
    if (this.messaging) {
      if (isEmail) {
        const mail = this.buildVerificationEmail(user, code);
        await this.messaging.sendEmail(target, mail.subject, mail.text, mail.html).catch((e) => this.logger.warn(`Verify email failed: ${e?.message}`));
      } else {
        await this.messaging.sendSms(target, text).catch((e) => this.logger.warn(`Verify SMS failed: ${e?.message}`));
      }
    } else {
      this.logger.warn(`Messaging unavailable — verification code for user ${userId} not sent`);
    }

    return { success: true, alreadyVerified: false, message: `We sent a 6-digit code to your ${channel}. It expires in 5 minutes.` };
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
}
