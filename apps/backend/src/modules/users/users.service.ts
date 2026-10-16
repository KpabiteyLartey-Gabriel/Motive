import { Injectable, NotFoundException, ForbiddenException, BadRequestException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../prisma/prisma.service';
import { UserRole, UserStatus } from '@prisma/client';
import { UpdateProfileDto } from './dto/account-settings.dto';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

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
