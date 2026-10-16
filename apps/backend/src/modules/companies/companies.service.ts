import {
  Injectable, NotFoundException, ForbiddenException, BadRequestException, ConflictException,
  Inject, Optional, Logger,
} from '@nestjs/common';
import { createHash, randomBytes } from 'crypto';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../prisma/prisma.service';
import { CompanyType, UserRole } from '@prisma/client';
import { COMPANY_MEMBER_ROLES } from './dto/company-members.dto';
import { SMS_PROVIDER } from '../../integrations/sms/sms-integration.module';
import { type ISmsProvider } from '../../integrations/sms/interfaces/sms-provider.interface';

const COMPANY_FAMILY: UserRole[] = [UserRole.COMPANY_ADMIN, UserRole.COMPANY_MEMBER, UserRole.FLEET_MANAGER];
const MEMBER_INCLUDE = {
  user: {
    select: {
      id: true, firstName: true, lastName: true, otherNames: true,
      email: true, phone: true, profilePhotoUrl: true,
      gender: true, dateOfBirth: true,
      primaryRole: true, status: true,
      emailVerifiedAt: true, phoneVerifiedAt: true,
      lastLoginAt: true, createdAt: true, updatedAt: true,
    },
  },
} as const;

@Injectable()
export class CompaniesService {
  private readonly logger = new Logger(CompaniesService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Optional() @Inject(SMS_PROVIDER) private readonly smsProvider?: ISmsProvider,
  ) {}

  async create(userId: string, data: any) {
    const company = await this.prisma.company.create({ data });

    // Add creator as COMPANY_ADMIN member
    await this.prisma.companyMember.create({
      data: { companyId: company.id, userId, role: UserRole.COMPANY_ADMIN },
    });

    return company;
  }

  async findAll(params: { page?: number; limit?: number; type?: CompanyType }) {
    const { page = 1, limit = 20, type } = params;
    const skip = (Math.max(1, Math.floor(Number(page)) || 1) - 1) * (Math.max(1, Math.floor(Number(limit)) || 20));
    const where: any = {};
    if (type) where.type = type;

    const [companies, total] = await this.prisma.$transaction([
      this.prisma.company.findMany({
        where, skip,
        take: Math.max(1, Math.floor(Number(limit)) || 20),
        orderBy: { createdAt: 'desc' },
        select: { id: true, name: true, type: true, status: true, email: true, phone: true, city: true, createdAt: true },
      }),
      this.prisma.company.count({ where }),
    ]);

    return { companies, pagination: { total, page, limit, totalPages: Math.ceil(total / (Math.max(1, Math.floor(Number(limit)) || 20))) } };
  }

  async findById(id: string) {
    const company = await this.prisma.company.findUnique({
      where: { id },
      include: { members: { where: { isActive: true }, include: MEMBER_INCLUDE } },
    });
    if (!company) throw new NotFoundException('Company not found');
    return company;
  }

  async isMember(companyId: string, userId: string): Promise<boolean> {
    const member = await this.prisma.companyMember.findUnique({
      where: { companyId_userId: { companyId, userId } },
    });
    return !!member && member.isActive;
  }

  async assertMembership(companyId: string, userId: string) {
    const isMember = await this.isMember(companyId, userId);
    if (!isMember) throw new ForbiddenException('You are not a member of this company');
  }

