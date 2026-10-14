import {
  Controller, Get, Patch, Param, Query, UseGuards, HttpCode,
  HttpStatus, Post, Body, Delete,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RegisterPushTokenDto } from './dto/register-push-token.dto';

@ApiTags('Notifications')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  @ApiOperation({ summary: 'Get my notifications' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'unreadOnly', required: false })
  async findMine(
    @CurrentUser() user: any,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('unreadOnly') unreadOnly?: boolean,
  ) {
    return this.notificationsService.findForUser(user.id, { page, limit, unreadOnly });
  }

  @Patch(':id/read')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Mark notification as read' })
  async markRead(@Param('id') id: string, @CurrentUser() user: any) {
    return this.notificationsService.markRead(id, user.id);
  }

  @Post('read-all')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Mark all notifications as read' })
  async markAllRead(@CurrentUser() user: any) {
    return this.notificationsService.markAllRead(user.id);
  }

  // ── Push token management ──────────────────────────────────

  @Post('push-token')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Register an Expo push token for this device' })
  async registerPushToken(@CurrentUser() user: any, @Body() dto: RegisterPushTokenDto) {
    return this.notificationsService.registerPushToken(
      user.id, dto.token, dto.platform, dto.deviceId,
    );
  }

  @Delete('push-token/:token')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Deactivate a push token (logout / permission revoked)' })
  async deactivatePushToken(@CurrentUser() user: any, @Param('token') token: string) {
    return this.notificationsService.deactivatePushToken(user.id, token);
  }
}
