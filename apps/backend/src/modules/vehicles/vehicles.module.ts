import { Module } from '@nestjs/common';
import { VehiclesController } from './vehicles.controller';
import { VehiclesService } from './vehicles.service';
import { OwnershipTransferController } from './ownership-transfer.controller';
import { OwnershipTransferService } from './ownership-transfer.service';
import { AuditModule } from '../audit/audit.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [AuditModule, NotificationsModule],
  controllers: [VehiclesController, OwnershipTransferController],
  providers: [VehiclesService, OwnershipTransferService],
  exports: [VehiclesService, OwnershipTransferService],
})
export class VehiclesModule {}
