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
import * as bcrypt from 'bcrypt';

import { UserRole } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { UsersService } from '../users/users.service';
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
  ) {}

  async register(dto: RegisterDto) {
    // Check if email or phone already exists
    if (dto.email) {
      const existingEmail = await this.prisma.user.findUnique({
        where: { email: dto.email },
      });
      if (existingEmail) {
        throw new ConflictException('Email address is already registered');
      }
    }

    if (dto.phone) {
      const existingPhone = await this.prisma.user.findUnique({
        where: { phone: dto.phone },
      });
      if (existingPhone) {
        throw new ConflictException('Phone number is already registered');
      }
    }

    if (!dto.email && !dto.phone) {
      throw new BadRequestException('Email or phone number is required');
    }

    const saltRounds = this.configService.get<number>('app.bcryptSaltRounds', 12);
    const passwordHash = await bcrypt.hash(dto.password, saltRounds);

    // Find the role
    const role = await this.prisma.role.findUnique({
      where: { name: dto.role },
    });
    if (!role) {
      throw new BadRequestException(`Invalid role: ${dto.role}`);
    }

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
