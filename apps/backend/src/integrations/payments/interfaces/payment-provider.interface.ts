/**
 * GH Motive — PaymentProvider interface
 *
 * Every payment provider (Hubtel, MTN, Mock) must implement this contract.
 * Business logic in PaymentsService only depends on this interface — never on
 * a concrete provider directly.
 */

export type PaymentProviderName = 'HUBTEL_DIRECTPAY' | 'MTN_DIRECT_P2P' | 'MOCK';

// ── Shared types ─────────────────────────────────────────────────────────────

export interface CollectionRequest {
  /** Payer's MoMo phone number e.g. 0244000000 */
  payerPhone: string;
  /** Amount in GHS */
  amount: number;
  /** Platform-generated idempotency key */
  reference: string;
  /** Human-readable description shown on payer's phone */
  description: string;
  /** Recipient MoMo number (used by DirectPay providers) */
  recipientPhone?: string;
  /** Recipient name (used by DirectPay providers) */
  recipientName?: string;
}

export interface CollectionResponse {
  /** Provider's transaction/reference ID */
  providerReference: string;
  /** Initial status returned by provider */
  status: 'PENDING' | 'SUCCESSFUL' | 'FAILED';
  /** Raw provider response for audit/debugging */
  raw?: any;
}

export interface DisbursementRequest {
  /** Recipient's MoMo phone number */
  recipientPhone: string;
  /** Amount in GHS */
  amount: number;
  /** Platform-generated idempotency reference */
  reference: string;
  /** Reason shown to recipient */
  description: string;
}

export interface DisbursementResponse {
  providerReference: string;
  status: 'PENDING' | 'SUCCESSFUL' | 'FAILED';
  raw?: any;
}

export interface PaymentStatusResponse {
  providerReference: string;
  status: 'PENDING' | 'SUCCESSFUL' | 'FAILED';
  amount?: number;
  raw?: any;
}

export interface WebhookVerificationResult {
  valid: boolean;
  providerReference: string;
  status: 'SUCCESSFUL' | 'FAILED';
  amount?: number;
  raw: any;
}

// ── Provider interface ────────────────────────────────────────────────────────

export interface IPaymentProvider {
  readonly name: PaymentProviderName;

  /**
   * Request payment from payer's MoMo wallet.
   * For DirectPay providers this also credits the recipient in the same call.
   * For collect-only providers this only debits the payer.
   */
  requestCollection(req: CollectionRequest): Promise<CollectionResponse>;

  /**
   * Disburse money to a recipient's MoMo wallet.
   * Used for settlement when the provider does NOT do DirectPay.
   */
  disburse(req: DisbursementRequest): Promise<DisbursementResponse>;

  /**
   * Poll the provider for the current status of a transaction.
   */
  getCollectionStatus(providerReference: string): Promise<PaymentStatusResponse>;

  /**
   * Verify and parse an inbound webhook payload.
   * Returns the parsed result or throws if the signature is invalid.
   */
  verifyWebhook(payload: any, headers: Record<string, string>): Promise<WebhookVerificationResult>;

  /**
   * Whether this provider handles recipient credit in the same collection call.
   * true  → no separate disburse() needed after collection succeeds
   * false → disburse() must be called after successful collection
   */
  readonly isDirectPay: boolean;
}
