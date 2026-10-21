import { Inject, Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { Queue } from 'bullmq';
import { NOTIFICATION_QUEUE_TOKEN } from './notification-queue.constants';

export const JOB_SEND_PUSH = 'send-push';

export interface SendPushJobData {
  userId: string;
  title: string;
  body: string;
  type: string;
  data?: Record<string, any>;
}

@Injectable()
export class NotificationQueueService implements OnModuleDestroy {
  private readonly logger = new Logger(NotificationQueueService.name);

  constructor(
    @Inject(NOTIFICATION_QUEUE_TOKEN) private readonly queue: Queue,
  ) {}

  async onModuleDestroy() {
    await this.queue.close().catch(() => undefined);
  }

  /**
   * Enqueue a push notification delivery job for a single user.
   */
  async enqueuePush(payload: SendPushJobData) {
    await this.queue.add(JOB_SEND_PUSH, payload, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 5_000 },
      removeOnComplete: true,
      removeOnFail: 1_000,
    });
    this.logger.debug(`[Queue] Enqueued push for user ${payload.userId}`);
  }

  /**
   * Enqueue push notifications for multiple users in batch.
   */
  async enqueuePushBulk(userIds: string[], payload: Omit<SendPushJobData, 'userId'>) {
    const jobs = userIds.map((userId) => ({
      name: JOB_SEND_PUSH,
      data: { ...payload, userId },
      opts: {
        attempts: 3,
        backoff: { type: 'exponential' as const, delay: 5_000 },
        removeOnComplete: true,
        removeOnFail: 1_000,
      },
    }));

    await this.queue.addBulk(jobs);
    this.logger.debug(`[Queue] Enqueued ${jobs.length} push jobs`);
  }
}
