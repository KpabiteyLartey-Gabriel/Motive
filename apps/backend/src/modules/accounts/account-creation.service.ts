import {
  BadRequestException, ConflictException, Injectable, Logger, NotFoundException, Optional,
} from '@nestjs/common';
import { createHash, randomInt } from 'crypto';
import { AccountCreationStatus, NotificationChannel, PaymentStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PaymentProviderFactory } from '../../integrations/payments/payment-provider.factory';
import { AccountsService } from './accounts.service';

export type CreationKind = 'DRIVER' | 'OWNER';

export const CHARGE_KEYS: Record<CreationKind, string> = {
  DRIVER: 'charges.driver_account_creation_ghs',
  OWNER: 'charges.owner_account_creation_ghs',
};
export const DEFAULT_CHARGE_GHS = 20;

const KIND_LABEL: Record<CreationKind, string> = { DRIVER: 'Driver', OWNER: 'Owner' };

function parseKind(raw: string): CreationKind {
  const kind = String(raw || '').toUpperCase();
  if (kind !== 'DRIVER' && kind !== 'OWNER') {
    throw new BadRequestException('Account kind must be DRIVER or OWNER.');
  }
  return kind as CreationKind;
}

/**
 * Paid Driver/Owner account creation.
 *
 * Flow: start (sends ONE interest code to phone SMS + email + in-app) ->
 * confirm the code -> pay the admin-set creation charge through the active
 * payment provider -> only on confirmed payment is the account provisioned,
 * and the user is emailed + notified in-app how to reach the new dashboard.
 */
@Injectable()
export class AccountCreationService {
  private readonly logger = new Logger(AccountCreationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly accounts: AccountsService,
    private readonly providerFactory: PaymentProviderFactory,
    @Optional() private readonly notifications?: NotificationsService,
  ) {}

  // ── Charges (admin-managed) ────────────────────────────────
  async getCharge(kind: CreationKind): Promise<number> {
    const setting = await this.prisma.systemSetting.findUnique({ where: { key: CHARGE_KEYS[kind] } });
    const value = Number(setting?.value);
    return Number.isFinite(value) && value > 0 ? value : DEFAULT_CHARGE_GHS;
  }

  async getCharges() {
    const [driver, owner] = await Promise.all([this.getCharge('DRIVER'), this.getCharge('OWNER')]);
    return {
      currency: 'GHS',
      charges: [
        { kind: 'DRIVER', label: 'Driver account creation', amountGhs: driver },
        { kind: 'OWNER', label: 'Owner account creation', amountGhs: owner },
      ],
    };
  }

  async setCharge(rawKind: string, amountGhs: number, actorId: string) {
    const kind = parseKind(rawKind);
    if (!Number.isFinite(amountGhs) || amountGhs <= 0) {
      throw new BadRequestException('Charge must be a positive amount in GHS.');
    }
    await this.prisma.systemSetting.upsert({
      where: { key: CHARGE_KEYS[kind] },
      update: { value: String(amountGhs), type: 'number', category: 'charges', updatedBy: actorId },
      create: { key: CHARGE_KEYS[kind], value: String(amountGhs), type: 'number', category: 'charges', updatedBy: actorId },
    });
    return this.getCharges();
  }

  // ── Orders ─────────────────────────────────────────────────
  private hashCode(code: string): string {
    return createHash('sha256').update(code).digest('hex');
  }

  private shape(order: any) {
    return {
      id: order.id,
      kind: order.kind,
      amount: Number(order.amount),
      currency: order.currency,
      status: order.status,
      verifiedAt: order.verifiedAt,
      paidAt: order.paidAt,
      completedAt: order.completedAt,
      createdAt: order.createdAt,
    };
  }

  private async assertNoAccount(userId: string, kind: CreationKind) {
    const profile = kind === 'DRIVER'
      ? await this.prisma.driver.findUnique({ where: { userId } })
      : await this.prisma.owner.findUnique({ where: { userId } });
    if (profile) throw new ConflictException(`You already have a ${KIND_LABEL[kind]} account.`);
  }

  private async activeOrder(userId: string, kind: CreationKind) {
    return this.prisma.accountCreationOrder.findFirst({
      where: { userId, kind, status: { in: [AccountCreationStatus.PENDING_VERIFICATION, AccountCreationStatus.AWAITING_PAYMENT] } },
      orderBy: { createdAt: 'desc' },
    });
  }

