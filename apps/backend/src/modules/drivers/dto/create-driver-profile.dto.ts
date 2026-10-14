import { IsString, IsOptional, IsDateString, IsEnum } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IdentityDocumentType } from '@prisma/client';

export class CreateDriverProfileDto {
  @ApiPropertyOptional({ example: 'GH-123456789' })
  @IsString()
  @IsOptional()
  licenseNumber?: string;

  @ApiPropertyOptional({ example: 'Class B' })
  @IsString()
  @IsOptional()
  licenseClass?: string;

  @ApiPropertyOptional()
  @IsDateString()
  @IsOptional()
  licenseExpiryDate?: string;

  @ApiPropertyOptional({ enum: IdentityDocumentType })
  @IsEnum(IdentityDocumentType)
  @IsOptional()
  identityDocType?: IdentityDocumentType;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  identityDocNumber?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  ghanaCardNumber?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  address?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  city?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  region?: string;
}
