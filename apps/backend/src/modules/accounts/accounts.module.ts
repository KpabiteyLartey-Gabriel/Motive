import { Module } from '@nestjs/common';
import { AccountsController } from './accounts.controller';
import { AccountsService } from './accounts.service';
import { AccountCreationService } from './account-creation.service';
import { StorageModule } from '../storage/storage.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { PaymentIntegrationModule } from '../../integrations/payments/payment-integration.module';

@Module({
  imports: [StorageModule, NotificationsModule, PaymentIntegrationModule],
  controllers: [AccountsController],
  providers: [AccountsService, AccountCreationService],
  exports: [AccountsService, AccountCreationService],
})
export class AccountsModule {}
