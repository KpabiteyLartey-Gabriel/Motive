import {
  Controller, Get, Post, Patch, Body, Param, Query,
  UseGuards, UseInterceptors, UploadedFile, BadRequestException, HttpCode, HttpStatus,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { StorageService } from '../storage/storage.service';
import { UserRole } from '@prisma/client';
import { ComplianceService } from './compliance.service';
import { CreateComplianceRecordDto, UpdateComplianceStatusDto } from './dto/compliance.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

const DOC_MIME = /^(application\/pdf|image\/(jpeg|png|webp|gif|avif))$/;

@ApiTags('Compliance')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('compliance')
export class ComplianceController {
  constructor(
    private readonly complianceService: ComplianceService,
    private readonly storage: StorageService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Create a compliance record' })
  create(@Body() dto: CreateComplianceRecordDto, @CurrentUser() user: any) {
    return this.complianceService.create(user.id, dto, user.primaryRole);
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.COMPANY_ADMIN, UserRole.FLEET_MANAGER, UserRole.LEGAL_PROFESSIONAL)
  @ApiOperation({ summary: 'List all compliance records (Admin/Fleet/Legal)' })
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
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.COMPANY_ADMIN, UserRole.FLEET_MANAGER, UserRole.SERVICE_PROVIDER, UserRole.LEGAL_PROFESSIONAL)
  @ApiOperation({ summary: 'Update compliance record status' })
  updateStatus(@Param('id') id: string, @Body() dto: UpdateComplianceStatusDto, @CurrentUser() user: any) {
    return this.complianceService.updateStatus(id, user.id, dto, user.primaryRole);
  }

  @Post(':id/file')
  @HttpCode(HttpStatus.CREATED)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.COMPANY_ADMIN, UserRole.FLEET_MANAGER, UserRole.SERVICE_PROVIDER, UserRole.LEGAL_PROFESSIONAL)
  @ApiOperation({ summary: 'Upload the document file for a compliance record (PDF or image, max 10MB)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } } } })
  @UseInterceptors(FileInterceptor('file', {
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (_req: any, file: any, cb: any) => cb(null, DOC_MIME.test(file.mimetype || '')),
  }))
  async uploadFile(@Param('id') id: string, @CurrentUser() user: any, @UploadedFile() file: any) {
    if (!file) throw new BadRequestException('No document file received (field "file", PDF or image, max 10MB)');
    const stored = await this.storage.uploadFile(file, `documents/${id}`);
    return this.complianceService.attachFile(id, user.id, user.primaryRole, {
      url: stored.url,
      fileName: file.originalname || stored.fileName,
      fileSize: file.size,
      mimeType: file.mimetype,
    });
  }

  @Post('refresh-statuses')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh all compliance statuses based on expiry dates (Admin)' })
  refreshStatuses() {
    return this.complianceService.refreshAllStatuses();
  }
}
