import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { AuditAction, SettlementStatus, PaymentStatus } from '@prisma/client';

@Injectable()
export class SettlementsService {
  private readonly logger = new Logger(SettlementsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /**
   * Process pending settlements — designed to be called by a scheduled job.
   * Finds all SUCCESSFUL payments whose settlementStatus is PENDING and marks
   * them COMPLETED, recording a SETTLEMENT transaction for each.
   */
  async processPendingSettlements(actorId?: string) {
    const pendingPayments = await this.prisma.payment.findMany({
      where: {
        status: PaymentStatus.SUCCESSFUL,
        settlementStatus: SettlementStatus.PENDING,
      },
      take: 100, // batch size
    });

    let settled = 0;
    let failed = 0;

    for (const payment of pendingPayments) {
      try {
        await this.prisma.$transaction(async (tx) => {
          const txnNumber = `SET-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

          await tx.transaction.create({
            data: {
              transactionNumber: txnNumber,
              paymentId: payment.id,
              contractId: payment.contractId,
              vehicleId: payment.vehicleId,
              driverId: payment.driverId,
              ownerId: payment.ownerId,
              companyId: payment.companyId,
              amount: payment.amount,
              currency: payment.currency,
              type: 'SETTLEMENT',
              direction: 'CREDIT',
              status: PaymentStatus.SUCCESSFUL,
              settlementStatus: SettlementStatus.COMPLETED,
              settledAt: new Date(),
              description: `Settlement for payment ${payment.paymentNumber}`,
            },
          });

          await tx.payment.update({
            where: { id: payment.id },
            data: {
              settlementStatus: SettlementStatus.COMPLETED,
              settledAt: new Date(),
            },
          });
        });

        settled++;
      } catch (err) {
        this.logger.error(`Settlement failed for payment ${payment.id}`, err);
        await this.prisma.payment.update({
          where: { id: payment.id },
          data: { settlementStatus: SettlementStatus.FAILED },
        });
        failed++;
      }
    }

    return { processed: pendingPayments.length, settled, failed };
  }

  // ── List settlements (admin view) ──────────────────────────
  async findAll(params: {
    page?: number;
    limit?: number;
    status?: string;
    contractId?: string;
  }) {
    const { page = 1, limit = 20, status, contractId } = params;
    const skip = (Math.max(1, Math.floor(Number(page)) || 1) - 1) * (Math.max(1, Math.floor(Number(limit)) || 20));
    const where: any = { type: 'SETTLEMENT' };

    if (status) where.settlementStatus = status;
    if (contractId) where.contractId = contractId;

    const [settlements, total] = await this.prisma.$transaction([
      this.prisma.transaction.findMany({
        where, skip, take: Math.max(1, Math.floor(Number(limit)) || 20), orderBy: { createdAt: 'desc' },
      }),
      this.prisma.transaction.count({ where }),
    ]);

    return { settlements, pagination: { total, page, limit, totalPages: Math.ceil(total / (Math.max(1, Math.floor(Number(limit)) || 20))) } };
  }
}
