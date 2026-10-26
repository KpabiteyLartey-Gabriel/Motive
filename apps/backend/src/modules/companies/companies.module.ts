import { Module } from '@nestjs/common';
import { CompaniesController, InvitesController } from './companies.controller';
import { CompaniesService } from './companies.service';
import { SmsIntegrationModule } from '../../integrations/sms/sms-integration.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { MessagingModule } from '../messaging/messaging.module';

@Module({
  imports: [SmsIntegrationModule, NotificationsModule, MessagingModule],
  controllers: [CompaniesController, InvitesController],
  providers: [CompaniesService],
  exports: [CompaniesService],
})
export class CompaniesModule {}
