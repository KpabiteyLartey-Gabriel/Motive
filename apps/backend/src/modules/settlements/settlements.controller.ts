import {
  Controller, Get, Post, Query, UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { SettlementsService } from './settlements.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('Settlements')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
@Controller('settlements')
export class SettlementsController {
  constructor(private readonly settlementsService: SettlementsService) {}

  @Get()
  @ApiOperation({ summary: 'List settlement transactions (Admin)' })
  async findAll(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('status') status?: string,
    @Query('contractId') contractId?: string,
  ) {
    return this.settlementsService.findAll({ page, limit, status, contractId });
  }

  @Post('process')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Trigger settlement processing (Admin)' })
  async process(@CurrentUser() user: any) {
    return this.settlementsService.processPendingSettlements(user.id);
  }
}
