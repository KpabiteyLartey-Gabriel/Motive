import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { StorageModule } from '../storage/storage.module';
import { MessagingModule } from '../messaging/messaging.module';

@Module({
  imports: [StorageModule, MessagingModule],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