  /** Step 1: create/reuse the order and send the interest code everywhere. */
  async start(userId: string, rawKind: string) {
    const kind = parseKind(rawKind);
    await this.assertNoAccount(userId, kind);
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, firstName: true, email: true, phone: true },
    });
    if (!user) throw new NotFoundException('User not found');
    if (!user.email && !user.phone) {
      throw new BadRequestException('Add an email address or phone number to your account first so we can send your confirmation code.');
    }

    const amount = await this.getCharge(kind);
    let order = await this.activeOrder(userId, kind);
    if (!order) {
      order = await this.prisma.accountCreationOrder.create({
        data: { userId, kind, amount: new Prisma.Decimal(amount) },
      });
    }

    const code = String(randomInt(100000, 1000000));
    await this.prisma.accountCreationOrder.update({
      where: { id: order.id },
      data: {
        amount: new Prisma.Decimal(amount),
        status: AccountCreationStatus.PENDING_VERIFICATION,
        codeHash: this.hashCode(code),
        codeExpiresAt: new Date(Date.now() + 10 * 60 * 1000),
        codeUsedAt: null,
      },
    });

    const sentTo: string[] = [];
    const subject = `Confirm your ${KIND_LABEL[kind]} account`;
    const body = `Hello ${user.firstName}, your +Motive code to confirm you want a ${KIND_LABEL[kind]} account is ${code}. It expires in 10 minutes. After confirming, you will pay the one-time GHS ${amount} account creation charge.`;
    if (this.notifications) {
      const attempts: Array<[NotificationChannel, string]> = [
        ...(user.phone ? [[NotificationChannel.SMS, 'phone'] as [NotificationChannel, string]] : []),
        ...(user.email ? [[NotificationChannel.EMAIL, 'email'] as [NotificationChannel, string]] : []),
        [NotificationChannel.IN_APP, 'in-app'],
      ];
      for (const [channel, label] of attempts) {
        const ok = await this.notifications.send({
          userId, channel, type: 'ACCOUNT_CREATION_CODE', subject, body,
          data: { kind, orderId: order.id },
        }).then(() => true).catch(() => false);
        if (ok) sentTo.push(label);
      }
    }

    return { ...this.shape({ ...order, amount }), sentTo };
  }

  /** Step 2: confirm interest with the code. */
  async confirm(userId: string, rawKind: string, codeRaw: string) {
    const kind = parseKind(rawKind);
    const order = await this.activeOrder(userId, kind);
    if (!order || order.status !== AccountCreationStatus.PENDING_VERIFICATION) {
      throw new BadRequestException('Start your account creation first so we can send you a code.');
    }
    const code = String(codeRaw || '').trim();
    if (!/^\d{6}$/.test(code)) throw new BadRequestException('Enter the 6-digit code we sent you.');
    if (!order.codeHash || !order.codeExpiresAt || order.codeExpiresAt < new Date() || order.codeHash !== this.hashCode(code)) {
      throw new BadRequestException('That code is incorrect or has expired. Request a new one.');
    }
    const updated = await this.prisma.accountCreationOrder.update({
      where: { id: order.id },
      data: { status: AccountCreationStatus.AWAITING_PAYMENT, codeUsedAt: new Date(), verifiedAt: new Date() },
    });
    return this.shape(updated);
  }

  /** Step 3: pay the creation charge through the active provider. */
  async pay(userId: string, rawKind: string, dto: { payerPhone: string; paymentMethod?: string; paymentProvider?: string }) {
    const kind = parseKind(rawKind);
    const order = await this.activeOrder(userId, kind);
    if (!order || order.status !== AccountCreationStatus.AWAITING_PAYMENT) {
      throw new BadRequestException('Confirm your interest with the code first, then pay.');
    }
    const payerPhone = String(dto.payerPhone || '').trim();
    if (payerPhone.length < 7) throw new BadRequestException('Enter the mobile money number to charge.');

    const payment = await this.prisma.payment.create({
      data: {
        paymentNumber: `PAY-${Date.now().toString(36).toUpperCase()}-${randomInt(1000, 9999)}`,
        amount: order.amount,
        currency: order.currency,
        payerPhone,
        payerName: userId,
        paymentMethod: dto.paymentMethod || 'MOMO',
        paymentProvider: dto.paymentProvider || undefined,
        idempotencyKey: `acct-creation:${order.id}:${Date.now()}`,
        status: PaymentStatus.INITIATED,
        metadata: { purpose: 'ACCOUNT_CREATION', orderId: order.id, kind, userId },
      },
    });
    await this.prisma.accountCreationOrder.update({ where: { id: order.id }, data: { paymentId: payment.id } });

    try {
      const provider = await this.providerFactory.getActiveProvider();
      const result = await provider.requestCollection({
        payerPhone,
        amount: Number(order.amount),
        reference: payment.id,
        description: `+Motive ${KIND_LABEL[kind]} account creation ${payment.paymentNumber}`,
      });
      const status = result.status === 'SUCCESSFUL'
        ? PaymentStatus.SUCCESSFUL
        : result.status === 'FAILED' ? PaymentStatus.FAILED : PaymentStatus.PENDING;
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: {
          providerReference: result.providerReference,
          providerTransactionId: result.providerReference,
          status,
          ...(status === PaymentStatus.SUCCESSFUL ? { completedAt: new Date() } : {}),
          ...(status === PaymentStatus.FAILED ? { failedAt: new Date() } : {}),
        },
      });
      if (status === PaymentStatus.SUCCESSFUL) {
        const done = await this.complete(order.id);
        return { ...done, paymentStatus: status };
      }
      return { ...this.shape(order), paymentStatus: status, paymentId: payment.id };
    } catch (err: any) {
      this.logger.warn(`Account creation payment ${payment.id} provider call failed: ${err?.message}`);
      await this.prisma.payment.update({ where: { id: payment.id }, data: { status: PaymentStatus.PENDING } });
      return { ...this.shape(order), paymentStatus: PaymentStatus.PENDING, paymentId: payment.id };
    }
  }

  /** Poll a pending payment (page refresh / provider still processing). */
  async status(userId: string, rawKind: string) {
    const kind = parseKind(rawKind);
    const order = await this.prisma.accountCreationOrder.findFirst({
      where: { userId, kind },
      orderBy: { createdAt: 'desc' },
    });
    if (!order) return { kind, status: 'NOT_STARTED', amount: await this.getCharge(kind), currency: 'GHS' };
    if (order.status === AccountCreationStatus.AWAITING_PAYMENT && order.paymentId) {
      const payment = await this.prisma.payment.findUnique({ where: { id: order.paymentId } });
      if (payment && payment.status !== PaymentStatus.SUCCESSFUL && payment.providerReference) {
        try {
          const provider = await this.providerFactory.getActiveProvider();
          const res = await provider.getCollectionStatus(payment.providerReference);
          if (res.status === 'SUCCESSFUL') {
            await this.prisma.payment.update({ where: { id: payment.id }, data: { status: PaymentStatus.SUCCESSFUL, completedAt: new Date() } });
            return { ...(await this.complete(order.id)), paymentStatus: PaymentStatus.SUCCESSFUL };
          }
          if (res.status === 'FAILED') {
            await this.prisma.payment.update({ where: { id: payment.id }, data: { status: PaymentStatus.FAILED, failedAt: new Date() } });
            return { ...this.shape(order), paymentStatus: PaymentStatus.FAILED, paymentId: payment.id };
          }
        } catch { /* stay pending */ }
      }
    }
    return this.shape(order);
  }

  /** Called by the payments webhook when an account-creation payment lands. */
  async completeFromPayment(payment: any) {
    const meta = (payment?.metadata || {}) as any;
    if (meta.purpose !== 'ACCOUNT_CREATION' || !meta.orderId) return;
    await this.complete(meta.orderId).catch((err) =>
      this.logger.warn(`Account creation completion failed for order ${meta.orderId}: ${err?.message}`),
    );
  }

  /**
   * Provision the account exactly once, then tell the user how to get in:
   * email + in-app notification (the dashboard link works right after a
   * token refresh; signing out and back in does the same).
   */
  async complete(orderId: string) {
    const order = await this.prisma.accountCreationOrder.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Account creation order not found');
    if (order.status === AccountCreationStatus.COMPLETED) return this.shape(order);
    const kind = order.kind as CreationKind;

    try {
      if (kind === 'DRIVER') await this.accounts.createDriver(order.userId);
      else await this.accounts.createOwner(order.userId);
    } catch (err: any) {
      // Already provisioned (retry/webhook race) — that is the goal state.
      if (!(err instanceof ConflictException)) throw err;
    }

    const updated = await this.prisma.accountCreationOrder.update({
      where: { id: order.id },
      data: { status: AccountCreationStatus.COMPLETED, paidAt: order.paidAt || new Date(), completedAt: new Date() },
    });

    if (this.notifications) {
      const label = KIND_LABEL[kind];
      const dashboard = kind === 'DRIVER' ? '/driver/dashboard' : '/owner/dashboard';
      const subject = `Your ${label} account is ready`;
      const body = `Hello, your payment was confirmed and your ${label} account has been created. Open it here: ${dashboard}. If the link does not open your ${label} dashboard yet, sign out and sign back in so your new account loads.`;
      for (const channel of [NotificationChannel.EMAIL, NotificationChannel.IN_APP]) {
        await this.notifications.send({
          userId: order.userId, channel, type: 'ACCOUNT_CREATED', subject, body,
          data: { kind, orderId: order.id, dashboardPath: dashboard },
        }).catch(() => null);
      }
    }

    return this.shape(updated);
  }
}
