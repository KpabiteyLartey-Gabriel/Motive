import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';
import * as crypto from 'crypto';
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
 * Hubtel DirectPay Provider
 *
 * Hubtel DirectPay debits the payer's MoMo wallet and credits the recipient's
 * MoMo wallet in a single API call. Money goes directly from driver to owner —
 * GH Motive is never the financial intermediary.
 *
 * API docs: https://developers.hubtel.com/docs/directpay
 *
 * Required env vars:
 *   HUBTEL_CLIENT_ID
 *   HUBTEL_CLIENT_SECRET
 *   HUBTEL_SENDER_ID         ← your registered business short code / wallet
 *   HUBTEL_CALLBACK_URL      ← e.g. https://api.ghmotive.com/api/v1/payments/webhooks/hubtel
 */
@Injectable()
export class HubtelDirectPayProvider implements IPaymentProvider {
  readonly name = 'HUBTEL_DIRECTPAY' as const;
  readonly isDirectPay = true;

  private readonly logger = new Logger(HubtelDirectPayProvider.name);
  private readonly client: AxiosInstance;
  private readonly senderId: string;
  private readonly callbackUrl: string;
  private readonly clientSecret: string;

  constructor(private readonly config: ConfigService) {
    const clientId = this.config.get<string>('HUBTEL_CLIENT_ID');
    this.clientSecret = this.config.get<string>('HUBTEL_CLIENT_SECRET');
    this.senderId = this.config.get<string>('HUBTEL_SENDER_ID', 'GHMotive');
    this.callbackUrl = this.config.get<string>(
      'HUBTEL_CALLBACK_URL',
      'http://localhost:3001/api/v1/payments/webhooks/hubtel',
    );

    this.client = axios.create({
      baseURL: 'https://api.hubtel.com/v1/merchantaccount/merchants',
      timeout: 30_000,
      headers: {
        Authorization: `Basic ${Buffer.from(`${clientId}:${this.clientSecret}`).toString('base64')}`,
        'Content-Type': 'application/json',
      },
    });
  }

  // ── Collection (debit driver + credit owner in one call) ────
  async requestCollection(req: CollectionRequest): Promise<CollectionResponse> {
    this.logger.log(`[Hubtel] DirectPay collection: ${req.payerPhone} → ${req.recipientPhone} GHS ${req.amount}`);

    try {
      const payload = {
        CustomerName: 'Driver',
        CustomerMsisdn: this.normalisePhone(req.payerPhone),
        CustomerEmail: '',
        Channel: this.detectChannel(req.payerPhone),
        Amount: req.amount,
        PrimaryCallbackUrl: this.callbackUrl,
        SecondaryCallbackUrl: this.callbackUrl,
        ClientReference: req.reference,
        Description: req.description,
        // DirectPay — recipient receives the money directly
        ...(req.recipientPhone ? {
          RecipientMsisdn: this.normalisePhone(req.recipientPhone),
          RecipientName: req.recipientName || 'Owner',
        } : {}),
      };

      const res = await this.client.post(`/receive-money`, payload);
      const data = res.data;

      this.logger.log(`[Hubtel] Response: ${JSON.stringify(data)}`);

      return {
        providerReference: data.Data?.TransactionId || data.TransactionId || req.reference,
        status: this.mapStatus(data.ResponseCode),
        raw: data,
      };
    } catch (err) {
      this.logger.error('[Hubtel] Collection failed', err?.response?.data || err.message);
      return {
        providerReference: req.reference,
        status: 'FAILED',
        raw: err?.response?.data,
      };
    }
  }

  // ── Disburse (not needed for DirectPay — included for interface) ─
  async disburse(req: DisbursementRequest): Promise<DisbursementResponse> {
    // DirectPay handles this in requestCollection; this path covers edge cases
    this.logger.log(`[Hubtel] Standalone disburse: → ${req.recipientPhone} GHS ${req.amount}`);

    try {
      const payload = {
        RecipientMsisdn: this.normalisePhone(req.recipientPhone),
        Amount: req.amount,
        ClientReference: req.reference,
        Description: req.description,
      };

      const res = await this.client.post(`/send-money`, payload);
      const data = res.data;

      return {
        providerReference: data.Data?.TransactionId || data.TransactionId || req.reference,
        status: this.mapStatus(data.ResponseCode),
        raw: data,
      };
    } catch (err) {
      this.logger.error('[Hubtel] Disburse failed', err?.response?.data || err.message);
      return { providerReference: req.reference, status: 'FAILED', raw: err?.response?.data };
    }
  }

  // ── Status poll ────────────────────────────────────────────
  async getCollectionStatus(providerReference: string): Promise<PaymentStatusResponse> {
    try {
      const res = await this.client.get(`/transaction/status/${providerReference}`);
      const data = res.data;
      return {
        providerReference,
        status: this.mapStatus(data.ResponseCode),
        amount: data.Data?.Amount,
        raw: data,
      };
    } catch (err) {
      this.logger.error('[Hubtel] Status poll failed', err?.response?.data || err.message);
      return { providerReference, status: 'PENDING', raw: err?.response?.data };
    }
  }

  // ── Webhook verification ────────────────────────────────────
  async verifyWebhook(payload: any, headers: Record<string, string>): Promise<WebhookVerificationResult> {
    // Hubtel sends X-Hubtel-Signature header as HMAC-SHA256 of the raw body
    const signature = headers['x-hubtel-signature'] || headers['X-Hubtel-Signature'] || '';
    const rawBody = typeof payload === 'string' ? payload : JSON.stringify(payload);
    const expected = crypto
      .createHmac('sha256', this.clientSecret)
      .update(rawBody)
      .digest('hex');

    const valid = crypto.timingSafeEqual(
      Buffer.from(signature, 'hex'),
      Buffer.from(expected, 'hex'),
    );

    const data = typeof payload === 'string' ? JSON.parse(payload) : payload;

    const mappedStatus = this.mapStatus(data.ResponseCode);
    return {
      valid,
      providerReference: data.Data?.TransactionId || data.TransactionId || '',
      status: mappedStatus === 'PENDING' ? 'FAILED' : mappedStatus,
      amount: data.Data?.Amount,
      raw: data,
    };
  }

  // ── Helpers ────────────────────────────────────────────────
  private normalisePhone(phone: string): string {
    // Convert 0244000000 → 233244000000
    const cleaned = phone.replace(/\s+/g, '').replace(/^\+/, '');
    if (cleaned.startsWith('0')) return `233${cleaned.substring(1)}`;
    if (cleaned.startsWith('233')) return cleaned;
    return `233${cleaned}`;
  }

  private detectChannel(phone: string): string {
    const cleaned = phone.replace(/\D/g, '');
    const prefix = cleaned.startsWith('0') ? cleaned.substring(1, 3) : cleaned.substring(3, 5);
    const mtn = ['24', '54', '55', '59'];
    const telecel = ['50', '20'];
    if (mtn.includes(prefix)) return 'MTN';
    if (telecel.includes(prefix)) return 'Telecel';
    return 'AirtelTigo';
  }

  private mapStatus(responseCode: string | number): 'PENDING' | 'SUCCESSFUL' | 'FAILED' {
    const code = String(responseCode);
    // Hubtel 0000 = success, 0001 = pending, anything else = failed
    if (code === '0000' || code === '00') return 'SUCCESSFUL';
    if (code === '0001' || code === '100' || code === '1000') return 'PENDING';
    return 'FAILED';
  }
}
