/**
 * GH Motive — SMS Provider interface
 *
 * Any SMS provider (Arkesel, Mock) must implement this contract.
 * The NotificationsService only depends on this interface.
 */

export interface SmsSendRequest {
  /** Recipient phone number — Ghanaian format e.g. 0244000000 or +233244000000 */
  to: string;
  /** Message body (max 160 chars for single SMS, 459 for triple) */
  message: string;
  /** Optional sender ID shown on recipient's phone (must be pre-registered with provider) */
  senderId?: string;
  /** Platform reference for idempotency / audit */
  reference?: string;
}

export interface SmsSendResponse {
  /** Whether the API accepted the request */
  success: boolean;
  /** Provider's message ID or reference */
  messageId?: string;
  /** Provider status string */
  status?: string;
  /** Raw provider response for audit / debugging */
  raw?: any;
}

export interface ISmsProvider {
  readonly name: string;
  send(req: SmsSendRequest): Promise<SmsSendResponse>;
}
