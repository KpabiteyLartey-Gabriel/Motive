import { IsString, IsOptional, IsEnum, MinLength, IsDateString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { GenderType } from '@prisma/client';

export class UpdateProfileDto {
  @ApiPropertyOptional() @IsString() @IsOptional() firstName?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() lastName?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() otherNames?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() phone?: string;
  @ApiPropertyOptional({ enum: GenderType }) @IsEnum(GenderType) @IsOptional() gender?: GenderType;
  @ApiPropertyOptional() @IsDateString() @IsOptional() dateOfBirth?: string;
}

export class ChangePasswordDto {
  @ApiProperty() @IsString() currentPassword: string;
  @ApiProperty({ minLength: 8 }) @IsString() @MinLength(8) newPassword: string;
}
