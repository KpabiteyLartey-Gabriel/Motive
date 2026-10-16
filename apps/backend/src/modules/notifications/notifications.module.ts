import { Module } from '@nestjs/common';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { SmsIntegrationModule } from '../../integrations/sms/sms-integration.module';
import { NotificationQueueModule } from '../../queue/notification-queue.module';
import { MessagingModule } from '../messaging/messaging.module';

@Module({
  imports: [SmsIntegrationModule, NotificationQueueModule, MessagingModule],
  controllers: [NotificationsController],
  providers: [NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
