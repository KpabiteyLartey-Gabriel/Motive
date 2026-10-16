import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';
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
 * MTN Direct P2P Provider
 *
 * Uses two separate MTN MoMo APIs:
 *   - Collections API  → debit driver's wallet (request to pay)
 *   - Disbursements API → credit owner's wallet (transfer to payee)
 *
 * Money flow:
 *   Driver's MTN wallet → MTN Collections → +Motive float → MTN Disbursements → Owner's MTN wallet
 *
 * Note: Telecel Cash and AirtelTigo wallets are NOT directly supported via this provider.
 * For multi-network support, use the HubtelDirectPayProvider.
 *
 * API docs: https://momodeveloper.mtn.com/
 *
 * Required env vars:
 *   MTN_ENVIRONMENT                   sandbox | production
 *   MTN_COLLECTION_PRIMARY_KEY
 *   MTN_COLLECTION_API_USER_ID
 *   MTN_COLLECTION_API_KEY
 *   MTN_DISBURSEMENT_PRIMARY_KEY
 *   MTN_DISBURSEMENT_API_USER_ID
 *   MTN_DISBURSEMENT_API_KEY
 *   MTN_COLLECTION_CALLBACK_URL
 *   MTN_DISBURSEMENT_CALLBACK_URL
 */
@Injectable()
export class MTNDirectP2PProvider implements IPaymentProvider {
  readonly name = 'MTN_DIRECT_P2P' as const;
  readonly isDirectPay = false; // collect and disburse are two separate calls

  private readonly logger = new Logger(MTNDirectP2PProvider.name);
  private readonly environment: string;

  // Collections API client
  private readonly collectionClient: AxiosInstance;
  private readonly collectionPrimaryKey: string;
  private readonly collectionUserId: string;
  private readonly collectionApiKey: string;
  private readonly collectionCallbackUrl: string;

  // Disbursements API client
  private readonly disbursementClient: AxiosInstance;
  private readonly disbursementPrimaryKey: string;
  private readonly disbursementUserId: string;
  private readonly disbursementApiKey: string;

  constructor(private readonly config: ConfigService) {
    this.environment = this.config.get<string>('MTN_ENVIRONMENT', 'sandbox');

    const baseUrl = this.environment === 'production'
      ? 'https://proxy.momoapi.mtn.com'
      : 'https://sandbox.momodeveloper.mtn.com';

    this.collectionPrimaryKey = this.config.get<string>('MTN_COLLECTION_PRIMARY_KEY', '');
    this.collectionUserId     = this.config.get<string>('MTN_COLLECTION_API_USER_ID', '');
    this.collectionApiKey     = this.config.get<string>('MTN_COLLECTION_API_KEY', '');
    this.collectionCallbackUrl = this.config.get<string>(
      'MTN_COLLECTION_CALLBACK_URL',
      'http://localhost:3001/api/v1/payments/webhooks/mtn',
    );

    this.disbursementPrimaryKey = this.config.get<string>('MTN_DISBURSEMENT_PRIMARY_KEY', '');
    this.disbursementUserId     = this.config.get<string>('MTN_DISBURSEMENT_API_USER_ID', '');
    this.disbursementApiKey     = this.config.get<string>('MTN_DISBURSEMENT_API_KEY', '');

    this.collectionClient = axios.create({
      baseURL: `${baseUrl}/collection/v1_0`,
      timeout: 30_000,
    });

    this.disbursementClient = axios.create({
      baseURL: `${baseUrl}/disbursement/v1_0`,
      timeout: 30_000,
    });
  }

