import { Injectable, Logger } from '@nestjs/common';
import Expo, { ExpoPushMessage, ExpoPushTicket } from 'expo-server-sdk';

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
  private readonly expo = new Expo();

  /**
   * Send push notifications to one or more Expo push tokens.
   * Returns a summary and the list of tokens that are no longer valid.
   */
  async send(req: PushSendRequest): Promise<PushSendResult> {
    const validTokens = req.tokens.filter((t) => {
      const ok = Expo.isExpoPushToken(t);
      if (!ok) this.logger.warn(`[Push] Invalid token skipped: ${t}`);
      return ok;
    });

    if (validTokens.length === 0) {
      return { sent: 0, failed: 0, invalidTokens: req.tokens };
    }

    const messages: ExpoPushMessage[] = validTokens.map((token) => ({
      to: token,
      title: req.title,
      body: req.body,
      data: req.data,
      badge: req.badge,
      sound: 'default',
    }));

    const chunks = this.expo.chunkPushNotifications(messages);
    const allTickets: ExpoPushTicket[] = [];

    for (const chunk of chunks) {
      try {
        const tickets = await this.expo.sendPushNotificationsAsync(chunk);
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
