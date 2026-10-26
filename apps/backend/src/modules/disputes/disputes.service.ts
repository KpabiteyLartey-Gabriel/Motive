import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { AuditAction, DisputeStatus, UserRole } from '@prisma/client';
import { CreateDisputeDto, AddDisputeMessageDto, ResolveDisputeDto } from './dto/dispute.dto';

@Injectable()
export class DisputesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  private generateDisputeNumber(): string {
    const ts = Date.now().toString(36).toUpperCase();
    const rand = Math.random().toString(36).substring(2, 5).toUpperCase();
    return `DSP-${ts}-${rand}`;
  }

  // ── Create ─────────────────────────────────────────────────
  async create(userId: string, dto: CreateDisputeDto) {
    const dispute = await this.prisma.$transaction(async (tx) => {
      const newDispute = await tx.dispute.create({
        data: {
          disputeNumber: this.generateDisputeNumber(),
          contractId: dto.contractId,
          vehicleId: dto.vehicleId,
          filedBy: userId,
          type: dto.type,
          subject: dto.subject,
          description: dto.description,
          priority: dto.priority ?? 'NORMAL',
          status: DisputeStatus.OPEN,
          // Filer is always a COMPLAINANT party
          parties: {
            create: [
              { userId, role: 'COMPLAINANT' },
              ...(dto.respondentIds || []).map((id) => ({ userId: id, role: 'RESPONDENT' })),
            ],
          },
        },
      });

      return newDispute;
    });

    await this.audit.log({
      actorId: userId,
      action: AuditAction.DISPUTE_CREATE,
      resource: 'dispute',
      resourceId: dispute.id,
      newData: { type: dto.type, subject: dto.subject },
    });

    return this.findById(dispute.id, userId, 'ANY');
  }

  // ── List ───────────────────────────────────────────────────
  async findAll(params: {
    page?: number;
    limit?: number;
    status?: string;
    type?: string;
    userId: string;
    userRole: string;
  }) {
    const { page = 1, limit = 20, status, type, userId, userRole } = params;
    const skip = (Math.max(1, Math.floor(Number(page)) || 1) - 1) * (Math.max(1, Math.floor(Number(limit)) || 20));
    const where: any = {};

    if (status) where.status = status;
    if (type) where.type = type;

    // Non-admins and non-legal see only their own disputes
    const privileged: UserRole[] = [UserRole.ADMIN, UserRole.SUPER_ADMIN];
    if (!privileged.includes(userRole as UserRole)) {
      where.parties = { some: { userId } };
    }

    const [disputes, total] = await this.prisma.$transaction([
      this.prisma.dispute.findMany({
        where, skip, take: Math.max(1, Math.floor(Number(limit)) || 20), orderBy: { createdAt: 'desc' },
        include: {
          parties: { select: { userId: true, role: true } },
          _count: { select: { messages: true, evidence: true } },
        },
      }),
      this.prisma.dispute.count({ where }),
    ]);

    return { disputes, pagination: { total, page, limit, totalPages: Math.ceil(total / (Math.max(1, Math.floor(Number(limit)) || 20))) } };
  }

  // ── Get by ID ──────────────────────────────────────────────
  async findById(disputeId: string, userId: string, userRole: string) {
    const dispute = await this.prisma.dispute.findUnique({
      where: { id: disputeId },
      include: {
        parties: true,
        messages: { orderBy: { createdAt: 'asc' } },
        evidence: { orderBy: { uploadedAt: 'desc' } },
      },
    });
    if (!dispute) throw new NotFoundException('Dispute not found');

    const privileged = [UserRole.ADMIN, UserRole.SUPER_ADMIN, 'ANY'];
    if (!privileged.includes(userRole as any)) {
      const isParty = dispute.parties.some((p) => p.userId === userId);
      if (!isParty) throw new ForbiddenException('Access denied to this dispute');
    }

    return dispute;
  }

  // ── Add message ────────────────────────────────────────────
  async addMessage(disputeId: string, userId: string, dto: AddDisputeMessageDto, userRole: string) {
    await this.findById(disputeId, userId, userRole); // auth check

    // Only admins/legal can post internal notes
    if (dto.isInternal) {
      const privileged: UserRole[] = [UserRole.ADMIN, UserRole.SUPER_ADMIN];
      if (!privileged.includes(userRole as UserRole)) {
        throw new ForbiddenException('Only admin users can post internal notes');
      }
    }

    return this.prisma.disputeMessage.create({
      data: {
        disputeId,
        authorId: userId,
        message: dto.message,
        isInternal: dto.isInternal ?? false,
      },
    });
  }

  // ── Assign ─────────────────────────────────────────────────
  async assign(disputeId: string, assigneeId: string, actorId: string) {
    const dispute = await this.prisma.dispute.findUnique({ where: { id: disputeId } });
    if (!dispute) throw new NotFoundException('Dispute not found');

    await this.prisma.$transaction(async (tx) => {
      await tx.dispute.update({
        where: { id: disputeId },
        data: {
          assignedTo: assigneeId,
          status: DisputeStatus.UNDER_REVIEW,
        },
      });

      // Add assignee as MEDIATOR party if not already
      const existing = await tx.disputeParty.findFirst({
        where: { disputeId, userId: assigneeId },
      });
      if (!existing) {
        await tx.disputeParty.create({
          data: { disputeId, userId: assigneeId, role: 'MEDIATOR' },
        });
      }
    });

    return this.findById(disputeId, actorId, 'ANY');
  }

  // ── Resolve ────────────────────────────────────────────────
  async resolve(disputeId: string, userId: string, dto: ResolveDisputeDto, userRole: string) {
    const privileged: UserRole[] = [UserRole.ADMIN, UserRole.SUPER_ADMIN];
    if (!privileged.includes(userRole as UserRole)) {
      throw new ForbiddenException('Only admin users can resolve disputes');
    }

    const dispute = await this.prisma.dispute.findUnique({ where: { id: disputeId } });
    if (!dispute) throw new NotFoundException('Dispute not found');
    if (dispute.status === DisputeStatus.RESOLVED || dispute.status === DisputeStatus.CLOSED) {
      throw new BadRequestException('Dispute is already resolved');
    }

    await this.prisma.dispute.update({
      where: { id: disputeId },
      data: {
        status: DisputeStatus.RESOLVED,
        resolution: dto.resolution,
        resolvedAt: new Date(),
      },
    });

    await this.audit.log({
      actorId: userId,
      action: AuditAction.DISPUTE_RESOLVE,
      resource: 'dispute',
      resourceId: disputeId,
      newData: { resolution: dto.resolution },
    });

    return this.findById(disputeId, userId, 'ANY');
  }
}
