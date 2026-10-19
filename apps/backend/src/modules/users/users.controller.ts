import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Query,
  Body,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { UserRole, UserStatus } from '@prisma/client';
import { IsEnum, IsString, MinLength } from 'class-validator';
import { join } from 'path';

import { UsersService } from './users.service';
import { StorageService } from '../storage/storage.service';
import { UpdateProfileDto, ChangePasswordDto } from './dto/account-settings.dto';

export const PROFILE_PHOTO_DIR = join(process.cwd(), 'uploads', 'profiles');
const IMAGE_MIME = /^image\/(jpeg|png|webp|gif|avif)$/;
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

class UpdateStatusDto {
  @IsEnum(UserStatus)
  status: UserStatus;
}

class UpdateRoleDto {
  @IsEnum(UserRole)
  role: UserRole;
}

class AdminResetPasswordDto {
  @IsString()
  @MinLength(8)
  newPassword: string;
}

@ApiTags('Users')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly storage: StorageService,
  ) {}

  @Get()
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'List all users (Admin only)' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'role', required: false, enum: UserRole })
  @ApiQuery({ name: 'search', required: false })
  async findAll(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('role') role?: UserRole,
    @Query('search') search?: string,
  ) {
    return this.usersService.findAll({ page, limit, role, search });
  }

  @Get('me')
  @ApiOperation({ summary: 'Get own profile' })
  async getMyProfile(@CurrentUser() user: any) {
    return this.usersService.findById(user.id);
  }

  @Patch('me')
  @ApiOperation({ summary: 'Update own profile (name, phone, …)' })
  async updateMyProfile(@CurrentUser() user: any, @Body() dto: UpdateProfileDto) {
    return this.usersService.updateProfile(user.id, dto);
  }

  @Patch('me/password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Change own password (revokes other sessions)' })
  async changeMyPassword(@CurrentUser() user: any, @Body() dto: ChangePasswordDto) {
    return this.usersService.changePassword(user.id, dto.currentPassword, dto.newPassword);
  }

  @Post('me/profile-photo')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Upload own profile picture (multipart, field "file", image, max 5MB)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } } } })
  @UseInterceptors(FileInterceptor('file', {
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (_req: any, file: any, cb: any) => cb(null, IMAGE_MIME.test(file.mimetype || '')),
  }))
  async uploadProfilePhoto(@CurrentUser() user: any, @UploadedFile() file: any) {
    if (!file) throw new BadRequestException('No image file received (field "file", image files only, max 5MB)');
    const stored = await this.storage.uploadFile(file, `profiles/${user.id}`);
    return this.usersService.setProfilePhoto(user.id, stored.url);
  }

  @Post('me/verification/email/send')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Send a 6-digit verification code to my email' })
  async sendEmailCode(@CurrentUser() user: any) {
    return this.usersService.sendVerificationCode(user.id, 'email');
  }

  @Post('me/verification/email/confirm')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Confirm my email with the 6-digit code' })
  async confirmEmailCode(@CurrentUser() user: any, @Body() dto: { code: string }) {
    return this.usersService.confirmVerificationCode(user.id, 'email', dto?.code);
  }

  @Post('me/verification/phone/send')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Send a 6-digit verification code to my phone by SMS' })
  async sendPhoneCode(@CurrentUser() user: any) {
    return this.usersService.sendVerificationCode(user.id, 'phone');
  }

  @Post('me/verification/phone/confirm')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Confirm my phone with the 6-digit code' })
  async confirmPhoneCode(@CurrentUser() user: any, @Body() dto: { code: string }) {
    return this.usersService.confirmVerificationCode(user.id, 'phone', dto?.code);
  }

  @Patch('me/deactivate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Deactivate own account (signs out everywhere; an admin can reactivate)' })
  async deactivateMyAccount(@CurrentUser() user: any) {
    return this.usersService.deactivateMyAccount(user.id);
  }

  @Get(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get user by ID (Admin only)' })
  async findOne(@Param('id') id: string) {
    return this.usersService.findById(id);
  }

  @Patch(':id/status')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Update user status (Admin only)' })
  async updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateStatusDto,
    @CurrentUser() actor: any,
  ) {
    return this.usersService.updateStatus(id, dto.status, actor.id);
  }

  @Patch(':id/reset-password')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reset a user password for testing (Admin only; passwords cannot be viewed)' })
  async adminResetPassword(
    @Param('id') id: string,
    @Body() dto: AdminResetPasswordDto,
    @CurrentUser() actor: any,
  ) {
    return this.usersService.adminResetPassword(id, dto.newPassword, actor.id);
  }

  @Patch(':id/role')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Update user role (Super Admin only)' })
  async updateRole(
    @Param('id') id: string,
    @Body() dto: UpdateRoleDto,
    @CurrentUser() actor: any,
  ) {
    return this.usersService.updateRole(id, dto.role, actor.id);
  }
}
