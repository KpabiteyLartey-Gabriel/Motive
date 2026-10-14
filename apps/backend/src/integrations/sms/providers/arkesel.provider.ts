import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as https from 'https';
import { ISmsProvider, SmsSendRequest, SmsSendResponse } from '../interfaces/sms-provider.interface';

/**
 * Arkesel SMS Provider
 *
 * Uses the Arkesel SMS API v2:
 *   POST https://sms.arkesel.com/api/v2/sms/send
 *
 * API docs: https://developers.arkesel.com
 * Dashboard / credentials: https://sms.arkesel.com
 *
 * Required env vars:
 *   ARKESEL_API_KEY       — API key from your Arkesel account
 *   ARKESEL_SENDER_ID     — Registered sender ID (default: GHMotive)
 *   ARKESEL_SANDBOX       — set to "true" to use sandbox mode (default: false)
 */
@Injectable()
export class ArkeselSmsProvider implements ISmsProvider {
  readonly name = 'ARKESEL';

  private readonly logger = new Logger(ArkeselSmsProvider.name);
  private readonly apiKey: string;
  private readonly senderId: string;
  private readonly sandbox: boolean;
  private readonly baseUrl = 'sms.arkesel.com';

  constructor(private readonly config: ConfigService) {
    this.apiKey   = this.config.get<string>('ARKESEL_API_KEY', '');
    this.senderId = this.config.get<string>('ARKESEL_SENDER_ID', 'GHMotive');
    this.sandbox  = this.config.get<string>('ARKESEL_SANDBOX', 'false') === 'true';
  }

  async send(req: SmsSendRequest): Promise<SmsSendResponse> {
    const to = this.normalisePhone(req.to);
    const body = JSON.stringify({
      sender: req.senderId || this.senderId,
      message: req.message,
      recipients: [to],
      ...(this.sandbox ? { sandbox: 'true' } : {}),
    });

    this.logger.log(`[Arkesel] SMS → ${to} | sandbox=${this.sandbox}`);

    try {
      const data = await this.post('/api/v2/sms/send', body);

      this.logger.log(`[Arkesel] Response: ${JSON.stringify(data)}`);

      const success = data?.status === 'success' || data?.code === '0k' || data?.code === 'ok';
      const messageId = data?.data?.[0]?.id || data?.message_id || undefined;

      return { success, messageId, status: data?.status, raw: data };
    } catch (err) {
      this.logger.error('[Arkesel] SMS send failed', err?.message);
      return { success: false, raw: err?.message };
    }
  }

  // ── Helpers ─────────────────────────────────────────────────

  private normalisePhone(phone: string): string {
    // Normalise to international format: 233244000000
    const cleaned = phone.replace(/[\s\-\(\)]/g, '').replace(/^\+/, '');
    if (cleaned.startsWith('0') && cleaned.length === 10) return `233${cleaned.substring(1)}`;
    if (cleaned.startsWith('233')) return cleaned;
    return `233${cleaned}`;
  }

  private post(path: string, body: string): Promise<any> {
    return new Promise((resolve, reject) => {
      const options = {
        hostname: this.baseUrl,
        port: 443,
        path,
        method: 'POST',
        headers: {
          'api-key': this.apiKey,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
        },
      };

      const req = https.request(options, (res) => {
        let raw = '';
        res.on('data', (chunk) => { raw += chunk; });
        res.on('end', () => {
          try {
            resolve(JSON.parse(raw));
          } catch {
            resolve({ raw });
          }
        });
      });

      req.on('error', reject);
      req.setTimeout(15_000, () => { req.destroy(); reject(new Error('Arkesel request timeout')); });
      req.write(body);
      req.end();
    });
  }
}
