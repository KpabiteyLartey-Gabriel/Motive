import {
  Controller, Get, Post, Patch, Body, Param, Query, UseGuards, UseInterceptors,
  UploadedFile, UploadedFiles, BadRequestException, HttpCode, HttpStatus
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { VehicleStatus, UserRole } from '@prisma/client';
import { join } from 'path';
import { VehiclesService } from './vehicles.service';
import { StorageService } from '../storage/storage.service';
import { CreateVehicleDto, UpdateVehicleStatusDto, ChangeOperatingModelDto, DecideModelChangeDto, UpdateVehicleDto, SetVerificationEvidenceDto, SubmitVerificationDto, VerificationDecisionDto } from './dto/create-vehicle.dto';
import { UpdateVehiclePhotosDto } from './dto/update-vehicle-photos.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

export const VEHICLE_PHOTO_DIR = join(process.cwd(), 'uploads', 'vehicles');
const IMAGE_MIME = /^image\/(jpeg|png|webp|gif|avif)$/;

@ApiTags('Vehicles')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('vehicles')
export class VehiclesController {
  constructor(
    private readonly vehiclesService: VehiclesService,
    private readonly storage: StorageService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Register a new vehicle' })
  async create(@CurrentUser() user: any, @Body() dto: CreateVehicleDto) {
    return this.vehiclesService.create(user.id, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List vehicles' })
  async findAll(
    @CurrentUser() user: any,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('status') status?: VehicleStatus,
  ) {
    return this.vehiclesService.findAll({
      page, limit, status,
      userId: user.id,
      userRole: user.primaryRole,
    });
  }

  @Get('verification/queue')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Vehicles waiting for Super Admin verification (oldest first)' })
  async verificationQueue() {
    return this.vehiclesService.verificationQueue();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get vehicle by ID' })
  async findOne(@Param('id') id: string, @CurrentUser() user: any) {
    return this.vehiclesService.findById(id, user.id, user.primaryRole);
  }

  @Patch(':id/details')
  @ApiOperation({ summary: 'Update vehicle details (chassis number etc). Changing identity details after verification requires re-verification.' })
  async updateDetails(@Param('id') id: string, @CurrentUser() user: any, @Body() dto: UpdateVehicleDto) {
    return this.vehiclesService.updateDetails(id, dto as any, user.id, user.primaryRole);
  }

  @Post(':id/verification/evidence/upload')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Upload one verification evidence image (multipart, field "file", plus "kind": frontPlate | rearPlate | vinPlate | registrationCert)' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', {
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (_req: any, file: any, cb: any) => cb(null, IMAGE_MIME.test(file.mimetype || '')),
  }))
  async uploadEvidence(@Param('id') id: string, @CurrentUser() user: any, @UploadedFile() file: any, @Body('kind') kind: string) {
    if (!file) throw new BadRequestException('No image file received (field "file", image files only, max 5MB)');
    if (!kind) throw new BadRequestException('Evidence kind is required (frontPlate, rearPlate, vinPlate or registrationCert)');
    const stored = await this.storage.uploadFile(file, `vehicles/${id}/verification`);
    return this.vehiclesService.setVerificationEvidence(id, kind, stored.url, user.id, user.primaryRole);
  }

  @Patch(':id/verification/evidence')
  @ApiOperation({ summary: 'Attach an already-uploaded evidence image URL to a verification slot' })
  async setEvidence(@Param('id') id: string, @CurrentUser() user: any, @Body() dto: SetVerificationEvidenceDto) {
    return this.vehiclesService.setVerificationEvidence(id, dto.kind, dto.url, user.id, user.primaryRole);
  }

  @Post(':id/verification/submit')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Submit the vehicle for Super Admin verification. Requires a chassis number, colour, and all four evidence images.' })
  async submitVerification(@Param('id') id: string, @CurrentUser() user: any, @Body() dto: SubmitVerificationDto) {
    return this.vehiclesService.submitVerification(id, dto?.evidence as any, user.id, user.primaryRole);
  }

  @Post(':id/verification/decision')
  @HttpCode(HttpStatus.OK)
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Super Admin verifies or rejects a vehicle (rejection requires a note saying what does not match)' })
  async decideVerification(@Param('id') id: string, @CurrentUser() user: any, @Body() dto: VerificationDecisionDto) {
    return this.vehiclesService.decideVerification(id, dto.approve, dto.note, user.id);
  }

  @Patch(':id/status')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Publish (AVAILABLE) or unpublish (DRAFT) a vehicle you own' })
  async updateStatus(@Param('id') id: string, @CurrentUser() user: any, @Body() dto: UpdateVehicleStatusDto) {
    return this.vehiclesService.updateStatus(id, dto.status, user.id, user.primaryRole);
  }

  @Patch(':id/operating-model')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Change contract type (Work & Pay with a driver requires driver approval; DriveOn can be changed by owner or assigned driver)' })
  async changeOperatingModel(@Param('id') id: string, @CurrentUser() user: any, @Body() dto: ChangeOperatingModelDto) {
    return this.vehiclesService.changeOperatingModel(id, dto.operatingModel, user.id, user.primaryRole, dto.managingCompanyId);
  }

  @Get(':id/operating-model-request')
  @ApiOperation({ summary: 'Get the pending contract-type change request for a vehicle' })
  async pendingModelChange(@Param('id') id: string, @CurrentUser() user: any) {
    await this.vehiclesService.findById(id, user.id, user.primaryRole);
    return this.vehiclesService.getPendingModelChange(id);
  }

  @Post(':id/operating-model-request/:requestId/decision')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Assigned driver approves or rejects a Work & Pay contract-type change' })
  async decideModelChange(@Param('id') id: string, @Param('requestId') requestId: string, @CurrentUser() user: any, @Body() dto: DecideModelChangeDto) {
    return this.vehiclesService.decideModelChange(id, requestId, dto.approve, user.id);
  }

  @Patch(':id/photos')
  @ApiOperation({ summary: 'Set vehicle photos (replace list; [] removes all; max 10)' })
  async setPhotos(@Param('id') id: string, @CurrentUser() user: any, @Body() dto: UpdateVehiclePhotosDto) {
    return this.vehiclesService.setPhotos(id, dto.imageUrls, user.id, user.primaryRole);
  }

  @Post(':id/photos')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Upload vehicle photos (multipart, field "files", images only, max 10 files / 5MB each)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: { type: 'object', properties: { files: { type: 'array', items: { type: 'string', format: 'binary' } } } } })
  @UseInterceptors(FilesInterceptor('files', 10, {
    limits: { fileSize: 5 * 1024 * 1024, files: 10 },
    fileFilter: (_req: any, file: any, cb: any) => cb(null, IMAGE_MIME.test(file.mimetype || '')),
  }))
  async uploadPhotos(@Param('id') id: string, @CurrentUser() user: any, @UploadedFiles() files: any[]) {
    if (!files?.length) throw new BadRequestException('No image files received (field "files", image files only, max 5MB each)');
    const urls: string[] = [];
    for (const file of files) {
      const stored = await this.storage.uploadFile(file, `vehicles/${id}`);
      urls.push(stored.url);
    }
    return this.vehiclesService.addPhotoUrls(id, urls, user.id, user.primaryRole);
  }
}