  // ── Collection (debit driver's MTN wallet) ─────────────────
  async requestCollection(req: CollectionRequest): Promise<CollectionResponse> {
    this.logger.log(`[MTN] Collection: ${req.payerPhone} GHS ${req.amount} ref=${req.reference}`);

    try {
      const token = await this.getCollectionToken();
      const externalId = req.reference;

      await this.collectionClient.post(
        '/requesttopay',
        {
          amount: String(req.amount),
          currency: 'GHS',
          externalId,
          payer: {
            partyIdType: 'MSISDN',
            partyId: this.normalisePhone(req.payerPhone),
          },
          payerMessage: req.description,
          payeeNote: req.description,
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'X-Reference-Id': externalId,
            'X-Target-Environment': this.environment,
            'Ocp-Apim-Subscription-Key': this.collectionPrimaryKey,
            'X-Callback-Url': this.collectionCallbackUrl,
          },
        },
      );

      // MTN returns 202 Accepted — status is async via callback
      return {
        providerReference: externalId,
        status: 'PENDING',
        raw: { externalId, message: 'Request to pay initiated' },
      };
    } catch (err) {
      this.logger.error('[MTN] Collection failed', err?.response?.data || err.message);
      return {
        providerReference: req.reference,
        status: 'FAILED',
        raw: err?.response?.data,
      };
    }
  }

  // ── Disburse (credit owner's MTN wallet) ───────────────────
  async disburse(req: DisbursementRequest): Promise<DisbursementResponse> {
    this.logger.log(`[MTN] Disburse: → ${req.recipientPhone} GHS ${req.amount} ref=${req.reference}`);

    try {
      const token = await this.getDisbursementToken();
      const externalId = req.reference;

      await this.disbursementClient.post(
        '/transfer',
        {
          amount: String(req.amount),
          currency: 'GHS',
          externalId,
          payee: {
            partyIdType: 'MSISDN',
            partyId: this.normalisePhone(req.recipientPhone),
          },
          payerMessage: req.description,
          payeeNote: req.description,
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'X-Reference-Id': externalId,
            'X-Target-Environment': this.environment,
            'Ocp-Apim-Subscription-Key': this.disbursementPrimaryKey,
          },
        },
      );

      return {
        providerReference: externalId,
        status: 'PENDING',
        raw: { externalId, message: 'Transfer initiated' },
      };
    } catch (err) {
      this.logger.error('[MTN] Disburse failed', err?.response?.data || err.message);
      return { providerReference: req.reference, status: 'FAILED', raw: err?.response?.data };
    }
  }

  // ── Status poll ────────────────────────────────────────────
  async getCollectionStatus(providerReference: string): Promise<PaymentStatusResponse> {
    try {
      const token = await this.getCollectionToken();
      const res = await this.collectionClient.get(`/requesttopay/${providerReference}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'X-Target-Environment': this.environment,
          'Ocp-Apim-Subscription-Key': this.collectionPrimaryKey,
        },
      });

      const data = res.data;
      return {
        providerReference,
        status: this.mapStatus(data.status),
        amount: data.amount ? Number(data.amount) : undefined,
        raw: data,
      };
    } catch (err) {
      this.logger.error('[MTN] Status poll failed', err?.response?.data || err.message);
      return { providerReference, status: 'PENDING', raw: err?.response?.data };
    }
  }

  // ── Webhook verification ────────────────────────────────────
  async verifyWebhook(payload: any, headers: Record<string, string>): Promise<WebhookVerificationResult> {
    // MTN sandbox does not sign webhooks with HMAC.
    // In production, validate the notification against your subscription key and
    // cross-check by polling getCollectionStatus for the referenceId.
    const data = typeof payload === 'string' ? JSON.parse(payload) : payload;

    const status = this.mapStatus(data.status);
    const providerReference = data.externalId || data.referenceId || '';

    this.logger.log(`[MTN] Webhook received: status=${data.status} ref=${providerReference}`);

    return {
      valid: true, // MTN sandbox: accept all; production: verify via status poll
      providerReference,
      status: status === 'PENDING' ? 'FAILED' : status,
      amount: data.amount ? Number(data.amount) : undefined,
      raw: data,
    };
  }

  // ── Token helpers ──────────────────────────────────────────
  private async getCollectionToken(): Promise<string> {
    const res = await axios.post(
      `${this.collectionClient.defaults.baseURL?.replace('/collection/v1_0', '')}/collection/token/`,
      {},
      {
        headers: {
          Authorization: `Basic ${Buffer.from(`${this.collectionUserId}:${this.collectionApiKey}`).toString('base64')}`,
          'Ocp-Apim-Subscription-Key': this.collectionPrimaryKey,
        },
      },
    );
    return res.data.access_token;
  }

  private async getDisbursementToken(): Promise<string> {
    const res = await axios.post(
      `${this.disbursementClient.defaults.baseURL?.replace('/disbursement/v1_0', '')}/disbursement/token/`,
      {},
      {
        headers: {
          Authorization: `Basic ${Buffer.from(`${this.disbursementUserId}:${this.disbursementApiKey}`).toString('base64')}`,
          'Ocp-Apim-Subscription-Key': this.disbursementPrimaryKey,
        },
      },
    );
    return res.data.access_token;
  }

  private normalisePhone(phone: string): string {
    const cleaned = phone.replace(/\s+/g, '').replace(/^\+/, '');
    if (cleaned.startsWith('0')) return `233${cleaned.substring(1)}`;
    if (cleaned.startsWith('233')) return cleaned;
    return `233${cleaned}`;
  }

  private mapStatus(mtnStatus: string): 'PENDING' | 'SUCCESSFUL' | 'FAILED' {
    switch (mtnStatus?.toUpperCase()) {
      case 'SUCCESSFUL': return 'SUCCESSFUL';
      case 'FAILED':
      case 'REJECTED':
      case 'TIMEOUT':   return 'FAILED';
      default:          return 'PENDING';
    }
  }
}
