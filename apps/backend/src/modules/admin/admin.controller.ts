import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Query,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { UserRole, DriverStatus, OwnerStatus, VehicleStatus, CompanyStatus } from '@prisma/client';
import { IsBoolean, IsEnum, IsOptional, IsString } from 'class-validator';

import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

class VerifyDriverDto {
  @IsEnum(DriverStatus)
  status: DriverStatus;
}

class VerifyOwnerDto {
  @IsEnum(OwnerStatus)
  status: OwnerStatus;
}

class VerifyCompanyDto {
  @IsEnum(CompanyStatus)
  status: CompanyStatus;
}

class VerifyVehicleDto {
  @IsEnum(VehicleStatus)
  status: VehicleStatus;
}

class ManualVerifyDto {
  @IsEnum(['IDENTITY', 'LICENCE', 'ALL'])
  target: 'IDENTITY' | 'LICENCE' | 'ALL';

  @IsBoolean()
  @IsOptional()
  verified?: boolean;
}

class RequestResubmissionDto {
  @IsEnum(['IDENTITY', 'LICENCE', 'ALL'])
  target: 'IDENTITY' | 'LICENCE' | 'ALL';

  @IsString()
  reason: string;
}

@ApiTags('Admin')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  // ── Announcements ──────────────────────────────────────────
  @Post('announcements')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Send an announcement to all users or one role (push + in-app)' })
  async createAnnouncement(
    @CurrentUser() user: any,
    @Body() dto: { subject: string; body: string; role?: UserRole },
  ) {
    return this.adminService.createAnnouncement(user.id, dto);
  }

  // ── Manual verification (Super Admin only) ─────────────────
  @Get('verifications')
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Super Admin: unified Driver/Owner verification queue (National ID + driver licence), including test accounts' })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'status', required: false, description: 'PENDING_REVIEW | NOT_SUBMITTED | VERIFIED | NEEDS_LICENCE' })
  async listVerifications(@Query('search') search?: string, @Query('status') status?: string) {
    return this.adminService.listVerifications({ search, status });
  }

  @Patch('verifications/:userId')
  @Roles(UserRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Super Admin: manually verify or un-verify a user\u2019s National ID, licence, or both (for issues and test accounts)' })
  async manualVerify(
    @Param('userId') userId: string,
    @Body() dto: ManualVerifyDto,
    @CurrentUser() actor: any,
  ) {
    return this.adminService.manualVerifyUser(userId, { target: dto.target, verified: dto.verified !== false }, actor.id);
  }

  @Post('verifications/:userId/request-resubmission')
  @Roles(UserRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Super Admin: send a submission back with a reason — the user is emailed and notified in-app to resubmit' })
  async requestResubmission(
    @Param('userId') userId: string,
    @Body() dto: RequestResubmissionDto,
    @CurrentUser() actor: any,
  ) {
    return this.adminService.requestResubmission(userId, dto, actor.id);
  }

  // ── Stats ──────────────────────────────────────────────────
  @Get('stats')
  @ApiOperation({ summary: 'Platform-wide statistics' })
  async getStats() {
    return this.adminService.getStats();
  }

  // ── Drivers ────────────────────────────────────────────────
  @Get('drivers')
  @ApiOperation({ summary: 'List all drivers (Admin)' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'status', required: false, enum: DriverStatus })
  async listDrivers(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('search') search?: string,
    @Query('status') status?: string,
  ) {
    return this.adminService.listDrivers({ page, limit, search, status });
  }

  @Post('drivers/provision/:userId')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a driver profile for a DRIVER-role account that has none (e.g. registered before profiles existed)' })
  async provisionDriver(@Param('userId') userId: string, @CurrentUser() actor: any) {
    return this.adminService.provisionDriverProfile(userId, actor.id);
  }

  @Patch('drivers/:id/status')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update driver verification status' })
  async verifyDriver(
    @Param('id') id: string,
    @Body() dto: VerifyDriverDto,
    @CurrentUser() actor: any,
  ) {
    return this.adminService.verifyDriver(id, dto.status, actor.id);
  }

  // ── Owners ─────────────────────────────────────────────────
  @Get('owners')
  @ApiOperation({ summary: 'List all owners (Admin)' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'status', required: false, enum: OwnerStatus })
  async listOwners(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('search') search?: string,
    @Query('status') status?: string,
  ) {
    return this.adminService.listOwners({ page, limit, search, status });
  }

  @Patch('owners/:id/status')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update owner verification status' })
  async verifyOwner(
    @Param('id') id: string,
    @Body() dto: VerifyOwnerDto,
    @CurrentUser() actor: any,
  ) {
    return this.adminService.verifyOwner(id, dto.status, actor.id);
  }

  // ── Companies ──────────────────────────────────────────────
  @Get('companies')
  @ApiOperation({ summary: 'List all companies (Admin)' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'status', required: false, enum: CompanyStatus })
  @ApiQuery({ name: 'type', required: false })
  async listCompanies(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('type') type?: string,
  ) {
    return this.adminService.listCompanies({ page, limit, search, status, type });
  }

  @Patch('companies/:id/status')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update company status' })
  async verifyCompany(
    @Param('id') id: string,
    @Body() dto: VerifyCompanyDto,
    @CurrentUser() actor: any,
  ) {
    return this.adminService.verifyCompany(id, dto.status, actor.id);
  }

  // ── Vehicles ───────────────────────────────────────────────
  @Patch('vehicles/:id/status')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update vehicle verification status' })
  async verifyVehicle(
    @Param('id') id: string,
    @Body() dto: VerifyVehicleDto,
    @CurrentUser() actor: any,
  ) {
    return this.adminService.verifyVehicle(id, dto.status, actor.id);
  }

  // ── Contracts ──────────────────────────────────────────────
  @Get('contracts')
  @ApiOperation({ summary: 'List all contracts (Admin)' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'type', required: false })
  async listContracts(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('status') status?: string,
    @Query('type') type?: string,
  ) {
    return this.adminService.listContracts({ page, limit, status, type });
  }

  // ── Payments ───────────────────────────────────────────────
  @Get('payments')
  @ApiOperation({ summary: 'List all payments (Admin)' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'contractId', required: false })
  async listPayments(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('status') status?: string,
    @Query('contractId') contractId?: string,
  ) {
    return this.adminService.listPayments({ page, limit, status, contractId });
  }

  // ── Disputes ────────────────────────────────────────────────
  @Get('disputes')
  @ApiOperation({ summary: 'List all disputes (Admin)' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'type', required: false })
  async listDisputes(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('status') status?: string,
    @Query('type') type?: string,
  ) {
    return this.adminService.listDisputes({ page, limit, status, type });
  }

  // ── Maintenance ─────────────────────────────────────────────
  @Get('maintenance')
  @ApiOperation({ summary: 'List all maintenance requests (Admin)' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'status', required: false })
  async listMaintenance(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('status') status?: string,
  ) {
    return this.adminService.listMaintenance({ page, limit, status });
  }

  // ── Tracking (admin) ───────────────────────────────────────
  @Get('tracking/devices')
  @ApiOperation({ summary: 'List all tracking devices (Admin)' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'status', required: false })
  async listTrackingDevices(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('status') status?: string,
  ) {
    return this.adminService.listTrackingDevices({ page, limit, status });
  }

  // ── Incidents (admin) ──────────────────────────────────────
  @Get('incidents')
  @ApiOperation({ summary: 'List all incidents (Admin)' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'type', required: false })
  async listIncidents(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('status') status?: string,
    @Query('type') type?: string,
  ) {
    return this.adminService.listIncidents({ page, limit, status, type });
  }

  // ── Compliance (admin) ─────────────────────────────────────
  @Get('compliance')
  @ApiOperation({ summary: 'List all compliance records (Admin)' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'documentType', required: false })
  async listCompliance(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('status') status?: string,
    @Query('documentType') documentType?: string,
  ) {
    return this.adminService.listCompliance({ page, limit, status, documentType });
  }

  // ── Audit Logs ─────────────────────────────────────────────
  @Get('audit')
  @ApiOperation({ summary: 'List audit logs (Admin)' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'resource', required: false })
  @ApiQuery({ name: 'actorId', required: false })
  @ApiQuery({ name: 'action', required: false })
  async listAuditLogs(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('resource') resource?: string,
    @Query('actorId') actorId?: string,
    @Query('action') action?: string,
  ) {
    return this.adminService.listAuditLogs({ page, limit, resource, actorId, action });
  }
}
