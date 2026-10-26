import { Module } from '@nestjs/common';
import { ContractsController } from './contracts.controller';
import { ContractsService } from './contracts.service';
import { AuditModule } from '../audit/audit.module';
import { MessagingModule } from '../messaging/messaging.module';

@Module({
  imports: [AuditModule, MessagingModule],
  controllers: [ContractsController],
  providers: [ContractsService],
  exports: [ContractsService],
})
export class ContractsModule {}
