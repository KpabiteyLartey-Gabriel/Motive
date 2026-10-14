import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { NotificationQueueService } from './notification-queue.service';
import { NotificationProcessor } from './notification.processor';
import { PushIntegrationModule } from '../integrations/push/push-integration.module';
import { NOTIFICATION_QUEUE } from './notification-queue.constants';

export { NOTIFICATION_QUEUE };

@Module({
  imports: [
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: {
          host: config.get<string>('REDIS_HOST', 'localhost'),
          port: config.get<number>('REDIS_PORT', 6379),
          password: config.get<string>('REDIS_PASSWORD') || undefined,
        },
      }),
    }),
    BullModule.registerQueue({ name: NOTIFICATION_QUEUE }),
    PushIntegrationModule,
  ],
  providers: [NotificationQueueService, NotificationProcessor],
  exports: [NotificationQueueService],
})
export class NotificationQueueModule {}
