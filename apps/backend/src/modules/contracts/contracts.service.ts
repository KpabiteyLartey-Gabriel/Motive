import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  ConflictException,
  Optional,
} from '@nestjs/common';
import { MessagingService } from '../messaging/messaging.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { createHash, randomInt } from 'crypto';
import { CreateContractDto } from './dto/create-contract.dto';
import { AuditAction, ContractStatus, ContractType, DriverStatus, NotificationChannel, UserRole } from '@prisma/client';

@Injectable()
export class ContractsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    @Optional() private readonly messaging?: MessagingService,
    @Optional() private readonly notifications?: NotificationsService,
  ) {}

  private generateContractNumber(): string {
    const ts = Date.now().toString(36).toUpperCase();
    const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `CNT-${ts}-${rand}`;
  }

  /**
   * The vehicle value is the owner's private purchase price, used only
   * for their own profit records. It is never sent to a driver: the
   * driver contracts on the total payable, not on what the owner paid.
   */
  private hideVehicleValueFromDriver(contract: any) {
    if (contract?.workAndPayTerms) {
      delete contract.workAndPayTerms.vehicleValue;
    }
    return contract;
  }

  /** The date `periods` payment periods after `from` for a frequency. */
  private addPeriods(from: Date, frequency: string, periods: number): Date {
    const d = new Date(from);
    if (frequency === 'DAILY') d.setDate(d.getDate() + periods);
    else if (frequency === 'MONTHLY') d.setMonth(d.getMonth() + periods);
    else d.setDate(d.getDate() + periods * 7); // WEEKLY
    return d;
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
          terms: dto.terms,
          createdBy: userId,
          status: ContractStatus.DRAFT,
          // Creator is always a party, and creating the contract is the
          // creator's agreement to its terms — so the creator is recorded
          // as signed at creation. The other parties still sign for
          // themselves (the driver, by entering the access code), and the
          // contract activates on that signing day.
          parties: {
            create: [
              { userId, role: creator.primaryRole, signedAt: new Date() },
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
            vehicleValue: t.vehicleValue ?? t.totalPayable,
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

    for (let i = 1; i <= terms.totalInstallments; i++) {
      // Provisional dates from creation; re-anchored to the signing day
      // when the contract is activated (see acceptContract).
      const dueDate = this.addPeriods(now, terms.installmentFrequency, i);
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

  // ── Driver activity ──────────────────────────────────────
  /**
   * A driver is ACTIVE only while currently on a live contract: flip the
   * profile VERIFIED → ACTIVE when a contract of theirs activates, and
   * back to VERIFIED when their last active contract ends. SUSPENDED and
   * INACTIVE are admin decisions and are never overridden here. This is a
   * derived status, so failures are best-effort and never fail the
   * contract operation itself.
   */
  private async refreshDriverActivity(driverUserId: string | null | undefined) {
    if (!driverUserId) return;
    const driver = await this.prisma.driver.findUnique({
      where: { userId: driverUserId },
      select: { id: true, status: true },
    });
    if (!driver) return;
    if (driver.status !== DriverStatus.VERIFIED && driver.status !== DriverStatus.ACTIVE) return;
    const activeCount = await this.prisma.contract.count({
      where: {
        status: ContractStatus.ACTIVE,
        parties: { some: { userId: driverUserId, role: UserRole.DRIVER } },
      },
    });
    const next = activeCount > 0 ? DriverStatus.ACTIVE : DriverStatus.VERIFIED;
    if (driver.status !== next) {
      await this.prisma.driver.update({ where: { id: driver.id }, data: { status: next } });
    }
  }

  private async refreshContractDrivers(contractId: string) {
    try {
      const parties = await this.prisma.contractParty.findMany({
        where: { contractId, role: UserRole.DRIVER },
        select: { userId: true },
      });
      for (const p of parties) {
        await this.refreshDriverActivity(p.userId);
      }
    } catch { /* derived status — best effort */ }
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

    // Signing re-anchors the whole payment schedule, which is several
    // writes; the pooled database can be slow, so this transaction gets
    // more than the default 5s interactive-transaction timeout.
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
        // The payment clock starts after the grace period, not on the
        // day the owner created the draft and not on the signing day
        // itself: the owner may create a contract days before the driver
        // confirms it, and the owner-set grace period (in days) runs
        // from the signing day. Counting — and the contract start date —
        // begins the day the grace period ends, the first payment is
        // due one payment period after that, and the contract ends on
        // the last due date. An explicitly agreed start date is kept.
        let wapTerms: any = null;
        if (tx.workAndPayTerms) {
          wapTerms = await tx.workAndPayTerms.findUnique({ where: { contractId } });
        }
        const graceDays = !contract.startDate && wapTerms ? Math.max(0, Math.round(Number(wapTerms.gracePeriodDays) || 0)) : 0;
        const startsAt = contract.startDate ? new Date(contract.startDate) : new Date(Date.now() + graceDays * 24 * 60 * 60 * 1000);
        let endsAt: Date | undefined = contract.endDate ? new Date(contract.endDate) : undefined;
        if (wapTerms && tx.paymentSchedule) {
          // Re-anchor every due date from the counting start. Long contracts
          // can have hundreds of installments; updating them one by one
          // inside this transaction timed out (30s) on real contracts and
          // rolled the whole acceptance back, so prefer one set-based UPDATE.
          if (typeof tx.$executeRawUnsafe === 'function') {
            const iso = startsAt.toISOString();
            if (wapTerms.installmentFrequency === 'MONTHLY') {
              await tx.$executeRawUnsafe(
                `UPDATE "payment_schedules" SET "dueDate" = ($1::timestamp + ("installmentNumber" * INTERVAL '1 month')), "updatedAt" = NOW() WHERE "contractId" = $2`,
                iso, contractId,
              );
            } else {
              const days = wapTerms.installmentFrequency === 'DAILY' ? 1 : 7;
              await tx.$executeRawUnsafe(
                `UPDATE "payment_schedules" SET "dueDate" = ($1::timestamp + ("installmentNumber" * $3::int * INTERVAL '1 day')), "updatedAt" = NOW() WHERE "contractId" = $2`,
                iso, contractId, days,
              );
            }
            const total = Math.round(Number(wapTerms.totalInstallments) || 0);
            if (total > 0) endsAt = this.addPeriods(startsAt, wapTerms.installmentFrequency, total);
          } else {
            const schedules = await tx.paymentSchedule.findMany({
              where: { contractId },
              orderBy: { installmentNumber: 'asc' },
            });
            await Promise.all(schedules.map((s) => tx.paymentSchedule.update({
              where: { id: s.id },
              data: { dueDate: this.addPeriods(startsAt, wapTerms.installmentFrequency, s.installmentNumber) },
            })));
            if (schedules.length > 0) {
              endsAt = this.addPeriods(startsAt, wapTerms.installmentFrequency, schedules[schedules.length - 1].installmentNumber);
            }
          }
        }
        // DriveOn / Rental: no installment schedule. The end (renewal)
        // date comes from the renewal date the driver set when signing,
        // else from the owner-set duration counted from the start.
        if (!endsAt) {
          const agreed: any = (contract as any).terms || {};
          if (agreed.renewalDate) {
            const d = new Date(agreed.renewalDate);
            if (!Number.isNaN(d.getTime())) endsAt = d;
          } else if (agreed.duration?.value) {
            const unit = String(agreed.duration.unit || 'MONTHS').toUpperCase();
            const freq = unit.startsWith('DAY') ? 'DAILY' : unit.startsWith('WEEK') ? 'WEEKLY' : 'MONTHLY';
            const periods = unit.startsWith('YEAR') ? Number(agreed.duration.value) * 12 : Number(agreed.duration.value);
            if (periods > 0) endsAt = this.addPeriods(startsAt, freq, periods);
          }
        }
        await tx.contract.update({
          where: { id: contractId },
          data: { status: ContractStatus.ACTIVE, startDate: startsAt, ...(endsAt ? { endDate: endsAt } : {}) },
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
    }, { timeout: 30000, maxWait: 15000 });

    await this.refreshContractDrivers(contractId);

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

    // Awarded contracts sign from a Driver account. If the person was
    // awarded before creating one, the code stays valid — they create the
    // account first, then come back and sign with the same code.
    if (typeof this.prisma.driver?.findUnique === 'function') {
      const driverProfile = await this.prisma.driver.findUnique({ where: { userId } });
      if (!driverProfile) {
        throw new BadRequestException('Create your Driver account first (My Account → Add Driver account), then enter this code again to sign. Your code stays valid.');
      }
      if (!party.driverId) {
        await this.prisma.contractParty.update({ where: { id: party.id }, data: { driverId: driverProfile.id } });
      }
    }

    const interest = await this.prisma.vehicleInterest.findFirst({
      where: { vehicleId: contract.vehicleId, driverUserId: userId, status: 'APPROVED' },
    });
    // Direct contracts (agreed physically, shared by chat username) have no
    // Explore interest — their shared contract thread is the approval record.
    const directThread = typeof this.prisma.chatThread?.findFirst === 'function'
      ? await this.prisma.chatThread.findFirst({ where: { contractId, driverUserId: userId, interestId: null } })
      : null;
    // A shared contract card in the pair's existing chat also proves the
    // direct share (the card carries the contractId, whichever thread the
    // conversation with this owner lives in).
    const directCard = !directThread && typeof this.prisma.chatMessage?.findFirst === 'function'
      ? await this.prisma.chatMessage.findFirst({ where: { contractId, kind: 'CONTRACT' } })
      : null;
    if (!interest && !directThread && !directCard) {
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

    // Sign first, burn the code only after signing succeeds. Burning it
    // first meant any failure in acceptance (e.g. the old 30s schedule
    // timeout) consumed the driver's only code and then told them no code
    // had been generated when they retried.
    const signed = await this.acceptContract(contractId, userId, true);
    try {
      await this.prisma.contractAccessCode.update({
        where: { id: record.id },
        data: { status: 'USED', usedAt: new Date() },
      });
    } catch { /* contract is signed; a stale ACTIVE code is harmless */ }
    return signed;
  }

  // ── Share a direct contract with a driver by chat username ──
  /**
   * The Work & Pay door: terms were agreed physically, the owner drafted the
   * contract in-app, and now shares it to one driver found by chat username.
   * Adds the driver as a party, opens (or reuses) the contract chat thread,
   * posts a contract card there, and issues the one-driver confirmation code
   * (returned once to the owner, who sends it in chat). The driver confirms
   * with that code — see confirmWithCode.
   */
  async shareContract(contractId: string, ownerUserId: string, rawUsername: string) {
    const chatUsername = String(rawUsername || '').trim().replace(/^@+/, '').toLowerCase();
    if (!chatUsername) throw new BadRequestException('Enter the driver\'s chat username.');
    const contract = await this.prisma.contract.findUnique({
      where: { id: contractId },
      include: { parties: true, vehicle: true, workAndPayTerms: true, drivingOnTerms: true },
    });
    if (!contract) throw new NotFoundException('Contract not found');
    if (contract.status !== ContractStatus.DRAFT && contract.status !== ContractStatus.PENDING_SIGNATURES) {
      throw new BadRequestException('Only a draft contract can be shared with a driver.');
    }
    const isOwnerSide = contract.createdBy === ownerUserId
      || contract.parties.some((p) => p.userId === ownerUserId && p.role !== UserRole.DRIVER);
    if (!isOwnerSide) throw new ForbiddenException('Only the owner side can share this contract');
    if (!contract.vehicleId || !contract.vehicle) {
      throw new BadRequestException('This contract has no vehicle. Add the vehicle first, then share the contract.');
    }

    const driverUser = await this.prisma.user.findUnique({
      where: { chatUsername },
      select: { id: true, firstName: true, lastName: true, chatUsername: true, email: true },
    });
    if (!driverUser) {
      throw new NotFoundException(`No user found with username @${chatUsername}. Ask the driver for their exact chat username.`);
    }
    if (driverUser.id === ownerUserId) throw new BadRequestException('You cannot share a contract with yourself.');
    const driver = await this.prisma.driver.findUnique({ where: { userId: driverUser.id } });
    if (!driver) {
      throw new BadRequestException(`@${chatUsername} does not have a Driver account yet. Ask them to set up their Driver account, then share again.`);
    }

    const existingDriverParty = contract.parties.find((p) => p.role === UserRole.DRIVER && p.userId);
    if (existingDriverParty && existingDriverParty.userId !== driverUser.id) {
      throw new ConflictException('This contract is already shared with another driver.');
    }
    if (!existingDriverParty) {
      await this.prisma.contractParty.create({
        data: { contractId, userId: driverUser.id, driverId: driver.id, role: UserRole.DRIVER },
      });
    }

    // One person, one conversation: reuse the chat this pair already has —
    // their direct chat first, then any earlier thread between them (e.g.
    // from Explore) — and only open a new thread when they have never
    // chatted. The contract card is posted into that same conversation.
    const pairOr = [
      { ownerUserId, driverUserId: driverUser.id },
      { ownerUserId: driverUser.id, driverUserId: ownerUserId },
    ];
    let thread = await this.prisma.chatThread.findFirst({
      where: { interestId: null, contractId: null, OR: pairOr },
      orderBy: { createdAt: 'asc' },
    });
    if (!thread) {
      thread = await this.prisma.chatThread.findFirst({
        where: { OR: pairOr },
        orderBy: { createdAt: 'asc' },
      });
    }
    if (!thread) {
      thread = await this.prisma.chatThread.findFirst({
        where: { contractId, driverUserId: driverUser.id },
      });
    }
    if (!thread) {
      thread = await this.prisma.chatThread.create({
        data: {
          vehicleId: contract.vehicleId, interestId: null, contractId,
          ownerUserId, driverUserId: driverUser.id,
        },
      });
    }

    const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
    await this.prisma.contractAccessCode.updateMany({
      where: { contractId, status: 'ACTIVE' },
      data: { status: 'REVOKED' },
    });
    await this.prisma.contractAccessCode.create({
      data: {
        contractId, vehicleId: contract.vehicleId, driverUserId: driverUser.id,
        codeHash: createHash('sha256').update(code).digest('hex'), createdById: ownerUserId,
      },
    });

    const w: any = (contract as any).workAndPayTerms;
    const don: any = (contract as any).drivingOnTerms;
    const agreed: any = (contract as any).terms || {};
    const vehicleLabel = `${contract.vehicle.make} ${contract.vehicle.model} (${contract.vehicle.registrationNumber})`;
    const duration = agreed.duration?.value ? ` for ${agreed.duration.value} ${String(agreed.duration.unit || '').toLowerCase()}` : '';
    const money = w
      ? ` You pay GHS ${Number(w.depositAmount).toLocaleString('en-GH')} deposit, then GHS ${Number(w.installmentAmount).toLocaleString('en-GH')} every ${String(w.installmentFrequency || 'WEEKLY').toLowerCase()} for ${w.totalInstallments} payments — GHS ${Number(w.totalPayable).toLocaleString('en-GH')} in total. Grace period: ${w.gracePeriodDays ?? 0} days.`
      : don
        ? ` This is a DriveOn contract: you bring GHS ${Number(don.dailySalesAmount).toLocaleString('en-GH')} sales every day, paid ${String(don.paymentFrequency || 'DAILY').toLowerCase()}${duration}, and you keep everything above that. Grace period: ${agreed.gracePeriodDays ?? 0} days.`
        : '';
    const shareLink = `/driver/contracts?contract=${contractId}`;
    await this.prisma.chatMessage.create({
      data: {
        threadId: thread.id, senderUserId: ownerUserId, kind: 'CONTRACT', contractId,
        body: `I have drafted our contract for the ${vehicleLabel}.${money}\nOpen it here: ${shareLink}\nI will send your confirmation code in this chat — enter it on the contract to accept. +Motive records our agreement and processes payments; please confirm in person that you have seen the vehicle and its documents before accepting.`,
      },
    });
    await this.prisma.chatThread.update({
      where: { id: thread.id },
      data: { lastMessageAt: new Date(), ...((thread as any).contractId ? {} : { contractId }) },
    });
    try {
      await this.prisma.notification.create({
        data: {
          userId: driverUser.id, channel: 'IN_APP', type: 'CONTRACT_SHARED', status: 'SENT', sentAt: new Date(),
          subject: 'A contract was shared with you',
          body: `A contract for the ${vehicleLabel} was shared with you in chat. Open it, check the terms, and confirm with the code the owner sends you.`,
          data: { contractId, threadId: thread.id, vehicleId: contract.vehicleId },
        },
      });
    } catch { /* notifications are best effort */ }

    // Email as well as the in-app notification (best effort, like notifications).
    let emailSent = false;
    if (this.messaging && (driverUser as any).email) {
      try {
        const appUrl = (process.env.APP_URL || 'http://localhost:3000').replace(/\/$/, '');
        const result = await this.messaging.sendEmail(
          (driverUser as any).email,
          'A contract was shared with you on +Motive',
          `Dear ${driverUser.firstName || 'Driver'},\n\nA contract for the ${vehicleLabel} has been shared with you on +Motive.${money}\n\nOpen your contract here: ${appUrl}${shareLink}\nThe owner will send your confirmation code in your chat — enter it on the contract to accept. Please only accept after you have seen the vehicle and confirmed its documents in person.\n\n+Motive records your agreement and processes your payments.`,
        );
        emailSent = !!result?.delivered;
      } catch { /* email is best effort */ }
    }

    return {
      contractId, threadId: thread.id, code, shareLink, emailSent, notified: true,
      driver: { id: driverUser.id, firstName: driverUser.firstName, lastName: driverUser.lastName, chatUsername: driverUser.chatUsername },
    };
  }

  // ── Attach a contract template to a vehicle ────────────────
  /**
   * Owner contracts are created as reusable templates (caption + financial
   * terms, no vehicle). Attaching binds one template to one of the owner's
   * vehicles; the vehicle can then be awarded with that contract.
   */
  async attachVehicle(contractId: string, ownerUserId: string, vehicleId: string) {
    const contract = await this.prisma.contract.findUnique({
      where: { id: contractId },
      include: { parties: true },
    });
    if (!contract) throw new NotFoundException('Contract not found');
    if (contract.createdBy !== ownerUserId) throw new ForbiddenException('Only the owner who created this contract can attach it to a vehicle');
    if (contract.status !== ContractStatus.DRAFT) throw new BadRequestException('Only a draft contract can be attached to a vehicle');
    if (contract.parties.some((p) => p.role === UserRole.DRIVER)) {
      throw new BadRequestException('This contract has already been awarded. Create a new contract to use with another vehicle.');
    }
    const vehicle = await this.prisma.vehicle.findUnique({ where: { id: vehicleId } });
    if (!vehicle) throw new NotFoundException('Vehicle not found');
    const owner = await this.prisma.owner.findUnique({ where: { userId: ownerUserId } });
    if (!owner || vehicle.ownerId !== owner.id) {
      throw new ForbiddenException('You can only attach contracts to your own vehicles');
    }
    const busy = await this.prisma.contract.findFirst({
      where: {
        vehicleId, id: { not: contractId },
        status: { in: [ContractStatus.ACTIVE, ContractStatus.PENDING_SIGNATURES] },
      },
    });
    if (busy) throw new ConflictException('This vehicle already has a contract in progress or active on it');

    const modelMap: Record<string, any> = { WORK_AND_PAY: 'WORK_AND_PAY', RENTAL: 'RENTAL', DRIVING_ON: 'DRIVING_ON' };
    await this.prisma.$transaction([
      this.prisma.contract.update({ where: { id: contractId }, data: { vehicleId } }),
      this.prisma.vehicle.update({ where: { id: vehicleId }, data: { operatingModel: modelMap[contract.type] ?? undefined } }),
    ]);
    return this.findById(contractId, ownerUserId, 'ANY');
  }

  // ── Award an attached contract to a driver ─────────────────
  /**
   * The owner searches a driver by chat username and awards the contract.
   * The signing code is sent straight to that person (SMS + email + in-app),
   * never through the owner. If they hold no Driver account yet, the award
   * still lands and tells them to create one first — confirmWithCode keeps
   * the code valid but refuses to sign until the Driver account exists.
   */
  async awardContract(contractId: string, ownerUserId: string, rawUsername: string) {
    const chatUsername = String(rawUsername || '').trim().replace(/^@+/, '').toLowerCase();
    if (!chatUsername) throw new BadRequestException('Enter the driver\'s chat username.');
    const contract = await this.prisma.contract.findUnique({
      where: { id: contractId },
      include: { parties: true, vehicle: true, workAndPayTerms: true, drivingOnTerms: true, rentalTerms: true },
    });
    if (!contract) throw new NotFoundException('Contract not found');
    if (contract.status !== ContractStatus.DRAFT && contract.status !== ContractStatus.PENDING_SIGNATURES) {
      throw new BadRequestException('Only a draft contract can be awarded.');
    }
    const isOwnerSide = contract.createdBy === ownerUserId
      || contract.parties.some((p) => p.userId === ownerUserId && p.role !== UserRole.DRIVER);
    if (!isOwnerSide) throw new ForbiddenException('Only the owner side can award this contract');
    if (!contract.vehicleId || !contract.vehicle) {
      throw new BadRequestException('Attach this contract to a vehicle first, then award it.');
    }

    const target = await this.prisma.user.findUnique({
      where: { chatUsername },
      select: { id: true, firstName: true, lastName: true, chatUsername: true, email: true, phone: true, profilePhotoUrl: true },
    });
    if (!target) {
      throw new NotFoundException(`No user found with username @${chatUsername}. Ask the driver for their exact chat username.`);
    }
    if (target.id === ownerUserId) throw new BadRequestException('You cannot award a contract to yourself.');
    const driver = await this.prisma.driver.findUnique({ where: { userId: target.id } });

    const existingDriverParty = contract.parties.find((p) => p.role === UserRole.DRIVER && p.userId);
    if (existingDriverParty && existingDriverParty.userId !== target.id) {
      throw new ConflictException('This contract is already awarded to another driver.');
    }
    if (!existingDriverParty) {
      await this.prisma.contractParty.create({
        data: { contractId, userId: target.id, driverId: driver?.id ?? null, role: UserRole.DRIVER },
      });
    } else if (driver && !existingDriverParty.driverId) {
      await this.prisma.contractParty.update({ where: { id: existingDriverParty.id }, data: { driverId: driver.id } });
    }
    await this.prisma.contract.update({ where: { id: contractId }, data: { status: ContractStatus.PENDING_SIGNATURES } });

    const pairOr = [
      { ownerUserId, driverUserId: target.id },
      { ownerUserId: target.id, driverUserId: ownerUserId },
    ];
    let thread = await this.prisma.chatThread.findFirst({
      where: { interestId: null, contractId: null, OR: pairOr },
      orderBy: { createdAt: 'asc' },
    });
    if (!thread) thread = await this.prisma.chatThread.findFirst({ where: { OR: pairOr }, orderBy: { createdAt: 'asc' } });
    if (!thread) thread = await this.prisma.chatThread.findFirst({ where: { contractId, driverUserId: target.id } });
    if (!thread) {
      thread = await this.prisma.chatThread.create({
        data: { vehicleId: contract.vehicleId, interestId: null, contractId, ownerUserId, driverUserId: target.id },
      });
    }

    const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
    await this.prisma.contractAccessCode.updateMany({
      where: { contractId, status: 'ACTIVE' },
      data: { status: 'REVOKED' },
    });
    await this.prisma.contractAccessCode.create({
      data: {
        contractId, vehicleId: contract.vehicleId, driverUserId: target.id,
        codeHash: createHash('sha256').update(code).digest('hex'), createdById: ownerUserId,
      },
    });

    const w: any = (contract as any).workAndPayTerms;
    const don: any = (contract as any).drivingOnTerms;
    const agreed: any = (contract as any).terms || {};
    const vehicleLabel = `${contract.vehicle.make} ${contract.vehicle.model} (${contract.vehicle.registrationNumber})`;
    const money = w
      ? ` You pay GHS ${Number(w.depositAmount).toLocaleString('en-GH')} deposit, then GHS ${Number(w.installmentAmount).toLocaleString('en-GH')} every ${String(w.installmentFrequency || 'WEEKLY').toLowerCase()} for ${w.totalInstallments} payments — GHS ${Number(w.totalPayable).toLocaleString('en-GH')} in total. Grace period: ${w.gracePeriodDays ?? 0} days.`
      : don
        ? ` This is a DriveOn contract: you bring GHS ${Number(don.dailySalesAmount).toLocaleString('en-GH')} sales, paid ${String(don.paymentFrequency || 'DAILY').toLowerCase()}. Grace period: ${agreed.gracePeriodDays ?? 0} days.`
        : '';
    const needsAccount = !driver;
    const signLink = `/driver/contracts?contract=${contractId}`;
    await this.prisma.chatMessage.create({
      data: {
        threadId: thread.id, senderUserId: ownerUserId, kind: 'CONTRACT', contractId,
        body: `You have been awarded the contract for the ${vehicleLabel}.${money}\nOpen it here: ${signLink}\nYour signing code has been sent to your phone, email and notifications${needsAccount ? ' — create your Driver account first, then use the code to sign' : ' — use it on the contract to sign'}. +Motive records the agreement and tracks the terms; confirm in person that you have seen the vehicle and its documents before signing.`,
      },
    });
    await this.prisma.chatThread.update({
      where: { id: thread.id },
      data: { lastMessageAt: new Date(), ...((thread as any).contractId ? {} : { contractId }) },
    });

    const subject = needsAccount ? 'A contract was awarded to you — create your Driver account to sign it' : 'A contract was awarded to you';
    const body = `Hello ${target.firstName}, you have been awarded the contract for the ${vehicleLabel}.${money} Your signing code is ${code}.${needsAccount ? ' You do not have a Driver account yet: create one in My Account first, then enter this code to sign. The code stays valid.' : ' Enter this code on the contract to sign it.'} Open it here: ${signLink}`;
    const sentTo: string[] = [];
    if (this.notifications) {
      const attempts: Array<[NotificationChannel, string, boolean]> = [
        ...(target.phone ? [[NotificationChannel.SMS, 'sms', true] as [NotificationChannel, string, boolean]] : []),
        ...(target.email ? [[NotificationChannel.EMAIL, 'email', true] as [NotificationChannel, string, boolean]] : []),
        [NotificationChannel.IN_APP, 'in-app', true],
      ];
      for (const [channel, label] of attempts) {
        const ok = await this.notifications.send({
          userId: target.id, channel, type: 'CONTRACT_AWARDED', subject, body,
          data: { contractId, threadId: thread.id, vehicleId: contract.vehicleId, requiresDriverAccount: needsAccount },
        }).then(() => true).catch(() => false);
        if (ok) sentTo.push(label);
      }
    } else {
      try {
        await this.prisma.notification.create({
          data: {
            userId: target.id, channel: 'IN_APP', type: 'CONTRACT_AWARDED', status: 'SENT', sentAt: new Date(),
            subject, body, data: { contractId, threadId: thread.id, vehicleId: contract.vehicleId, requiresDriverAccount: needsAccount },
          },
        });
        sentTo.push('in-app');
      } catch { /* best effort */ }
    }

    return {
      contractId, threadId: thread.id, requiresDriverAccount: needsAccount, codeSentTo: sentTo,
      driver: {
        id: target.id, firstName: target.firstName, lastName: target.lastName,
        chatUsername: target.chatUsername, profilePhotoUrl: target.profilePhotoUrl || null,
        hasDriverAccount: !!driver,
      },
    };
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
    await this.refreshContractDrivers(contractId);

    await this.audit.log({
      actorId: userId,
      action: AuditAction.CONTRACT_TERMINATE,
      resource: 'contract',
      resourceId: contractId,
      newData: { reason },
    });

    return this.findById(contractId, userId, 'ANY');
  }

  /** Attach public user info (name, @chatUsername, photo) to contract parties. */
  private async enrichParties(contracts: any[]) {
    if (typeof this.prisma.user?.findMany !== 'function') return contracts;
    const ids = [...new Set(contracts.flatMap((c) => (c.parties || []).map((p: any) => p.userId).filter(Boolean)))];
    if (!ids.length) return contracts;
    const users = await this.prisma.user.findMany({
      where: { id: { in: ids } },
      select: { id: true, firstName: true, lastName: true, chatUsername: true, primaryRole: true, profilePhotoUrl: true },
    });
    const byId = new Map(users.map((u: any) => [u.id, u]));
    for (const c of contracts) {
      for (const p of c.parties || []) {
        if (p.userId && byId.has(p.userId)) p.user = byId.get(p.userId);
      }
    }
    return contracts;
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

    // Oversight roles (platform admin) monitor all contracts;
    // everyone else sees only contracts they are party to.
    const adminRoles: UserRole[] = [UserRole.ADMIN, UserRole.SUPER_ADMIN];
    if (!adminRoles.includes(userRole as UserRole)) {
      where.parties = { some: { userId } };
    }

    const [contracts, total] = await this.prisma.$transaction([
      this.prisma.contract.findMany({
        where, skip, take: Math.max(1, Math.floor(Number(limit)) || 20),
        orderBy: { createdAt: 'desc' },
        include: {
          vehicle: { select: { id: true, registrationNumber: true, make: true, model: true, year: true, type: true, color: true, mileage: true, fuelType: true, transmission: true, imageUrls: true, region: true, location: true } },
          parties: { select: { id: true, userId: true, driverId: true, companyId: true, role: true, signedAt: true } },
          workAndPayTerms: true,
          rentalTerms: true,
          drivingOnTerms: true,
        },
      }),
      this.prisma.contract.count({ where }),
    ]);

    await this.enrichParties(contracts as any[]);

    if (userRole === UserRole.DRIVER && contracts.length > 0) {
      const codes = await this.prisma.contractAccessCode.findMany({
        where: { contractId: { in: contracts.map((c) => c.id) }, driverUserId: userId, status: 'ACTIVE' },
        select: { contractId: true },
      });
      const coded = new Set(codes.map((c) => c.contractId));
      for (const c of contracts as any[]) {
        const mine = c.parties?.find((p: any) => p.userId === userId);
        c.requiresCode = coded.has(c.id) && !mine?.signedAt;
        this.hideVehicleValueFromDriver(c);
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
          select: { id: true, registrationNumber: true, make: true, model: true, year: true, status: true, type: true, color: true, mileage: true, fuelType: true, transmission: true, imageUrls: true, region: true, location: true },
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
    const adminRoles: UserRole[] = [UserRole.ADMIN, UserRole.SUPER_ADMIN];
    if (!adminRoles.includes(userRole as UserRole) && userRole !== 'ANY') {
      const isParty = contract.parties.some((p) => p.userId === userId);
      if (!isParty) throw new ForbiddenException('Access denied to this contract');
    }

    await this.enrichParties([contract as any]);

    if (userRole === UserRole.DRIVER) {
      const mine = contract.parties.find((p) => p.userId === userId);
      const active = await this.prisma.contractAccessCode.findFirst({
        where: { contractId, driverUserId: userId, status: 'ACTIVE' },
      });
      (contract as any).requiresCode = !!active && !mine?.signedAt;
      this.hideVehicleValueFromDriver(contract);
    }

    return contract;
  }

  // ── Legal/admin status management (review, suspend, …) ─────
  async updateStatus(contractId: string, userId: string, userRole: string, status: string) {
    const oversight: UserRole[] = [UserRole.ADMIN, UserRole.SUPER_ADMIN];
    if (!oversight.includes(userRole as UserRole)) {
      throw new ForbiddenException('Only platform admin can change contract status');
    }
    const valid = Object.values(ContractStatus) as string[];
    if (!valid.includes(status)) throw new BadRequestException(`Invalid contract status: ${status}`);

    const contract = await this.prisma.contract.findUnique({ where: { id: contractId } });
    if (!contract) throw new NotFoundException('Contract not found');

    await this.prisma.contract.update({ where: { id: contractId }, data: { status: status as ContractStatus } });
    await this.refreshContractDrivers(contractId);
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
      || user?.primaryRole === UserRole.SUPER_ADMIN;
  }
}
