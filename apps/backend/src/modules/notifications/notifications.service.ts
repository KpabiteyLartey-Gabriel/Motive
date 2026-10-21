import { Injectable, Logger, Inject } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationChannel, NotificationStatus } from '@prisma/client';
import { type ISmsProvider } from '../../integrations/sms/interfaces/sms-provider.interface';
import { SMS_PROVIDER } from '../../integrations/sms/sms-integration.module';
import { NotificationQueueService } from '../../queue/notification-queue.service';
import { MessagingService } from '../messaging/messaging.service';
import { isExpoPushToken } from '../../integrations/push/push.service';

export interface SendNotificationParams {
  userId: string;
  channel: NotificationChannel;
  type: string;
  subject?: string;
  body: string;
  data?: Record<string, any>;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(SMS_PROVIDER) private readonly smsProvider: ISmsProvider,
    private readonly queueService: NotificationQueueService,
    private readonly messaging: MessagingService,
  ) {}

  // ── Send ───────────────────────────────────────────────────
  async send(params: SendNotificationParams) {
    const notification = await this.prisma.notification.create({
      data: {
        userId:  params.userId,
        channel: params.channel,
        type:    params.type,
        subject: params.subject,
        body:    params.body,
        data:    params.data,
        status:  NotificationStatus.PENDING,
      },
    });

    let delivered = false;

    try {
      if (params.channel === NotificationChannel.SMS) {
        delivered = await this.sendSms(params.userId, params.body);
      } else if (params.channel === NotificationChannel.EMAIL) {
        delivered = await this.sendEmail(params.userId, params.subject || '+Motive', params.body, params.data);
      } else if (params.channel === NotificationChannel.PUSH) {
        // Enqueue async push delivery via BullMQ
        await this.queueService.enqueuePush({
          userId: params.userId,
          title:  params.subject || '+Motive',
          body:   params.body,
          type:   params.type,
          data:   params.data,
        });
        delivered = true; // job enqueued successfully
      } else {
        // IN_APP, EMAIL — persisted in DB (client polls / future email service)
        delivered = true;
      }
    } catch (err) {
      this.logger.error(`Delivery failed for notification ${notification.id}`, err);
    }

    await this.prisma.notification.update({
      where: { id: notification.id },
      data: {
        status:  delivered ? NotificationStatus.SENT : NotificationStatus.FAILED,
        sentAt:  delivered ? new Date() : undefined,
      },
    });

    return notification;
  }

  // ── Send to multiple users ─────────────────────────────────
  async sendBulk(userIds: string[], params: Omit<SendNotificationParams, 'userId'>) {
    for (const userId of userIds) {
      await this.send({ ...params, userId }).catch((err) =>
        this.logger.error(`Bulk notification failed for user ${userId}`, err),
      );
    }
  }

  // ── SMS delivery (MessagingService: Arkesel template URL / v2 / mock) ──
  private async sendSms(userId: string, message: string): Promise<boolean> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { phone: true },
    });

    if (!user?.phone) {
      this.logger.warn(`[SMS] User ${userId} has no phone number — skipping SMS delivery`);
      return false;
    }

    const result = await this.messaging.sendSms(user.phone, message);
    if (!result.delivered) {
      const fallback = await this.smsProvider.send({ to: user.phone, message }).catch(() => null);
      if (fallback?.success) return true;
      this.logger.warn(`[SMS] Delivery failed for user ${userId}: ${result.detail || ''}`);
    }
    return result.delivered;
  }

  // ── Email delivery (MessagingService: SMTP / mock) ───────────

  private async sendEmail(userId: string, subject: string, body: string, data?: Record<string, any>): Promise<boolean> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, firstName: true },
    });
    if (!user?.email) {
      this.logger.warn(`[Email] User ${userId} has no email — skipping email delivery`);
      return false;
    }
    const result = await this.messaging.sendEmail(user.email, subject, body, data?.html);
    return result.delivered;
  }

  // ── Convenience helpers used by other modules ──────────────

  async sendSmsToPhone(phone: string, message: string): Promise<boolean> {
    const result = await this.smsProvider.send({ to: phone, message });
    if (!result.success) {
      this.logger.warn(`[SMS] Direct send failed to ${phone}: ${JSON.stringify(result.raw)}`);
    }
    return result.success;
  }

  // ── Push token registration ────────────────────────────────

  async registerPushToken(userId: string, token: string, platform: string, deviceId?: string) {
    if (!isExpoPushToken(token)) {
      this.logger.warn(`[Push] registerPushToken called with invalid token for user ${userId}`);
      return null;
    }

    return this.prisma.pushToken.upsert({
      where: { token },
      update: { userId, platform, deviceId, isActive: true },
      create: { userId, token, platform, deviceId, isActive: true },
    });
  }

  async deactivatePushToken(userId: string, token: string) {
    await this.prisma.pushToken.updateMany({
      where: { userId, token },
      data: { isActive: false },
    });
  }

  // ── List (user's own) ──────────────────────────────────────
  async findForUser(userId: string, params: { page?: number; limit?: number; unreadOnly?: boolean }) {
    const { page = 1, limit = 30, unreadOnly } = params;
    const skip = (Math.max(1, Math.floor(Number(page)) || 1) - 1) * (Math.max(1, Math.floor(Number(limit)) || 20));
    const where: any = { userId };
    if (unreadOnly) where.readAt = null;

    const [notifications, total] = await this.prisma.$transaction([
      this.prisma.notification.findMany({
        where, skip, take: Math.max(1, Math.floor(Number(limit)) || 20), orderBy: { createdAt: 'desc' },
      }),
      this.prisma.notification.count({ where }),
    ]);

    return { notifications, pagination: { total, page, limit, totalPages: Math.ceil(total / (Math.max(1, Math.floor(Number(limit)) || 20))) } };
  }

  // ── Mark as read ───────────────────────────────────────────
  async markRead(notificationId: string, userId: string) {
    await this.prisma.notification.updateMany({
      where: { id: notificationId, userId },
      data: { readAt: new Date(), status: NotificationStatus.READ },
    });
  }

  // ── Mark all read ──────────────────────────────────────────
  async markAllRead(userId: string) {
    await this.prisma.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date(), status: NotificationStatus.READ },
    });
  }
}
