import {
  Controller, Get, Post, Patch, Body, Param, Query,
  UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { IncidentsService } from './incidents.service';
import { CreateIncidentDto, UpdateIncidentStatusDto } from './dto/incident.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('Incidents')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('incidents')
export class IncidentsController {
  constructor(private readonly incidentsService: IncidentsService) {}

  @Post()
  @ApiOperation({ summary: 'Report a new incident' })
  create(@Body() dto: CreateIncidentDto, @CurrentUser() user: any) {
    return this.incidentsService.create(user.id, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List incidents (scoped by role)' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'type', required: false })
  @ApiQuery({ name: 'vehicleId', required: false })
  findAll(
    @CurrentUser() user: any,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('status') status?: string,
    @Query('type') type?: string,
    @Query('vehicleId') vehicleId?: string,
  ) {
    return this.incidentsService.findAll({ page, limit, status, type, vehicleId, userId: user.id, userRole: user.primaryRole });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get incident by ID' })
  findById(@Param('id') id: string, @CurrentUser() user: any) {
    return this.incidentsService.findById(id, user.id, user.primaryRole);
  }

  @Patch(':id/status')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.COMPANY_ADMIN, UserRole.FLEET_MANAGER)
  @ApiOperation({ summary: 'Update incident status (Admin/Fleet)' })
  updateStatus(@Param('id') id: string, @Body() dto: UpdateIncidentStatusDto, @CurrentUser() user: any) {
    return this.incidentsService.updateStatus(id, user.id, dto, user.primaryRole);
  }
}
