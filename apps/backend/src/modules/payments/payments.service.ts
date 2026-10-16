import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import {
  AuditAction, PaymentStatus, TransactionType, TransactionDirection,
  SettlementStatus, UserRole,
} from '@prisma/client';
import { InitiatePaymentDto } from './dto/initiate-payment.dto';
import { PaymentProviderFactory } from '../../integrations/payments/payment-provider.factory';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationChannel } from '@prisma/client';
import { Optional } from '@nestjs/common';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly providerFactory: PaymentProviderFactory,
    @Optional() private readonly notifications?: NotificationsService,
  ) {}

  private generatePaymentNumber(): string {
    const ts = Date.now().toString(36).toUpperCase();
    const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `PAY-${ts}-${rand}`;
  }

  private generateTransactionNumber(): string {
    const ts = Date.now().toString(36).toUpperCase();
    const rand = Math.random().toString(36).substring(2, 7).toUpperCase();
    return `TXN-${ts}-${rand}`;
  }

  // ── Initiate Payment ───────────────────────────────────────
  async initiate(userId: string, dto: InitiatePaymentDto) {
    // Verify contract exists and user is a party
    const contract = await this.prisma.contract.findUnique({
      where: { id: dto.contractId },
      include: {
        parties: true,
        vehicle: {
          include: {
            owner: { include: { user: true } },
          },
        },
      },
    });
    if (!contract) throw new NotFoundException('Contract not found');

    const isParty = contract.parties.some((p) => p.userId === userId);
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { primaryRole: true },
    });
    const isAdmin = user?.primaryRole === UserRole.ADMIN || user?.primaryRole === UserRole.SUPER_ADMIN;

    if (!isParty && !isAdmin) {
      throw new ForbiddenException('You are not authorised to make payments on this contract');
    }

    // Idempotency key — scoped to user+contract+amount+schedule
    const idempotencyKey = `${userId}:${dto.contractId}:${dto.amount}:${dto.paymentScheduleId ?? 'none'}:${Date.now()}`;

    // Resolve driver/owner profiles
    const driver = await this.prisma.driver.findUnique({ where: { userId } });
    const owner  = await this.prisma.owner.findUnique({ where: { userId } });

    // Resolve recipient (vehicle owner's MoMo number for direct settlement)
    const vehicleOwner = contract.vehicle?.owner;
    const recipientPhone = vehicleOwner?.momoNumber ?? null;
    const recipientName  = vehicleOwner
      ? `${vehicleOwner.user?.firstName ?? ''} ${vehicleOwner.user?.lastName ?? ''}`.trim()
      : undefined;

    // Create payment record in INITIATED state
    const payment = await this.prisma.payment.create({
      data: {
        paymentNumber: this.generatePaymentNumber(),
        contractId: dto.contractId,
        paymentObligationId: dto.paymentObligationId,
        paymentScheduleId: dto.paymentScheduleId,
        driverId: driver?.id,
        ownerId: owner?.id ?? vehicleOwner?.id,
        vehicleId: contract.vehicleId,
        amount: dto.amount,
        currency: 'GHS',
        payerPhone: dto.payerPhone,
        payerName: userId,
        paymentMethod: dto.paymentMethod,
        paymentProvider: dto.paymentProvider,
        idempotencyKey,
        status: PaymentStatus.INITIATED,
      },
    });

    await this.audit.log({
      actorId: userId,
      action: AuditAction.PAYMENT_CREATE,
      resource: 'payment',
      resourceId: payment.id,
      newData: { amount: dto.amount, status: PaymentStatus.INITIATED },
    });

    // Call the active payment provider
    try {
      const provider = await this.providerFactory.getActiveProvider();

      this.logger.log(`Calling provider ${provider.name} for payment ${payment.id}`);

      const result = await provider.requestCollection({
        payerPhone: dto.payerPhone,
        amount: dto.amount,
        reference: payment.id, // use payment ID as reference for webhook lookup
        description: `+Motive contract payment ${payment.paymentNumber}`,
        recipientPhone: recipientPhone ?? undefined,
        recipientName,
      });

      // Update payment with provider reference and status
      const updatedPayment = await this.prisma.payment.update({
        where: { id: payment.id },
        data: {
          providerReference: result.providerReference,
          providerTransactionId: result.providerReference,
          status: result.status === 'SUCCESSFUL'
            ? PaymentStatus.SUCCESSFUL
            : result.status === 'FAILED'
            ? PaymentStatus.FAILED
            : PaymentStatus.PENDING,
          ...(result.status === 'SUCCESSFUL' ? { completedAt: new Date() } : {}),
        },
      });

      // If provider is DirectPay and returned SUCCESSFUL immediately — settle now
      if (result.status === 'SUCCESSFUL' && provider.isDirectPay) {
        await this.onPaymentSucceeded(updatedPayment, provider.isDirectPay, null);
      }

      return updatedPayment;
    } catch (providerError) {
      this.logger.error(`Provider call failed for payment ${payment.id}`, providerError);
      // Mark as PENDING — webhook or poll will resolve
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: { status: PaymentStatus.PENDING },
      });
      return { ...payment, status: PaymentStatus.PENDING };
    }
  }

  // ── Handle Hubtel Webhook ──────────────────────────────────
  async handleHubtelWebhook(payload: any, headers: Record<string, string>) {
    const provider = this.providerFactory['hubtel']; // direct ref to verify signature
    const result = await provider.verifyWebhook(payload, headers);

    if (!result.valid) {
      this.logger.warn('[Hubtel] Webhook signature invalid — rejected');
      return { received: false };
    }

    await this.processWebhookResult(result.providerReference, result.status, true);
    return { received: true };
  }

  // ── Handle MTN Webhook ─────────────────────────────────────
  async handleMTNWebhook(payload: any, headers: Record<string, string>) {
    const provider = this.providerFactory['mtn']; // direct ref
    const result = await provider.verifyWebhook(payload, headers);

    // MTN: after collection confirmed, trigger disbursement to owner
    await this.processWebhookResult(result.providerReference, result.status, false);
    return { received: true };
  }

  // ── Core webhook processor ─────────────────────────────────
  async processWebhookResult(
    providerReference: string,
    status: 'SUCCESSFUL' | 'FAILED',
    isDirectPay: boolean,
  ) {
    // Find payment by reference — idempotency: skip if already finalised
    const payment = await this.prisma.payment.findFirst({
      where: {
        OR: [
          { providerReference },
          { providerTransactionId: providerReference },
          { id: providerReference }, // mock uses payment ID as reference
        ],
      },
    });

    if (!payment) {
      this.logger.warn(`Webhook: no payment found for reference ${providerReference}`);
      return;
    }

    if (payment.status === PaymentStatus.SUCCESSFUL || payment.status === PaymentStatus.FAILED) {
      this.logger.log(`Webhook: payment ${payment.id} already finalised — skipping (idempotency)`);
      return;
    }

    const newStatus = status === 'SUCCESSFUL' ? PaymentStatus.SUCCESSFUL : PaymentStatus.FAILED;

    await this.prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: newStatus,
        webhookReceivedAt: new Date(),
        ...(status === 'SUCCESSFUL' ? { completedAt: new Date() } : { failedAt: new Date() }),
      },
    });

    if (status === 'SUCCESSFUL') {
      await this.onPaymentSucceeded(payment, isDirectPay, providerReference);
    } else {
      await this.audit.log({
        action: AuditAction.PAYMENT_FAILED,
        resource: 'payment',
        resourceId: payment.id,
        newData: { providerReference, status: newStatus },
      });
    }
  }

  // ── Post-success ledger + settlement ───────────────────────
  private async onPaymentSucceeded(payment: any, isDirectPay: boolean, providerReference: string | null) {
    await this.prisma.$transaction(async (tx) => {
      // Write PAYMENT_IN ledger entry
      await tx.transaction.create({
        data: {
          transactionNumber: this.generateTransactionNumber(),
          paymentId: payment.id,
          contractId: payment.contractId,
          vehicleId: payment.vehicleId,
          driverId: payment.driverId,
          ownerId: payment.ownerId,
          amount: payment.amount,
          currency: payment.currency,
          type: TransactionType.PAYMENT_IN,
          direction: TransactionDirection.CREDIT,
          status: PaymentStatus.SUCCESSFUL,
          // DirectPay: money already at owner → settlement is immediate
          settlementStatus: isDirectPay ? SettlementStatus.COMPLETED : SettlementStatus.PENDING,
          settledAt: isDirectPay ? new Date() : null,
          providerReference: providerReference ?? payment.providerReference,
        },
      });

      // Mark payment settled if DirectPay
      if (isDirectPay) {
        await tx.payment.update({
          where: { id: payment.id },
          data: {
            settlementStatus: SettlementStatus.COMPLETED,
            settledAt: new Date(),
          },
        });
      }

      // Update payment schedule if linked
      if (payment.paymentScheduleId) {
        await tx.paymentSchedule.update({
          where: { id: payment.paymentScheduleId },
          data: { status: 'PAID', paidAt: new Date(), paidAmount: payment.amount },
        });
      }

      // Update Work & Pay balance
      if (payment.contractId) {
        const wapTerms = await tx.workAndPayTerms.findUnique({
          where: { contractId: payment.contractId },
        });
        if (wapTerms) {
          const newPaid = Number(wapTerms.totalPaid) + Number(payment.amount);
          const newRemaining = Number(wapTerms.totalPayable) - newPaid;
          await tx.workAndPayTerms.update({
            where: { contractId: payment.contractId },
            data: {
              totalPaid: newPaid,
              remainingBalance: newRemaining < 0 ? 0 : newRemaining,
              paidInstallments: { increment: 1 },
              ownershipEligible: newRemaining <= 0,
            },
          });
        }
      }
    });

    // For non-DirectPay (MTN): trigger disbursement to owner
    if (!isDirectPay) {
      await this.triggerDisbursement(payment);
    }

    await this.audit.log({
      action: AuditAction.PAYMENT_SUCCESS,
      resource: 'payment',
      resourceId: payment.id,
      newData: { providerReference, isDirectPay },
    });

    await this.notifyPaymentReceived(payment).catch((err) =>
      this.logger.warn(`Payment notification failed for ${payment.id}: ${err?.message}`),
    );
  }

  // Notify the vehicle owner (and the paying driver) that money arrived
  private async notifyPaymentReceived(payment: any) {
    if (!this.notifications) return;
    const amount = `GHS ${Number(payment.amount).toLocaleString('en-GH', { minimumFractionDigits: 2 })}`;

    let vehicleLabel = 'your vehicle';
    if (payment.vehicleId) {
      const vehicle = await this.prisma.vehicle.findUnique({
        where: { id: payment.vehicleId },
        select: { registrationNumber: true, make: true, model: true },
      }).catch(() => null);
      if (vehicle) vehicleLabel = `${vehicle.make} ${vehicle.model} (${vehicle.registrationNumber})`;
    }

    if (payment.ownerId) {
      const owner = await this.prisma.owner.findUnique({
        where: { id: payment.ownerId },
        select: { userId: true, user: { select: { firstName: true } } },
      }).catch(() => null);
      if (owner?.userId) {
        const subject = 'Payment received';
        const body = `Hello ${owner.user.firstName}, a payment of ${amount} for ${vehicleLabel} was received on +Motive. Open Payments in your owner portal to see the full record.`;
        for (const channel of [NotificationChannel.PUSH, NotificationChannel.IN_APP, NotificationChannel.EMAIL]) {
          await this.notifications.send({ userId: owner.userId, channel, type: 'PAYMENT_RECEIVED', subject, body, data: { paymentId: payment.id, contractId: payment.contractId } }).catch(() => null);
        }
      }
    }

    if (payment.driverId) {
      const driver = await this.prisma.driver.findUnique({
        where: { id: payment.driverId },
        select: { userId: true, user: { select: { firstName: true } } },
      }).catch(() => null);
      if (driver?.userId) {
        const body = `Hello ${driver.user.firstName}, your payment of ${amount} for ${vehicleLabel} was confirmed on +Motive. Keep this as your receipt record.`;
        for (const channel of [NotificationChannel.PUSH, NotificationChannel.IN_APP]) {
          await this.notifications.send({ userId: driver.userId, channel, type: 'PAYMENT_CONFIRMED', subject: 'Payment confirmed', body, data: { paymentId: payment.id, contractId: payment.contractId } }).catch(() => null);
        }
      }
    }
  }

  // ── Disbursement (MTN only — after collection confirmed) ───
  private async triggerDisbursement(payment: any) {
    // Resolve owner's MoMo number from the contract's vehicle owner
    const contract = await this.prisma.contract.findUnique({
      where: { id: payment.contractId },
      include: { vehicle: { include: { owner: { include: { user: true } } } } },
    });

    const ownerMomo = contract?.vehicle?.owner?.momoNumber;
    if (!ownerMomo) {
      this.logger.warn(`Disbursement skipped for payment ${payment.id}: owner has no MoMo number`);
      return;
    }

    try {
      const provider = await this.providerFactory.getActiveProvider();
      const disbRef = `DIS-${payment.id}`;

      const result = await provider.disburse({
        recipientPhone: ownerMomo,
        amount: Number(payment.amount),
        reference: disbRef,
        description: `+Motive settlement for payment ${payment.paymentNumber}`,
      });

      this.logger.log(`Disbursement ${disbRef}: ${result.status} → ${ownerMomo}`);

      // Write SETTLEMENT transaction
      await this.prisma.transaction.create({
        data: {
          transactionNumber: this.generateTransactionNumber(),
          paymentId: payment.id,
          contractId: payment.contractId,
          vehicleId: payment.vehicleId,
          ownerId: payment.ownerId,
          amount: payment.amount,
          currency: payment.currency,
          type: TransactionType.SETTLEMENT,
          direction: TransactionDirection.CREDIT,
          status: result.status === 'SUCCESSFUL' ? PaymentStatus.SUCCESSFUL : PaymentStatus.PENDING,
          settlementStatus: result.status === 'SUCCESSFUL' ? SettlementStatus.COMPLETED : SettlementStatus.PENDING,
          settledAt: result.status === 'SUCCESSFUL' ? new Date() : null,
          providerReference: result.providerReference,
        },
      });

      if (result.status === 'SUCCESSFUL' || result.status === 'PENDING') {
        await this.prisma.payment.update({
          where: { id: payment.id },
          data: {
            settlementStatus: result.status === 'SUCCESSFUL' ? SettlementStatus.COMPLETED : SettlementStatus.PROCESSING,
            settledAt: result.status === 'SUCCESSFUL' ? new Date() : null,
          },
        });
      }
    } catch (err) {
      this.logger.error(`Disbursement failed for payment ${payment.id}`, err);
    }
  }

  // ── List ───────────────────────────────────────────────────
  async findAll(params: {
    page?: number; limit?: number; status?: string;
    contractId?: string; userId: string; userRole: string;
  }) {
    const { page = 1, limit = 20, status, contractId, userId, userRole } = params;
    const skip = (Math.max(1, Math.floor(Number(page)) || 1) - 1) * (Math.max(1, Math.floor(Number(limit)) || 20));
    const where: any = {};

    if (status) where.status = status;
    if (contractId) where.contractId = contractId;

    const adminRoles: UserRole[] = [UserRole.ADMIN, UserRole.SUPER_ADMIN];
    if (!adminRoles.includes(userRole as UserRole)) {
      const driver = await this.prisma.driver.findUnique({ where: { userId } });
      const owner  = await this.prisma.owner.findUnique({ where: { userId } });
      where.OR = [
        ...(driver ? [{ driverId: driver.id }] : []),
        ...(owner  ? [{ ownerId: owner.id }]  : []),
      ];
      if (where.OR.length === 0) where.OR = [{ driverId: null }];
    }

    const [payments, total] = await this.prisma.$transaction([
      this.prisma.payment.findMany({
        where, skip, take: Math.max(1, Math.floor(Number(limit)) || 20), orderBy: { createdAt: 'desc' },
        include: {
          transactions: { select: { id: true, type: true, direction: true, amount: true, status: true } },
        },
      }),
      this.prisma.payment.count({ where }),
    ]);

    return { payments, pagination: { total, page, limit, totalPages: Math.ceil(total / (Math.max(1, Math.floor(Number(limit)) || 20))) } };
  }

  // ── Get by ID ──────────────────────────────────────────────
  async findById(paymentId: string, userId: string, userRole: string) {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      include: { transactions: true },
    });
    if (!payment) throw new NotFoundException('Payment not found');

    const adminRoles: UserRole[] = [UserRole.ADMIN, UserRole.SUPER_ADMIN];
    if (!adminRoles.includes(userRole as UserRole)) {
      const driver = await this.prisma.driver.findUnique({ where: { userId } });
      const owner  = await this.prisma.owner.findUnique({ where: { userId } });
      const allowed =
        (driver && payment.driverId === driver.id) ||
        (owner  && payment.ownerId  === owner.id);
      if (!allowed) throw new ForbiddenException('Access denied to this payment');
    }

    return payment;
  }

  // ── Transactions (ledger) ──────────────────────────────────
  async getTransactions(params: {
    page?: number; limit?: number; contractId?: string;
    userId: string; userRole: string;
  }) {
    const { page = 1, limit = 20, contractId, userId, userRole } = params;
    const skip = (Math.max(1, Math.floor(Number(page)) || 1) - 1) * (Math.max(1, Math.floor(Number(limit)) || 20));
    const where: any = {};

    if (contractId) where.contractId = contractId;

    const adminRoles: UserRole[] = [UserRole.ADMIN, UserRole.SUPER_ADMIN];
    if (!adminRoles.includes(userRole as UserRole)) {
      const driver = await this.prisma.driver.findUnique({ where: { userId } });
      const owner  = await this.prisma.owner.findUnique({ where: { userId } });
      where.OR = [
        ...(driver ? [{ driverId: driver.id }] : []),
        ...(owner  ? [{ ownerId: owner.id }]  : []),
      ];
      if (where.OR.length === 0) where.OR = [{ driverId: null }];
    }

    const [transactions, total] = await this.prisma.$transaction([
      this.prisma.transaction.findMany({ where, skip, take: Math.max(1, Math.floor(Number(limit)) || 20), orderBy: { createdAt: 'desc' } }),
      this.prisma.transaction.count({ where }),
    ]);

    return { transactions, pagination: { total, page, limit, totalPages: Math.ceil(total / (Math.max(1, Math.floor(Number(limit)) || 20))) } };
  }
}
