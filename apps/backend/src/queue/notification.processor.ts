import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Job, Worker } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { PushService } from '../integrations/push/push.service';
import { NOTIFICATION_QUEUE } from './notification-queue.constants';
import { buildRedisConnection } from './redis-connection';
import { JOB_SEND_PUSH, SendPushJobData } from './notification-queue.service';

@Injectable()
export class NotificationProcessor implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(NotificationProcessor.name);
  private worker?: Worker;

  constructor(
    private readonly prisma: PrismaService,
    private readonly pushService: PushService,
    private readonly config: ConfigService,
  ) {}

  onModuleInit() {
    // A failed Redis connection must never take the API down with it: log
    // worker errors and keep serving HTTP. Push delivery is best effort.
    try {
      this.worker = new Worker(NOTIFICATION_QUEUE, (job: Job) => this.process(job), {
        connection: buildRedisConnection(this.config),
      });
      this.worker.on('error', (err) =>
        this.logger.error(`Notification worker error: ${err.message}`),
      );
      this.worker.on('failed', (job, err) =>
        this.logger.warn(`Notification job ${job?.id} failed: ${err.message}`),
      );
    } catch (err: any) {
      this.logger.error(`Could not start notification worker: ${err?.message || err}`);
    }
  }

  async onModuleDestroy() {
    await this.worker?.close().catch(() => undefined);
  }

  async process(job: Job): Promise<void> {
    if (job.name === JOB_SEND_PUSH) {
      await this.handleSendPush(job.data as SendPushJobData);
    }
  }

  private async handleSendPush(data: SendPushJobData) {
    const { userId, title, body, data: extraData } = data;

    // Fetch all active push tokens for this user
    const pushTokens = await this.prisma.pushToken.findMany({
      where: { userId, isActive: true },
      select: { id: true, token: true },
    });

    if (pushTokens.length === 0) {
      this.logger.debug(`[Push] No active tokens for user ${userId} — skipping`);
      return;
    }

    const tokens = pushTokens.map((t) => t.token);
    const result = await this.pushService.send({ tokens, title, body, data: extraData });

    // Deactivate tokens that are no longer valid (device unregistered)
    if (result.invalidTokens.length > 0) {
      await this.prisma.pushToken.updateMany({
        where: { token: { in: result.invalidTokens } },
        data: { isActive: false },
      });
      this.logger.log(
        `[Push] Deactivated ${result.invalidTokens.length} stale tokens for user ${userId}`,
      );
    }

    this.logger.log(
      `[Push] user=${userId} sent=${result.sent} failed=${result.failed}`,
    );
  }
}
