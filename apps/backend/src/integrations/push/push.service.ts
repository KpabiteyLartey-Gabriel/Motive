import { Injectable, Logger } from '@nestjs/common';
import type { ExpoPushMessage, ExpoPushTicket } from 'expo-server-sdk';

// expo-server-sdk ships as ESM only. Requiring it from this CommonJS app
// crashes startup on runtimes without require-of-ESM (ERR_REQUIRE_ESM on
// Vercel took the whole API down), so it is loaded lazily with a native
// dynamic import the first time a push is actually sent.
const nativeImport = new Function('specifier', 'return import(specifier)') as (
  specifier: string,
) => Promise<any>;

export function isExpoPushToken(token: string): boolean {
  return typeof token === 'string' && /^Expo(nent)?PushToken\[.+\]$/.test(token);
}

export interface PushSendRequest {
  tokens: string[];
  title: string;
  body: string;
  data?: Record<string, any>;
  badge?: number;
}

export interface PushSendResult {
  sent: number;
  failed: number;
  invalidTokens: string[];
}

@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);
  private expoClientPromise?: Promise<any>;

  private getExpoClient(): Promise<any> {
    if (!this.expoClientPromise) {
      this.expoClientPromise = nativeImport('expo-server-sdk').then((mod) => {
        const ExpoCtor = mod?.default ?? mod;
        return new ExpoCtor();
      });
    }
    return this.expoClientPromise;
  }

  /**
   * Send push notifications to one or more Expo push tokens.
   * Returns a summary and the list of tokens that are no longer valid.
   */
  async send(req: PushSendRequest): Promise<PushSendResult> {
    const validTokens = req.tokens.filter((t) => {
      const ok = isExpoPushToken(t);
      if (!ok) this.logger.warn(`[Push] Invalid token skipped: ${t}`);
      return ok;
    });

    if (validTokens.length === 0) {
      return { sent: 0, failed: 0, invalidTokens: req.tokens };
    }

    let expo: any;
    try {
      expo = await this.getExpoClient();
    } catch (err) {
      // Push is best effort — never fail the caller because the SDK or the
      // push service is unavailable.
      this.logger.error('[Push] Could not load Expo SDK — skipping push send', err as any);
      return { sent: 0, failed: validTokens.length, invalidTokens: [] };
    }

    const messages: ExpoPushMessage[] = validTokens.map((token) => ({
      to: token,
      title: req.title,
      body: req.body,
      data: req.data,
      badge: req.badge,
      sound: 'default',
    }));

    const chunks = expo.chunkPushNotifications(messages);
    const allTickets: ExpoPushTicket[] = [];

    for (const chunk of chunks) {
      try {
        const tickets = await expo.sendPushNotificationsAsync(chunk);
        allTickets.push(...tickets);
      } catch (err) {
        this.logger.error('[Push] Chunk send failed', err);
      }
    }

    const invalidTokens: string[] = [];
    let failed = 0;

    allTickets.forEach((ticket, i) => {
      if (ticket.status === 'error') {
        failed++;
        this.logger.warn(`[Push] Ticket error: ${ticket.message} (details: ${JSON.stringify(ticket.details)})`);
        // DeviceNotRegistered means the token is stale — caller should deactivate it
        if ((ticket.details as any)?.error === 'DeviceNotRegistered') {
          invalidTokens.push(validTokens[i]);
        }
      }
    });

    const sent = allTickets.filter((t) => t.status === 'ok').length;
    this.logger.log(`[Push] Sent ${sent}/${validTokens.length} — ${failed} errors`);

    return { sent, failed, invalidTokens };
  }
}
