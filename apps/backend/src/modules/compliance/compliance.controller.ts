import {
  Controller, Get, Post, Patch, Body, Param, Query,
  UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { ComplianceService } from './compliance.service';
import { CreateComplianceRecordDto, UpdateComplianceStatusDto } from './dto/compliance.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('Compliance')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('compliance')
export class ComplianceController {
  constructor(private readonly complianceService: ComplianceService) {}

  @Post()
  @ApiOperation({ summary: 'Create a compliance record' })
  create(@Body() dto: CreateComplianceRecordDto, @CurrentUser() user: any) {
    return this.complianceService.create(user.id, dto, user.primaryRole);
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.COMPANY_ADMIN, UserRole.FLEET_MANAGER)
  @ApiOperation({ summary: 'List all compliance records (Admin/Fleet)' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'documentType', required: false })
  @ApiQuery({ name: 'vehicleId', required: false })
  @ApiQuery({ name: 'driverId', required: false })
  listAll(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('status') status?: string,
    @Query('documentType') documentType?: string,
    @Query('vehicleId') vehicleId?: string,
    @Query('driverId') driverId?: string,
  ) {
    return this.complianceService.listAll({ page, limit, status, documentType, vehicleId, driverId });
  }

  @Get('vehicle/:vehicleId')
  @ApiOperation({ summary: 'Get compliance records for a vehicle' })
  listForVehicle(@Param('vehicleId') vehicleId: string, @CurrentUser() user: any) {
    return this.complianceService.listForVehicle(vehicleId, user.id, user.primaryRole);
  }

  @Get('driver/:driverId')
  @ApiOperation({ summary: 'Get compliance records for a driver' })
  listForDriver(@Param('driverId') driverId: string, @CurrentUser() user: any) {
    return this.complianceService.listForDriver(driverId, user.id, user.primaryRole);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get compliance record by ID' })
  findById(@Param('id') id: string, @CurrentUser() user: any) {
    return this.complianceService.findById(id, user.id, user.primaryRole);
  }

  @Patch(':id/status')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.COMPANY_ADMIN, UserRole.FLEET_MANAGER, UserRole.SERVICE_PROVIDER)
  @ApiOperation({ summary: 'Update compliance record status' })
  updateStatus(@Param('id') id: string, @Body() dto: UpdateComplianceStatusDto, @CurrentUser() user: any) {
    return this.complianceService.updateStatus(id, user.id, dto, user.primaryRole);
  }

  @Post('refresh-statuses')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh all compliance statuses based on expiry dates (Admin)' })
  refreshStatuses() {
    return this.complianceService.refreshAllStatuses();
  }
}
