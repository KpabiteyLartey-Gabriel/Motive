import {
  Controller, Get, Post, Patch, Param, Query, Body, UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { MaintenanceService } from './maintenance.service';
import { CreateMaintenanceRequestDto, UpdateMaintenanceStatusDto } from './dto/maintenance.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('Maintenance')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('maintenance')
export class MaintenanceController {
  constructor(private readonly maintenanceService: MaintenanceService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a maintenance request' })
  async create(@CurrentUser() user: any, @Body() dto: CreateMaintenanceRequestDto) {
    return this.maintenanceService.create(user.id, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List maintenance requests' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'vehicleId', required: false })
  async findAll(
    @CurrentUser() user: any,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('status') status?: string,
    @Query('vehicleId') vehicleId?: string,
  ) {
    return this.maintenanceService.findAll({
      page, limit, status, vehicleId,
      userId: user.id,
      userRole: user.primaryRole,
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get maintenance request by ID' })
  async findOne(@Param('id') id: string, @CurrentUser() user: any) {
    return this.maintenanceService.findById(id, user.id, user.primaryRole);
  }

  @Patch(':id/status')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update maintenance request status' })
  async updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateMaintenanceStatusDto,
    @CurrentUser() user: any,
  ) {
    return this.maintenanceService.updateStatus(id, user.id, dto, user.primaryRole);
  }
}
