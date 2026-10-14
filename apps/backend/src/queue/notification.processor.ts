import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { PushService } from '../integrations/push/push.service';
import { NOTIFICATION_QUEUE } from './notification-queue.constants';
import { JOB_SEND_PUSH, SendPushJobData } from './notification-queue.service';

@Processor(NOTIFICATION_QUEUE)
export class NotificationProcessor extends WorkerHost {
  private readonly logger = new Logger(NotificationProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly pushService: PushService,
  ) {
    super();
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
