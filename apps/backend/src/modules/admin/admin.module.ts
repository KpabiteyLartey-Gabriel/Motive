import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { AuditModule } from '../audit/audit.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { AccountsModule } from '../accounts/accounts.module';

@Module({
  imports: [AuditModule, NotificationsModule, AccountsModule],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
