import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';

import { DriversService } from './drivers.service';
import { CreateDriverProfileDto } from './dto/create-driver-profile.dto';
import { UpdateDriverProfileDto } from './dto/update-driver-profile.dto';

const DOC_MIME = /^(image\/(jpeg|png|webp)|application\/pdf)$/;
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

  @Patch('profile')
  @ApiOperation({ summary: 'Update own driver KYC details (licence, Ghana Card, address, emergency contact)' })
  async updateProfile(@CurrentUser() user: any, @Body() dto: UpdateDriverProfileDto) {
    return this.driversService.updateProfile(user.id, dto);
  }

  @Post('documents')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Upload a KYC document (licence or Ghana Card photo/PDF, max 10MB)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' }, type: { type: 'string', example: 'LICENSE' }, expiryDate: { type: 'string', example: '2028-05-01' } } } })
  @UseInterceptors(FileInterceptor('file', {
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (_req: any, file: any, cb: any) => cb(null, DOC_MIME.test(file.mimetype || '')),
  }))
  async uploadDocument(
    @CurrentUser() user: any,
    @UploadedFile() file: any,
    @Body() body: { type?: string; expiryDate?: string },
  ) {
    if (!file) throw new BadRequestException('No document file received (field "file", image or PDF, max 10MB)');
    return this.driversService.addDocument(user.id, file, body?.type || 'OTHER', body?.expiryDate);
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
