import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { createHash } from 'crypto';
import { CreateContractDto } from './dto/create-contract.dto';
import { AuditAction, ContractStatus, ContractType, UserRole } from '@prisma/client';

@Injectable()
export class ContractsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  private generateContractNumber(): string {
    const ts = Date.now().toString(36).toUpperCase();
    const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `CNT-${ts}-${rand}`;
  }

  // ── Create ─────────────────────────────────────────────────
  async create(userId: string, dto: CreateContractDto) {
    // Resolve the creator's profile
    const creator = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, primaryRole: true },
    });
    if (!creator) throw new NotFoundException('User not found');

    // Validate vehicle if provided
    if (dto.vehicleId) {
      const vehicle = await this.prisma.vehicle.findUnique({ where: { id: dto.vehicleId } });
      if (!vehicle) throw new NotFoundException('Vehicle not found');
    }

    // Validate Work & Pay type has work-and-pay terms
    if (dto.type === ContractType.WORK_AND_PAY && !dto.workAndPayTerms) {
      throw new BadRequestException('Work & Pay terms are required for this contract type');
    }
    if (dto.type === ContractType.RENTAL && !dto.rentalTerms) {
      throw new BadRequestException('Rental terms are required for this contract type');
    }
    if (dto.type === ContractType.DRIVING_ON && !dto.drivingOnTerms) {
      throw new BadRequestException('Driving On terms are required for this contract type');
    }

    const contract = await this.prisma.$transaction(async (tx) => {
      // Build operating model for vehicle update
      const operatingModelMap: Record<string, any> = {
        [ContractType.WORK_AND_PAY]: 'WORK_AND_PAY',
        [ContractType.RENTAL]: 'RENTAL',
        [ContractType.DRIVING_ON]: 'DRIVING_ON',
      };

      const newContract = await tx.contract.create({
        data: {
          contractNumber: this.generateContractNumber(),
          type: dto.type,
          vehicleId: dto.vehicleId,
          title: dto.title,
          description: dto.description,
          startDate: dto.startDate ? new Date(dto.startDate) : undefined,
          endDate: dto.endDate ? new Date(dto.endDate) : undefined,
          responsibilityMatrix: dto.responsibilityMatrix,
          createdBy: userId,
          status: ContractStatus.DRAFT,
          // Creator is always a party
          parties: {
            create: [
              { userId, role: creator.primaryRole },
              ...(dto.parties || []).map((p) => ({
                userId: p.userId,
                driverId: p.driverId,
                companyId: p.companyId,
                role: p.role,
              })),
            ],
          },
        },
      });

      // Create type-specific terms
      if (dto.workAndPayTerms) {
        const t = dto.workAndPayTerms;
        await tx.workAndPayTerms.create({
          data: {
            contractId: newContract.id,
            vehicleValue: t.vehicleValue,
            depositAmount: t.depositAmount,
            totalPayable: t.totalPayable,
            installmentAmount: t.installmentAmount,
            installmentFrequency: t.installmentFrequency,
            totalInstallments: t.totalInstallments,
            remainingBalance: t.totalPayable,
            latePenaltyRate: t.latePenaltyRate,
            gracePeriodDays: t.gracePeriodDays ?? 3,
            currency: 'GHS',
          },
        });

        // Generate payment schedule
        await this.generateInstallmentSchedule(tx, newContract.id, t);
      }

      if (dto.rentalTerms) {
        const t = dto.rentalTerms;
        await tx.rentalTerms.create({
          data: {
            contractId: newContract.id,
            salaryAmount: t.salaryAmount,
            revenueSharePercent: t.revenueSharePercent,
            paymentFrequency: t.paymentFrequency,
            driverPaysInsurance: t.driverPaysInsurance ?? false,
            driverPaysMaintenance: t.driverPaysMaintenance ?? false,
            driverPaysFuel: t.driverPaysFuel ?? true,
            currency: 'GHS',
          },
        });
      }

      if (dto.drivingOnTerms) {
        const t = dto.drivingOnTerms;
        await tx.drivingOnTerms.create({
          data: {
            contractId: newContract.id,
            dailySalesAmount: t.dailySalesAmount,
            paymentFrequency: t.paymentFrequency,
            driverPaysInsurance: t.driverPaysInsurance ?? false,
            driverPaysMaintenance: t.driverPaysMaintenance ?? false,
            driverPaysFuel: t.driverPaysFuel ?? true,
            currency: 'GHS',
          },
        });
      }

      return newContract;
    });

    await this.audit.log({
      actorId: userId,
      action: AuditAction.CONTRACT_CREATE,
      resource: 'contract',
      resourceId: contract.id,
      newData: { type: dto.type, status: ContractStatus.DRAFT },
    });

    return this.findById(contract.id, userId, creator.primaryRole);
  }

  // ── Payment schedule generation (Work & Pay) ──────────────
  private async generateInstallmentSchedule(tx: any, contractId: string, terms: any) {
    // Create a PaymentObligation for installments
    const obligation = await tx.paymentObligation.create({
      data: {
        contractId,
        type: 'INSTALLMENT',
        amount: terms.totalPayable,
        currency: 'GHS',
      },
    });

    const schedules = [];
    const now = new Date();
    const freqDays = terms.installmentFrequency === 'DAILY' ? 1
      : terms.installmentFrequency === 'WEEKLY' ? 7 : 30;

    for (let i = 1; i <= terms.totalInstallments; i++) {
      const dueDate = new Date(now.getTime() + i * freqDays * 24 * 60 * 60 * 1000);
      schedules.push({
        contractId,
        paymentObligationId: obligation.id,
        installmentNumber: i,
        amount: terms.installmentAmount,
        currency: 'GHS',
        dueDate,
      });
    }

    await tx.paymentSchedule.createMany({ data: schedules });
  }

  // ── Accept / Sign ──────────────────────────────────────────
  async acceptContract(contractId: string, userId: string, viaAccessCode = false) {
    const contract = await this.prisma.contract.findUnique({
      where: { id: contractId },
      include: { parties: true },
    });
    if (!contract) throw new NotFoundException('Contract not found');
    if (contract.status !== ContractStatus.DRAFT && contract.status !== ContractStatus.PENDING_SIGNATURES) {
      throw new BadRequestException('Contract is not pending acceptance');
    }

    // Must be a party
    const party = contract.parties.find((p) => p.userId === userId);
    if (!party) throw new ForbiddenException('You are not a party to this contract');
    if (party.signedAt) throw new ConflictException('You have already accepted this contract');

    // Contracts issued through Explore are confirmed with the owner's
    // one-driver access code, not the plain accept button.
    const activeCode = viaAccessCode ? null : await this.prisma.contractAccessCode.findFirst({
      where: { contractId, driverUserId: userId, status: 'ACTIVE' },
    });
    if (activeCode) {
      throw new BadRequestException('This contract is confirmed with the access code the owner sent you in chat. Enter the code to confirm your contract.');
    }

    await this.prisma.$transaction(async (tx) => {
      // Record signature
      await tx.contractParty.update({
        where: { id: party.id },
        data: { signedAt: new Date() },
      });

      // Check if all parties have signed
      const allParties = await tx.contractParty.findMany({ where: { contractId } });
      const allSigned = allParties.every((p) => p.signedAt !== null);

      if (allSigned) {
        await tx.contract.update({
          where: { id: contractId },
          data: { status: ContractStatus.ACTIVE },
        });

        // Set vehicle operating model
        if (contract.vehicleId) {
          const modelMap: Record<string, any> = {
            WORK_AND_PAY: 'WORK_AND_PAY',
            RENTAL: 'RENTAL',
            DRIVING_ON: 'DRIVING_ON',
          };
          await tx.vehicle.update({
            where: { id: contract.vehicleId },
            data: { operatingModel: modelMap[contract.type] ?? null },
          });
        }
      } else {
        await tx.contract.update({
          where: { id: contractId },
          data: { status: ContractStatus.PENDING_SIGNATURES },
        });
      }
    });

    await this.audit.log({
      actorId: userId,
      action: AuditAction.CONTRACT_ACCEPT,
      resource: 'contract',
      resourceId: contractId,
    });

    return this.findById(contractId, userId, 'ANY');
  }

  // ── Confirm with Explore access code ───────────────────────
  // The driver confirms (signs) the contract by entering the unique code
  // the owner generated for them. Only a driver whose Explore interest was
  // approved, and who was issued a code, can do this.
  async confirmWithCode(contractId: string, userId: string, code: string) {
    const contract = await this.prisma.contract.findUnique({
      where: { id: contractId },
      include: { parties: true },
    });
    if (!contract) throw new NotFoundException('Contract not found');
    if (!contract.vehicleId) throw new BadRequestException('This contract is not linked to a vehicle');

    const party = contract.parties.find((p) => p.userId === userId && p.role === UserRole.DRIVER);
    if (!party) throw new ForbiddenException('Only the driver this contract was issued to can confirm it with a code');
    if (party.signedAt) throw new ConflictException('You have already confirmed this contract');

    const interest = await this.prisma.vehicleInterest.findFirst({
      where: { vehicleId: contract.vehicleId, driverUserId: userId, status: 'APPROVED' },
    });
    if (!interest) {
      throw new ForbiddenException('Your interest in this vehicle has not been approved by the owner');
    }

    const record = await this.prisma.contractAccessCode.findFirst({
      where: { contractId, driverUserId: userId, status: 'ACTIVE' },
      orderBy: { createdAt: 'desc' },
    });
    if (!record) {
      throw new BadRequestException('No access code has been generated for you yet. Ask the owner to generate your code in Contracts and send it in chat.');
    }
    const given = createHash('sha256').update(String(code || '').trim()).digest('hex');
    if (given !== record.codeHash) {
      throw new BadRequestException('That code is not correct. Check the code the owner sent you in chat and try again.');
    }

    await this.prisma.contractAccessCode.update({
      where: { id: record.id },
      data: { status: 'USED', usedAt: new Date() },
    });
    // Code accepted — sign exactly like a normal acceptance.
    return this.acceptContract(contractId, userId, true);
  }

  // ── Terminate ──────────────────────────────────────────────
  async terminateContract(contractId: string, userId: string, reason: string) {
    const contract = await this.prisma.contract.findUnique({
      where: { id: contractId },
      include: { parties: true },
    });
    if (!contract) throw new NotFoundException('Contract not found');

    const isAdmin = await this.isAdmin(userId);
    const isParty = contract.parties.some((p) => p.userId === userId);
    if (!isAdmin && !isParty) throw new ForbiddenException('Access denied');

    if (([ContractStatus.TERMINATED, ContractStatus.COMPLETED, ContractStatus.EXPIRED] as ContractStatus[]).includes(contract.status)) {
      throw new BadRequestException('Contract is already closed');
    }

    await this.prisma.contract.update({
      where: { id: contractId },
      data: { status: ContractStatus.TERMINATED },
    });

    await this.audit.log({
      actorId: userId,
      action: AuditAction.CONTRACT_TERMINATE,
      resource: 'contract',
      resourceId: contractId,
      newData: { reason },
    });

    return this.findById(contractId, userId, 'ANY');
  }

  // ── List ───────────────────────────────────────────────────
  async findAll(params: {
    page?: number;
    limit?: number;
    status?: string;
    type?: string;
    vehicleId?: string;
    userId: string;
    userRole: string;
  }) {
    const { page = 1, limit = 20, status, type, vehicleId, userId, userRole } = params;
    const skip = (Math.max(1, Math.floor(Number(page)) || 1) - 1) * (Math.max(1, Math.floor(Number(limit)) || 20));
    const where: any = {};

    if (status) where.status = status;
    if (type) where.type = type;
    if (vehicleId) where.vehicleId = vehicleId;

    // Oversight roles (platform admin + legal) monitor all contracts;
    // everyone else sees only contracts they are party to.
    const adminRoles: UserRole[] = [UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.LEGAL_PROFESSIONAL];
    if (!adminRoles.includes(userRole as UserRole)) {
      where.parties = { some: { userId } };
    }

    const [contracts, total] = await this.prisma.$transaction([
      this.prisma.contract.findMany({
        where, skip, take: Math.max(1, Math.floor(Number(limit)) || 20),
        orderBy: { createdAt: 'desc' },
        include: {
          vehicle: { select: { id: true, registrationNumber: true, make: true, model: true, year: true } },
          parties: { select: { id: true, userId: true, driverId: true, companyId: true, role: true, signedAt: true } },
          workAndPayTerms: true,
          rentalTerms: true,
          drivingOnTerms: true,
        },
      }),
      this.prisma.contract.count({ where }),
    ]);

    if (userRole === UserRole.DRIVER && contracts.length > 0) {
      const codes = await this.prisma.contractAccessCode.findMany({
        where: { contractId: { in: contracts.map((c) => c.id) }, driverUserId: userId, status: 'ACTIVE' },
        select: { contractId: true },
      });
      const coded = new Set(codes.map((c) => c.contractId));
      for (const c of contracts as any[]) {
        const mine = c.parties?.find((p: any) => p.userId === userId);
        c.requiresCode = coded.has(c.id) && !mine?.signedAt;
      }
    }

    return { contracts, pagination: { total, page, limit, totalPages: Math.ceil(total / (Math.max(1, Math.floor(Number(limit)) || 20))) } };
  }

  // ── Get by ID ──────────────────────────────────────────────
  async findById(contractId: string, userId: string, userRole: string) {
    const contract = await this.prisma.contract.findUnique({
      where: { id: contractId },
      include: {
        vehicle: {
          select: { id: true, registrationNumber: true, make: true, model: true, year: true, status: true },
        },
        parties: {
          select: { id: true, userId: true, driverId: true, companyId: true, role: true, signedAt: true },
        },
        workAndPayTerms: true,
        rentalTerms: true,
        drivingOnTerms: true,
        paymentObligations: {
          include: { schedules: { orderBy: { installmentNumber: 'asc' }, take: 5 } },
        },
      },
    });

    if (!contract) throw new NotFoundException('Contract not found');

    // Resource-level auth: oversight roles may open any contract;
    // everyone else must be a party.
    const adminRoles: UserRole[] = [UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.LEGAL_PROFESSIONAL];
    if (!adminRoles.includes(userRole as UserRole) && userRole !== 'ANY') {
      const isParty = contract.parties.some((p) => p.userId === userId);
      if (!isParty) throw new ForbiddenException('Access denied to this contract');
    }

    if (userRole === UserRole.DRIVER) {
      const mine = contract.parties.find((p) => p.userId === userId);
      const active = await this.prisma.contractAccessCode.findFirst({
        where: { contractId, driverUserId: userId, status: 'ACTIVE' },
      });
      (contract as any).requiresCode = !!active && !mine?.signedAt;
    }

    return contract;
  }

  // ── Legal/admin status management (review, suspend, …) ─────
  async updateStatus(contractId: string, userId: string, userRole: string, status: string) {
    const oversight: UserRole[] = [UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.LEGAL_PROFESSIONAL];
    if (!oversight.includes(userRole as UserRole)) {
      throw new ForbiddenException('Only legal or platform admin can change contract status');
    }
    const valid = Object.values(ContractStatus) as string[];
    if (!valid.includes(status)) throw new BadRequestException(`Invalid contract status: ${status}`);

    const contract = await this.prisma.contract.findUnique({ where: { id: contractId } });
    if (!contract) throw new NotFoundException('Contract not found');

    await this.prisma.contract.update({ where: { id: contractId }, data: { status: status as ContractStatus } });
    await this.audit.log({
      actorId: userId, action: AuditAction.UPDATE, resource: 'contract', resourceId: contractId,
      previousData: { status: contract.status }, newData: { status },
    });
    return this.findById(contractId, userId, 'ANY');
  }

  // ── Payment schedule ───────────────────────────────────────
  async getPaymentSchedule(contractId: string, userId: string, userRole: string) {
    await this.findById(contractId, userId, userRole); // auth check

    const schedules = await this.prisma.paymentSchedule.findMany({
      where: { contractId },
      orderBy: { installmentNumber: 'asc' },
    });

    return schedules;
  }

  // ── Helpers ────────────────────────────────────────────────
  private async isAdmin(userId: string): Promise<boolean> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { primaryRole: true },
    });
    return user?.primaryRole === UserRole.ADMIN
      || user?.primaryRole === UserRole.SUPER_ADMIN
      || user?.primaryRole === UserRole.LEGAL_PROFESSIONAL;
  }
}
