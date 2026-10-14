import { Module } from '@nestjs/common';
import { CompaniesController, InvitesController } from './companies.controller';
import { CompaniesService } from './companies.service';
import { SmsIntegrationModule } from '../../integrations/sms/sms-integration.module';

@Module({
  imports: [SmsIntegrationModule],
  controllers: [CompaniesController, InvitesController],
  providers: [CompaniesService],
  exports: [CompaniesService],
})
export class CompaniesModule {}
