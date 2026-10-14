import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  IPaymentProvider,
  CollectionRequest,
  CollectionResponse,
  DisbursementRequest,
  DisbursementResponse,
  PaymentStatusResponse,
  WebhookVerificationResult,
} from '../interfaces/payment-provider.interface';

/**
 * Mock Payment Provider
 *
 * Used in development and testing ONLY.
 * Automatically "succeeds" every collection and disbursement.
 *
 * PRODUCTION GUARD: This provider throws if NODE_ENV === 'production'.
 * It cannot accidentally be used in production regardless of SystemSetting.
 */
@Injectable()
export class MockPaymentProvider implements IPaymentProvider {
  readonly name = 'MOCK' as const;
  readonly isDirectPay = true; // simulates DirectPay behaviour in dev

  private readonly logger = new Logger(MockPaymentProvider.name);

  constructor(private readonly config: ConfigService) {
    const env = this.config.get<string>('NODE_ENV', 'development');
    if (env === 'production') {
      throw new Error('MockPaymentProvider must never be used in production');
    }
  }

  async requestCollection(req: CollectionRequest): Promise<CollectionResponse> {
    this.logger.warn(`[MOCK] Collection: ${req.payerPhone} GHS ${req.amount} ref=${req.reference}`);
    return {
      providerReference: `MOCK-COL-${req.reference}`,
      status: 'SUCCESSFUL',
      raw: { mock: true, request: req },
    };
  }

  async disburse(req: DisbursementRequest): Promise<DisbursementResponse> {
    this.logger.warn(`[MOCK] Disburse: → ${req.recipientPhone} GHS ${req.amount} ref=${req.reference}`);
    return {
      providerReference: `MOCK-DIS-${req.reference}`,
      status: 'SUCCESSFUL',
      raw: { mock: true, request: req },
    };
  }

  async getCollectionStatus(providerReference: string): Promise<PaymentStatusResponse> {
    return { providerReference, status: 'SUCCESSFUL', raw: { mock: true } };
  }

  async verifyWebhook(payload: any, _headers: Record<string, string>): Promise<WebhookVerificationResult> {
    const data = typeof payload === 'string' ? JSON.parse(payload) : payload;
    return {
      valid: true,
      providerReference: data.reference || data.providerReference || 'MOCK-WEBHOOK',
      status: 'SUCCESSFUL',
      raw: data,
    };
  }
}
