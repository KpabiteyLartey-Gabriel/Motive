import { Logger, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';
import { NotificationQueueService } from './notification-queue.service';
import { NotificationProcessor } from './notification.processor';
import { PushIntegrationModule } from '../integrations/push/push-integration.module';
import { NOTIFICATION_QUEUE, NOTIFICATION_QUEUE_TOKEN } from './notification-queue.constants';
import { buildRedisConnection } from './redis-connection';

export { NOTIFICATION_QUEUE };

// The queue is built on the `bullmq` package directly (CommonJS). The
// `@nestjs/bullmq` wrapper is ESM-only and crashes when required from this
// CommonJS app on some runtimes (ERR_REQUIRE_ESM on Vercel), which took the
// whole API down at startup.
@Module({
  imports: [ConfigModule, PushIntegrationModule],
  providers: [
    {
      provide: NOTIFICATION_QUEUE_TOKEN,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const queue = new Queue(NOTIFICATION_QUEUE, {
          connection: buildRedisConnection(config),
        });
        queue.on('error', (err) =>
          new Logger('NotificationQueue').error(`Notification queue error: ${err.message}`),
        );
        return queue;
      },
    },
    NotificationQueueService,
    NotificationProcessor,
  ],
  exports: [NotificationQueueService],
})
export class NotificationQueueModule {}
