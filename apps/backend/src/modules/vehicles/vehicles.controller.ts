import {
  Controller, Get, Post, Patch, Body, Param, Query, UseGuards, UseInterceptors,
  UploadedFiles, BadRequestException, HttpCode, HttpStatus
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { VehicleStatus } from '@prisma/client';
import { join } from 'path';
import { VehiclesService } from './vehicles.service';
import { StorageService } from '../storage/storage.service';
import { CreateVehicleDto, UpdateVehicleStatusDto } from './dto/create-vehicle.dto';
import { UpdateVehiclePhotosDto } from './dto/update-vehicle-photos.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
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

  @Get(':id')
  @ApiOperation({ summary: 'Get vehicle by ID' })
  async findOne(@Param('id') id: string, @CurrentUser() user: any) {
    return this.vehiclesService.findById(id, user.id, user.primaryRole);
  }

  @Patch(':id/status')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Publish (AVAILABLE) or unpublish (DRAFT) a vehicle you own' })
  async updateStatus(@Param('id') id: string, @CurrentUser() user: any, @Body() dto: UpdateVehicleStatusDto) {
    return this.vehiclesService.updateStatus(id, dto.status, user.id, user.primaryRole);
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