  // ── My companies ────────────────────────────────────────────
  // A COMPANY_ADMIN account without a company (registration only creates
  // the User) gets one provisioned on first use, named after the account.
  async getMyCompanies(user: any) {
    let memberships = await this.prisma.companyMember.findMany({
      where: { userId: user.id, isActive: true },
      include: { company: true },
      orderBy: { joinedAt: 'asc' },
    });

    if (!memberships.length && user.primaryRole === UserRole.COMPANY_ADMIN) {
      const name = `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'My Company';
      const company = await this.prisma.company.create({
        data: { name, type: CompanyType.TRANSPORT, email: user.email || undefined, status: 'ACTIVE' as any },
      });
      await this.prisma.companyMember.create({
        data: { companyId: company.id, userId: user.id, role: UserRole.COMPANY_ADMIN },
      });
      memberships = await this.prisma.companyMember.findMany({
        where: { userId: user.id, isActive: true },
        include: { company: true },
        orderBy: { joinedAt: 'asc' },
      });
    }

    return memberships.map((m: any) => ({ ...m.company, myRole: m.role, membershipId: m.id }));
  }

  // ── Member management ───────────────────────────────────────
  private async assertCompanyAdmin(companyId: string, requesterId: string, requesterRole: string) {
    if (requesterRole === UserRole.ADMIN || requesterRole === UserRole.SUPER_ADMIN) return null;
    const membership = await this.prisma.companyMember.findFirst({
      where: { companyId, userId: requesterId, isActive: true },
    });
    if (!membership || membership.role !== UserRole.COMPANY_ADMIN) {
      throw new ForbiddenException('Only a company admin can manage company users');
    }
    return membership;
  }

  private async assertCompanyMember(companyId: string, requesterId: string, requesterRole: string) {
    if (requesterRole === UserRole.ADMIN || requesterRole === UserRole.SUPER_ADMIN) return;
    const membership = await this.prisma.companyMember.findFirst({
      where: { companyId, userId: requesterId, isActive: true },
    });
    if (!membership) throw new ForbiddenException('You are not a member of this company');
  }

  private assertValidMemberRole(role: string) {
    if (!(COMPANY_MEMBER_ROLES as readonly string[]).includes(role)) {
      throw new BadRequestException(`Company member role must be one of: ${COMPANY_MEMBER_ROLES.join(', ')}`);
    }
  }

  // Keep the user's global role assignments (used by RolesGuard) and, for
  // company-family roles, their primaryRole in sync with the membership.
  private async syncUserRole(user: any, role: UserRole, companyId: string, grantedBy: string) {
    const roleRecord = await this.prisma.role.findUnique({ where: { name: role } });
    if (roleRecord) {
      const existing = await this.prisma.userRoleAssignment.findFirst({
        where: { userId: user.id, roleId: roleRecord.id, companyId },
      });
      if (!existing) {
        await this.prisma.userRoleAssignment.create({
          data: { userId: user.id, roleId: roleRecord.id, companyId, grantedBy },
        });
      }
    }
    if (COMPANY_FAMILY.includes(role) && COMPANY_FAMILY.includes(user.primaryRole)) {
      await this.prisma.user.update({ where: { id: user.id }, data: { primaryRole: role } });
    }
  }

  async listMembers(companyId: string, requesterId: string, requesterRole: string) {
    const company = await this.prisma.company.findUnique({ where: { id: companyId } });
    if (!company) throw new NotFoundException('Company not found');
    await this.assertCompanyMember(companyId, requesterId, requesterRole);
    const members = await this.prisma.companyMember.findMany({
      where: { companyId },
      include: MEMBER_INCLUDE,
      orderBy: [{ isActive: 'desc' }, { joinedAt: 'asc' }],
    });
    return { company: { id: company.id, name: company.name, type: company.type, status: company.status }, members };
  }

  async addMember(companyId: string, requesterId: string, requesterRole: string, dto: { email: string; role: UserRole; title?: string }) {
    this.assertValidMemberRole(dto.role);
    const company = await this.prisma.company.findUnique({ where: { id: companyId } });
    if (!company) throw new NotFoundException('Company not found');
    await this.assertCompanyAdmin(companyId, requesterId, requesterRole);

    const user = await this.prisma.user.findFirst({
      where: { email: { equals: dto.email.trim(), mode: 'insensitive' }, deletedAt: null },
    });
    if (!user) {
      throw new NotFoundException(`No registered user found with email ${dto.email}. Ask them to create an account first, then add them again.`);
    }

    const existing = await this.prisma.companyMember.findUnique({
      where: { companyId_userId: { companyId, userId: user.id } },
    });
    if (existing?.isActive) throw new ConflictException('This user is already an active member of the company');

    const member = existing
      ? await this.prisma.companyMember.update({
          where: { id: existing.id },
          data: { role: dto.role, title: dto.title, isActive: true, leftAt: null },
          include: MEMBER_INCLUDE,
        })
      : await this.prisma.companyMember.create({
          data: { companyId, userId: user.id, role: dto.role, title: dto.title },
          include: MEMBER_INCLUDE,
        });

    await this.syncUserRole(user, dto.role, companyId, requesterId);
    return member;
  }

  async updateMemberRole(companyId: string, memberId: string, requesterId: string, requesterRole: string, dto: { role: UserRole; title?: string }) {
    this.assertValidMemberRole(dto.role);
    await this.assertCompanyAdmin(companyId, requesterId, requesterRole);
    const member = await this.prisma.companyMember.findUnique({ where: { id: memberId }, include: MEMBER_INCLUDE });
    if (!member || member.companyId !== companyId) throw new NotFoundException('Company member not found');

    if (member.role === UserRole.COMPANY_ADMIN && dto.role !== UserRole.COMPANY_ADMIN && member.isActive) {
      await this.assertNotLastAdmin(companyId, memberId);
    }

    const updated = await this.prisma.companyMember.update({
      where: { id: memberId },
      data: { role: dto.role, title: dto.title ?? member.title },
      include: MEMBER_INCLUDE,
    });
    await this.syncUserRole((member as any).user, dto.role, companyId, requesterId);
    return updated;
  }

  private async assertNotLastAdmin(companyId: string, exceptMemberId: string) {
    const admins = await this.prisma.companyMember.count({
      where: { companyId, role: UserRole.COMPANY_ADMIN, isActive: true, id: { not: exceptMemberId } },
    });
    if (admins === 0) throw new BadRequestException('The company must keep at least one active company admin');
  }

  async setMemberActive(companyId: string, memberId: string, isActive: boolean, requesterId: string, requesterRole: string) {
    await this.assertCompanyAdmin(companyId, requesterId, requesterRole);
    const member = await this.prisma.companyMember.findUnique({ where: { id: memberId } });
    if (!member || member.companyId !== companyId) throw new NotFoundException('Company member not found');
    if (!isActive && member.role === UserRole.COMPANY_ADMIN && member.isActive) {
      await this.assertNotLastAdmin(companyId, memberId);
    }
    return this.prisma.companyMember.update({
      where: { id: memberId },
      data: { isActive, leftAt: isActive ? null : new Date() },
      include: MEMBER_INCLUDE,
    });
  }

  // ── Invites (person may not have an account yet) ────────────
  private hashToken(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }

  private inviteLink(token: string) {
    const base = (process.env.WEB_APP_URL || 'http://localhost:3000').replace(/\/$/, '');
    return `${base}/invite/${token}`;
  }

  private parseContact(contact: string): { email?: string; phone?: string } {
    const value = (contact || '').trim();
    if (/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value)) return { email: value.toLowerCase() };
    const phone = value.replace(/[\s-]/g, '');
    if (/^\+?\d{7,15}$/.test(phone)) return { phone };
    throw new BadRequestException('Enter a valid email address or phone number');
  }

  private async dispatchInvite(invite: any, token: string, companyName: string) {
    const link = this.inviteLink(token);
    const roleLabel = String(invite.role).replace(/_/g, ' ');
    try {
      if (invite.phone && this.smsProvider) {
        await this.smsProvider.send({
          to: invite.phone,
          message: `+Motive: ${companyName} invited you to join as ${roleLabel}. Set up your account here: ${link} (expires in 7 days)`,
        });
      }
      if (invite.email) {
        // No SMTP provider is configured yet; the admin also gets the
        // link in the API response so it can be shared directly.
        this.logger.log(`[InviteEmail] To: ${invite.email} | ${companyName} invited you as ${roleLabel}: ${link}`);
      }
    } catch (err) {
      this.logger.warn(`Invite delivery failed for invite ${invite.id}: ${(err as Error).message}`);
    }
    return link;
  }

  private safeInvite(invite: any) {
    return {
      id: invite.id, companyId: invite.companyId,
      email: invite.email, phone: invite.phone,
      role: invite.role, title: invite.title,
      status: invite.status, expiresAt: invite.expiresAt, createdAt: invite.createdAt,
    };
  }

  async createInvite(companyId: string, requesterId: string, requesterRole: string, dto: { contact: string; role: UserRole; title?: string }) {
    this.assertValidMemberRole(dto.role);
    const company = await this.prisma.company.findUnique({ where: { id: companyId } });
    if (!company) throw new NotFoundException('Company not found');
    await this.assertCompanyAdmin(companyId, requesterId, requesterRole);
    const { email, phone } = this.parseContact(dto.contact);

    // Already registered? Add them straight to the company.
    const existingUser = await this.prisma.user.findFirst({
      where: {
        deletedAt: null,
        OR: [
          ...(email ? [{ email: { equals: email, mode: 'insensitive' as const } }] : []),
          ...(phone ? [{ phone }] : []),
        ],
      },
    });
    if (existingUser) {
      if (existingUser.email) {
        const member = await this.addMember(companyId, requesterId, requesterRole, {
          email: existingUser.email, role: dto.role, title: dto.title,
        });
        return { status: 'added', member };
      }
      // Phone-only account: join directly by user id.
      const existing = await this.prisma.companyMember.findUnique({
        where: { companyId_userId: { companyId, userId: existingUser.id } },
      });
      if (existing?.isActive) throw new ConflictException('This user is already an active member of the company');
      const member = existing
        ? await this.prisma.companyMember.update({ where: { id: existing.id }, data: { role: dto.role, title: dto.title, isActive: true, leftAt: null }, include: MEMBER_INCLUDE })
        : await this.prisma.companyMember.create({ data: { companyId, userId: existingUser.id, role: dto.role, title: dto.title }, include: MEMBER_INCLUDE });
      await this.syncUserRole(existingUser, dto.role, companyId, requesterId);
      return { status: 'added', member };
    }

    // Reuse a pending invite for the same contact (rotates the token).
    const pending = await this.prisma.companyInvite.findFirst({
      where: { companyId, status: 'PENDING', ...(email ? { email } : { phone }) },
    });
    const token = randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const invite = pending
      ? await this.prisma.companyInvite.update({
          where: { id: pending.id },
          data: { role: dto.role, title: dto.title, tokenHash: this.hashToken(token), expiresAt, invitedBy: requesterId },
        })
      : await this.prisma.companyInvite.create({
          data: { companyId, email, phone, role: dto.role, title: dto.title, tokenHash: this.hashToken(token), invitedBy: requesterId, expiresAt },
        });

    const inviteLink = await this.dispatchInvite(invite, token, company.name);
    return { status: 'invited', invite: this.safeInvite(invite), inviteLink };
  }

  async listInvites(companyId: string, requesterId: string, requesterRole: string) {
    const company = await this.prisma.company.findUnique({ where: { id: companyId } });
    if (!company) throw new NotFoundException('Company not found');
    await this.assertCompanyAdmin(companyId, requesterId, requesterRole);
    const invites = await this.prisma.companyInvite.findMany({
      where: { companyId }, orderBy: { createdAt: 'desc' }, take: 100,
    });
    return { invites: invites.map((i: any) => this.safeInvite(i)) };
  }

  async resendInvite(companyId: string, inviteId: string, requesterId: string, requesterRole: string) {
    await this.assertCompanyAdmin(companyId, requesterId, requesterRole);
    const invite = await this.prisma.companyInvite.findUnique({ where: { id: inviteId }, include: { company: true } });
    if (!invite || invite.companyId !== companyId) throw new NotFoundException('Invite not found');
    if (invite.status !== 'PENDING') throw new BadRequestException('Only pending invites can be resent');
    const token = randomBytes(32).toString('base64url');
    const updated = await this.prisma.companyInvite.update({
      where: { id: inviteId },
      data: { tokenHash: this.hashToken(token), expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) },
    });
    const inviteLink = await this.dispatchInvite(updated, token, (invite as any).company.name);
    return { status: 'invited', invite: this.safeInvite(updated), inviteLink };
  }

  async revokeInvite(companyId: string, inviteId: string, requesterId: string, requesterRole: string) {
    await this.assertCompanyAdmin(companyId, requesterId, requesterRole);
    const invite = await this.prisma.companyInvite.findUnique({ where: { id: inviteId } });
    if (!invite || invite.companyId !== companyId) throw new NotFoundException('Invite not found');
    const updated = await this.prisma.companyInvite.update({ where: { id: inviteId }, data: { status: 'REVOKED' as any } });
    return this.safeInvite(updated);
  }

  private async getValidInvite(token: string) {
    if (!token) throw new BadRequestException('Invite token is required');
    const invite = await this.prisma.companyInvite.findUnique({
      where: { tokenHash: this.hashToken(token) },
      include: { company: { select: { id: true, name: true, type: true } } },
    });
    if (!invite) throw new NotFoundException('Invitation not found');
    if (invite.status === 'REVOKED') throw new BadRequestException('This invitation has been revoked. Ask the company to send a new one.');
    if (invite.status === 'ACCEPTED') throw new BadRequestException('This invitation has already been used. Please sign in.');
    if (invite.status === 'PENDING' && invite.expiresAt < new Date()) {
      await this.prisma.companyInvite.update({ where: { id: invite.id }, data: { status: 'EXPIRED' as any } });
      throw new BadRequestException('This invitation has expired. Ask the company to send a new one.');
    }
    return invite;
  }

  async resolveInvite(token: string) {
    const invite: any = await this.getValidInvite(token);
    return {
      company: invite.company,
      role: invite.role,
      title: invite.title,
      email: invite.email,
      phone: invite.phone,
      expiresAt: invite.expiresAt,
    };
  }

  async acceptInvite(token: string, dto: { firstName: string; lastName: string; password: string; email?: string; phone?: string }) {
    const invite: any = await this.getValidInvite(token);
    if (!dto.password || dto.password.length < 8) throw new BadRequestException('Password must be at least 8 characters');

    const email = invite.email || dto.email?.trim().toLowerCase() || undefined;
    const phone = invite.phone || dto.phone?.trim() || undefined;
    if (!email && !phone) throw new BadRequestException('An email address or phone number is required');

    const clash = await this.prisma.user.findFirst({
      where: {
        deletedAt: null,
        OR: [
          ...(email ? [{ email: { equals: email, mode: 'insensitive' as const } }] : []),
          ...(phone ? [{ phone }] : []),
        ],
      },
    });
    if (clash) {
      throw new ConflictException('An account with this email/phone already exists. Sign in, then ask the company admin to add your account from Team.');
    }

    const roleRecord = await this.prisma.role.findUnique({ where: { name: invite.role } });
    if (!roleRecord) throw new BadRequestException(`Invalid role: ${invite.role}`);

    const user = await this.prisma.user.create({
      data: {
        email, phone,
        firstName: dto.firstName.trim(),
        lastName: dto.lastName.trim(),
        passwordHash: await bcrypt.hash(dto.password, 12),
        primaryRole: invite.role,
        status: 'ACTIVE' as any,
        roles: { create: { roleId: roleRecord.id } },
      },
    });

    const member = await this.prisma.companyMember.create({
      data: { companyId: invite.companyId, userId: user.id, role: invite.role, title: invite.title },
      include: MEMBER_INCLUDE,
    });
    await this.syncUserRole(user, invite.role, invite.companyId, invite.invitedBy);
    await this.prisma.companyInvite.update({
      where: { id: invite.id },
      data: { status: 'ACCEPTED' as any, acceptedUserId: user.id, acceptedAt: new Date() },
    });

    return {
      user: { id: user.id, email: user.email, phone: user.phone, firstName: user.firstName, lastName: user.lastName, primaryRole: user.primaryRole },
      company: invite.company,
      role: invite.role,
      member,
    };
  }
}
