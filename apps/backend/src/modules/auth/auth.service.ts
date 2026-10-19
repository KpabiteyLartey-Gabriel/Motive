import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { v4 as uuidv4 } from 'uuid';
import * as bcrypt from 'bcryptjs';

import { NotificationChannel, UserRole } from '@prisma/client';
import { createHash, randomBytes } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { NotificationsService } from '../notifications/notifications.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

export interface JwtPayload {
  sub: string;
  email: string;
  phone: string;
  role: string;
  roles: string[];
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: string;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly notifications: NotificationsService,
  ) {}

  async register(dto: RegisterDto) {
    if (!dto.email && !dto.phone) {
      throw new BadRequestException('Email or phone number is required');
    }

    // Run the independent lookups together — sequential round-trips to the
    // hosted database made signup take several seconds.
    const [existingEmail, existingPhone, role] = await Promise.all([
      dto.email ? this.prisma.user.findUnique({ where: { email: dto.email } }) : Promise.resolve(null),
      dto.phone ? this.prisma.user.findUnique({ where: { phone: dto.phone } }) : Promise.resolve(null),
      this.prisma.role.findUnique({ where: { name: dto.role } }),
    ]);
    if (existingEmail) {
      throw new ConflictException('Email address is already registered');
    }
    if (existingPhone) {
      throw new ConflictException('Phone number is already registered');
    }
    if (!role) {
      throw new BadRequestException(`Invalid role: ${dto.role}`);
    }

    const saltRounds = this.configService.get<number>('app.bcryptSaltRounds', 12);
    const passwordHash = await bcrypt.hash(dto.password, saltRounds);

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        phone: dto.phone,
        passwordHash,
        firstName: dto.firstName,
        lastName: dto.lastName,
        primaryRole: dto.role as any,
        roles: {
          create: {
            roleId: role.id,
          },
        },
        // Provision the role profile with the account: an OWNER/DRIVER
        // user without a profile cannot own vehicles, be assigned, or
        // pass resource-level access checks.
        ...(dto.role === UserRole.OWNER ? { owner: { create: {} } } : {}),
        ...(dto.role === UserRole.DRIVER ? { driver: { create: {} } } : {}),
      },
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
    });

    this.logger.log(`New user registered: ${user.id} (${user.email || user.phone})`);

    // Welcome email + SMS run in the background: gateways can take many
    // seconds and must never hold up signup (a slow welcome message made
    // registration look like it failed after the account was created).
    void this.notifyUser(user.id, {
      subject: 'Welcome to +Motive',
      body: `Hello ${user.firstName}, welcome to +Motive. Your ${user.primaryRole.toLowerCase().replace(/_/g, ' ')} account is ready — sign in to get started.`,
      type: 'WELCOME',
    }).catch((err) => this.logger.warn(`Welcome notification failed: ${err?.message}`));

    const tokens = await this.generateTokens(user.id, user.email, user.phone, user.primaryRole);

    return {
      user,
      ...tokens,
    };
  }

  async login(dto: LoginDto) {
    const user = await this.validateUser(dto.identifier, dto.password);

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (user.status === 'SUSPENDED') {
      throw new UnauthorizedException('Your account has been suspended. Please contact support.');
    }

    if (user.status === 'DEACTIVATED') {
      throw new UnauthorizedException('Account is deactivated');
    }

    // Reset failed login attempts on success
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginAttempts: 0,
        lastLoginAt: new Date(),
        lockedUntil: null,
      },
    });

    this.logger.log(`User logged in: ${user.id}`);

    const tokens = await this.generateTokens(user.id, user.email, user.phone, user.primaryRole);
    const { passwordHash, ...safeUser } = user;

    return {
      user: safeUser,
      ...tokens,
    };
  }

  async validateUser(identifier: string, password: string) {
    const user = await this.prisma.user.findFirst({
      where: {
        OR: [{ email: identifier }, { phone: identifier }],
        deletedAt: null,
      },
    });

    if (!user || !user.passwordHash) {
      // Increment failed attempts for security
      return null;
    }

    // Check account lock
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      throw new UnauthorizedException(
        `Account locked until ${user.lockedUntil.toISOString()}. Too many failed attempts.`,
      );
    }

    const isValid = await bcrypt.compare(password, user.passwordHash);

    if (!isValid) {
      // Track failed attempts, lock after 5
      const attempts = user.failedLoginAttempts + 1;
      const lockUntil = attempts >= 5 ? new Date(Date.now() + 15 * 60 * 1000) : null;

      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          failedLoginAttempts: attempts,
          ...(lockUntil && { lockedUntil: lockUntil }),
        },
      });

      return null;
    }

    return user;
  }

  async refreshTokens(refreshToken: string): Promise<AuthTokens> {
    const tokenRecord = await this.prisma.refreshToken.findUnique({
      where: { token: refreshToken },
      include: { user: true },
    });

    if (!tokenRecord || tokenRecord.revokedAt || tokenRecord.expiresAt < new Date()) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    // Rotate: revoke old, issue new
    await this.prisma.refreshToken.update({
      where: { id: tokenRecord.id },
      data: { revokedAt: new Date() },
    });

    return this.generateTokens(
      tokenRecord.user.id,
      tokenRecord.user.email,
      tokenRecord.user.phone,
      tokenRecord.user.primaryRole,
    );
  }

  async logout(userId: string, refreshToken?: string) {
    if (refreshToken) {
      await this.prisma.refreshToken.updateMany({
        where: { userId, token: refreshToken },
        data: { revokedAt: new Date() },
      });
    } else {
      // Revoke all refresh tokens for user
      await this.prisma.refreshToken.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }
  }

  // ── Password reset (forgot password) ─────────────────────────

  private hashResetToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private async notifyUser(userId: string, opts: { subject: string; body: string; type: string; html?: string }) {
    // Email + SMS + in-app record, each best-effort
    await this.notifications.send({ userId, channel: NotificationChannel.EMAIL, type: opts.type, subject: opts.subject, body: opts.body, data: opts.html ? { html: opts.html } : undefined }).catch(() => null);
    await this.notifications.send({ userId, channel: NotificationChannel.SMS, type: opts.type, body: opts.body }).catch(() => null);
    await this.notifications.send({ userId, channel: NotificationChannel.IN_APP, type: opts.type, subject: opts.subject, body: opts.body }).catch(() => null);
  }

  async forgotPassword(identifier: string) {
    const generic = {
      success: true,
      message: 'If an account exists for that email or phone, we have sent password reset instructions.',
    };
    const ident = (identifier || '').trim();
    if (!ident) return generic;

    const user = await this.prisma.user.findFirst({
      where: {
        deletedAt: null,
        OR: [
          { email: ident.toLowerCase() },
          { phone: ident },
          { phone: ident.startsWith('+') ? ident : `+${ident}` },
          { phone: ident.replace(/^\+233/, '0') },
        ],
      },
      select: { id: true, email: true, phone: true, firstName: true, status: true },
    });
    if (!user || user.status === 'DEACTIVATED') return generic;

    // One live token per user: retire previous unused ones
    await this.prisma.passwordReset.updateMany({
      where: { userId: user.id, usedAt: null },
      data: { usedAt: new Date() },
    });

    const token = randomBytes(32).toString('hex');
    await this.prisma.passwordReset.create({
      data: {
        userId: user.id,
        token: this.hashResetToken(token),
        expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 60 minutes
      },
    });

    const appUrl = (process.env.APP_URL || 'http://localhost:3000').replace(/\/$/, '');
    const link = `${appUrl}/reset-password?token=${token}`;
    const body = `Hello ${user.firstName}, we received a request to reset your +Motive password. Use the link below within 60 minutes. If you did not request this, ignore this message — your password will not change.`;
    const html = `<!DOCTYPE html><html><body style="margin:0;background:#f3f4f6;padding:32px 16px;font-family:Arial,Helvetica,sans-serif;color:#111827"><div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:16px;padding:32px"><div style="display:inline-block;background:#059669;color:#ffffff;font-weight:800;border-radius:10px;padding:8px 12px">+</div><span style="font-weight:800;font-size:18px;margin-left:8px">Positive Motive</span><h1 style="font-size:22px;margin:24px 0 12px">Reset your password</h1><p style="line-height:1.7;color:#374151">Hello ${user.firstName},</p><p style="line-height:1.7;color:#374151">We received a request to reset the password for your Positive Motive (+Motive) account. Click the button below to choose a new password:</p><p style="margin:24px 0"><a href="${link}" style="display:inline-block;background:#059669;color:#ffffff;padding:13px 24px;border-radius:10px;text-decoration:none;font-weight:700">Reset my password</a></p><p style="line-height:1.7;color:#374151">This link expires in 60 minutes and can only be used once.</p><p style="line-height:1.7;color:#374151">If the button does not work, copy and paste this address into your browser:<br/><span style="color:#047857;word-break:break-all">${link}</span></p><p style="line-height:1.7;color:#374151">If you did not request a password reset, no action is needed — your password will stay the same, and you can safely ignore this email.</p></div></body></html>`;

    await this.notifyUser(user.id, { subject: 'Reset your +Motive password', body: `${body} Reset link: ${link}`, type: 'PASSWORD_RESET', html }).catch(() => null);
    this.logger.log(`Password reset issued for user ${user.id}`);
    return generic;
  }

  async resetPassword(token: string, newPassword: string) {
    if (!newPassword || newPassword.length < 8) {
      throw new BadRequestException('New password must be at least 8 characters');
    }
    const record = await this.prisma.passwordReset.findUnique({
      where: { token: this.hashResetToken(token || '') },
      include: { user: { select: { id: true, firstName: true } } },
    });
    if (!record || record.usedAt || record.expiresAt < new Date()) {
      throw new BadRequestException('This reset link is invalid or has expired. Request a new one.');
    }

    const saltRounds = this.configService.get<number>('app.bcryptSaltRounds', 12);
    const passwordHash = await bcrypt.hash(newPassword, saltRounds);

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: record.userId },
        data: { passwordHash, failedLoginAttempts: 0, lockedUntil: null },
      }),
      this.prisma.passwordReset.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
      this.prisma.refreshToken.updateMany({
        where: { userId: record.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);

    await this.notifyUser(record.userId, {
      subject: 'Your +Motive password was changed',
      body: `Hello ${record.user.firstName}, your +Motive password was just changed and all other sessions were signed out. If this was not you, contact us immediately.`,
      type: 'PASSWORD_CHANGED',
    }).catch(() => null);

    return { success: true, message: 'Password reset successful. Sign in with your new password.' };
  }

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        phone: true,
        firstName: true,
        lastName: true,
        otherNames: true,
        profilePhotoUrl: true,
        primaryRole: true,
        status: true,
        emailVerifiedAt: true,
        phoneVerifiedAt: true,
        lastLoginAt: true,
        createdAt: true,
        roles: {
          include: {
            role: {
              include: {
                rolePermissions: {
                  include: { permission: true },
                },
              },
            },
          },
        },
      },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    // Extract permission names
    const permissions = user.roles.flatMap((ur) =>
      ur.role.rolePermissions.map((rp) => rp.permission.name),
    );

    return {
      ...user,
      permissions: [...new Set(permissions)],
    };
  }

  private async generateTokens(
    userId: string,
    email: string,
    phone: string,
    primaryRole: any,
  ): Promise<AuthTokens> {
    const roles = await this.prisma.userRoleAssignment.findMany({
      where: { userId, revokedAt: null },
      include: { role: true },
    });

    const roleNames = roles.map((r) => r.role.name);

    const payload: JwtPayload = {
      sub: userId,
      email: email,
      phone: phone,
      role: primaryRole,
      roles: roleNames,
    };

    const expiresIn = this.configService.get<string>('jwt.expiresIn', '15m');
    const refreshExpiresIn = this.configService.get<string>('jwt.refreshExpiresIn', '7d');

    const accessToken = this.jwtService.sign(payload);

    const refreshTokenValue = uuidv4();
    const refreshExpiresMs = this.parseExpiry(refreshExpiresIn);

    await this.prisma.refreshToken.create({
      data: {
        userId,
        token: refreshTokenValue,
        expiresAt: new Date(Date.now() + refreshExpiresMs),
      },
    });

    return {
      accessToken,
      refreshToken: refreshTokenValue,
      expiresIn,
    };
  }

  private parseExpiry(expiry: string): number {
    const match = expiry.match(/^(\d+)([smhd])$/);
    if (!match) return 7 * 24 * 60 * 60 * 1000;
    const value = parseInt(match[1], 10);
    const unit = match[2];
    const multipliers = { s: 1000, m: 60000, h: 3600000, d: 86400000 };
    return value * (multipliers[unit] || 86400000);
  }
}
