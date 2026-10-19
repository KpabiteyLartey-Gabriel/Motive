import {
  Controller, Get, Post, Patch, Body, Param, Query,
  UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { TrackingService } from './tracking.service';
import { RegisterDeviceDto, UpdateDeviceStatusDto, IngestLocationDto, CreateGeofenceDto, CreateLocationShareDto, IssueDeviceCommandDto, AckDeviceCommandDto } from './dto/tracking.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Public } from '../auth/decorators/public.decorator';

const FLEET_ROLES = [UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.COMPANY_ADMIN, UserRole.FLEET_MANAGER];

@ApiTags('Tracking')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('tracking')
export class TrackingController {
  constructor(private readonly trackingService: TrackingService) {}

  // ── Device management ───────────────────────────────────────
  @Post('devices')
  @Roles(...FLEET_ROLES)
  @ApiOperation({ summary: 'Register a tracking device (platform admin, company admin, fleet manager)' })
  registerDevice(@Body() dto: RegisterDeviceDto, @CurrentUser() user: any) {
    return this.trackingService.registerDevice(dto, user.id, user.primaryRole);
  }

  @Get('devices')
  @Roles(...FLEET_ROLES)
  @ApiOperation({ summary: 'List tracking devices (company roles see their fleet only)' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'status', required: false })
  listDevices(
    @CurrentUser() user: any,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('status') status?: string,
  ) {
    return this.trackingService.listDevices({ page, limit, status }, { id: user.id, role: user.primaryRole });
  }

  @Patch('devices/:id/status')
  @Roles(...FLEET_ROLES)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update device status' })
  updateDeviceStatus(@Param('id') id: string, @Body() dto: UpdateDeviceStatusDto, @CurrentUser() user: any) {
    return this.trackingService.updateDeviceStatus(id, dto, user.id, user.primaryRole);
  }

  // ── Location ingestion (no JWT — called by GPS device/server)
  @Public()
  @Post('ingest')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Ingest GPS location from tracking device' })
  ingestLocation(@Body() dto: IngestLocationDto) {
    return this.trackingService.ingestLocation(dto);
  }

  // ── Remote device commands ──────────────────────────────────
  @Post('vehicles/:vehicleId/commands')
  @Roles(...FLEET_ROLES, UserRole.OWNER)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Issue a remote command to a vehicle tracker (ENGINE_OFF / ENGINE_ON)' })
  issueCommand(@Param('vehicleId') vehicleId: string, @Body() dto: IssueDeviceCommandDto, @CurrentUser() user: any) {
    return this.trackingService.issueCommand(vehicleId, dto, user.id, user.primaryRole);
  }

  @Get('vehicles/:vehicleId/commands')
  @Roles(...FLEET_ROLES, UserRole.OWNER)
  @ApiOperation({ summary: 'List remote commands issued for a vehicle' })
  listCommands(@Param('vehicleId') vehicleId: string, @CurrentUser() user: any) {
    return this.trackingService.listCommands(vehicleId, user.id, user.primaryRole);
  }

  @Public()
  @Get('commands/pending')
  @ApiOperation({ summary: 'Device poll: pending commands for a device serial (marks them SENT)' })
  @ApiQuery({ name: 'deviceSerial', required: true })
  pendingCommands(@Query('deviceSerial') deviceSerial: string) {
    return this.trackingService.listPendingCommands(deviceSerial);
  }

  @Public()
  @Post('commands/:id/ack')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Device acknowledgement of a delivered command' })
  ackCommand(@Param('id') id: string, @Body() dto: AckDeviceCommandDto) {
    return this.trackingService.acknowledgeCommand(id, dto.deviceSerial);
  }

  // ── Vehicle tracking (role-based access) ───────────────────
  @Get('vehicles/:vehicleId/device')
  @Roles(...FLEET_ROLES, UserRole.OWNER)
  @ApiOperation({ summary: 'Get tracking device for a vehicle (owners and fleet roles only — never drivers)' })
  getDevice(@Param('vehicleId') vehicleId: string, @CurrentUser() user: any) {
    return this.trackingService.getDeviceForVehicle(vehicleId, user.id, user.primaryRole);
  }

  @Get('vehicles/:vehicleId/location')
  @Roles(...FLEET_ROLES, UserRole.OWNER)
  @ApiOperation({ summary: 'Get last known location for a vehicle (owners and fleet roles only — never drivers)' })
  getLastLocation(@Param('vehicleId') vehicleId: string, @CurrentUser() user: any) {
    return this.trackingService.getLastLocation(vehicleId, user.id, user.primaryRole);
  }

  @Get('vehicles/:vehicleId/history')
  @Roles(...FLEET_ROLES, UserRole.OWNER)
  @ApiOperation({ summary: 'Get location history for a vehicle (owners and fleet roles only — never drivers)' })
  @ApiQuery({ name: 'from', required: false })
  @ApiQuery({ name: 'to', required: false })
  @ApiQuery({ name: 'limit', required: false })
  getHistory(
    @Param('vehicleId') vehicleId: string,
    @CurrentUser() user: any,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('limit') limit?: number,
  ) {
    return this.trackingService.getLocationHistory(vehicleId, user.id, user.primaryRole, { from, to, limit });
  }

  // ── Alerts ──────────────────────────────────────────────────
  @Get('alerts')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.FLEET_MANAGER, UserRole.COMPANY_ADMIN)
  @ApiOperation({ summary: 'List tracking alerts (speeding, geofence, offline, …)' })
  @ApiQuery({ name: 'vehicleId', required: false })
  @ApiQuery({ name: 'isRead', required: false })
  listAlerts(
    @CurrentUser() _user: any,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('vehicleId') vehicleId?: string,
    @Query('isRead') isRead?: string,
  ) {
    const isReadBool = isRead !== undefined ? isRead === 'true' : undefined;
    return this.trackingService.listAlerts({ page, limit, vehicleId, isRead: isReadBool });
  }

  @Patch('alerts/:id/read')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark tracking alert as read' })
  markAlertRead(@Param('id') id: string, @CurrentUser() user: any) {
    return this.trackingService.markAlertRead(id, user.id);
  }

  // ── Geofences ───────────────────────────────────────────────
  @Post('geofences')
  @ApiOperation({ summary: 'Create a geofence' })
  createGeofence(@Body() dto: CreateGeofenceDto, @CurrentUser() user: any) {
    return this.trackingService.createGeofence(dto, user.id);
  }

  @Get('geofences')
  @ApiOperation({ summary: 'List geofences' })
  listGeofences(@CurrentUser() user: any) {
    return this.trackingService.listGeofences(user.id, user.primaryRole);
  }

  // ── Location share (owner-only create/list/revoke) ──────────
  @Post('shares')
  @Roles(UserRole.OWNER)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a shareable location link for a vehicle (Owner only)' })
  createShare(@Body() dto: CreateLocationShareDto, @CurrentUser() user: any) {
    return this.trackingService.createLocationShare(dto, user.id);
  }

  @Get('shares')
  @Roles(UserRole.OWNER)
  @ApiOperation({ summary: 'List your active share links (Owner only)' })
  listShares(@CurrentUser() user: any) {
    return this.trackingService.listLocationShares(user.id);
  }

  @Patch('shares/:id/revoke')
  @Roles(UserRole.OWNER)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Revoke a share link (Owner only)' })
  revokeShare(@Param('id') id: string, @CurrentUser() user: any) {
    return this.trackingService.revokeLocationShare(id, user.id);
  }

  // ── Public share token resolution (no auth) ─────────────────
  @Public()
  @Get('share/:token')
  @ApiOperation({ summary: 'Resolve a share token — returns live location (public, no auth)' })
  resolveShare(@Param('token') token: string) {
    return this.trackingService.resolveShareToken(token);
  }
}
