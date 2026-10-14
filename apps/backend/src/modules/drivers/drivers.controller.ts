import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';

import { DriversService } from './drivers.service';
import { CreateDriverProfileDto } from './dto/create-driver-profile.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('Drivers')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('drivers')
export class DriversController {
  constructor(private readonly driversService: DriversService) {}

  @Post('profile')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create driver profile for current user' })
  async createProfile(
    @CurrentUser() user: any,
    @Body() dto: CreateDriverProfileDto,
  ) {
    return this.driversService.createProfile(user.id, dto);
  }

  @Get('profile')
  @ApiOperation({ summary: 'Get own driver profile' })
  async getMyProfile(@CurrentUser() user: any) {
    return this.driversService.getProfile(user.id);
  }

  @Get()
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.OWNER, UserRole.COMPANY_ADMIN, UserRole.FLEET_MANAGER)
  @ApiOperation({ summary: 'List all drivers' })
  async findAll(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('search') search?: string,
  ) {
    return this.driversService.findAll({ page, limit, search });
  }

  @Get(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.OWNER, UserRole.COMPANY_ADMIN, UserRole.FLEET_MANAGER)
  @ApiOperation({ summary: 'Get driver by ID' })
  async findOne(@Param('id') id: string) {
    return this.driversService.getDriverById(id);
  }
}
