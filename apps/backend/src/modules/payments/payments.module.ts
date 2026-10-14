import { Module } from '@nestjs/common';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { AuditModule } from '../audit/audit.module';
import { PaymentIntegrationModule } from '../../integrations/payments/payment-integration.module';

@Module({
  imports: [AuditModule, PaymentIntegrationModule],
  controllers: [PaymentsController],
  providers: [PaymentsService],
  exports: [PaymentsService],
})
export class PaymentsModule {}
