import { IsString, IsOptional, IsDateString, IsEnum } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IdentityDocumentType } from '@prisma/client';

export class UpdateDriverProfileDto {
  @ApiPropertyOptional({ example: 'GH-123456789' })
  @IsString()
  @IsOptional()
  licenseNumber?: string;

  @ApiPropertyOptional({ example: 'Class B' })
  @IsString()
  @IsOptional()
  licenseClass?: string;

  @ApiPropertyOptional({ example: '2028-05-01' })
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

  @ApiPropertyOptional({ example: 'GHA-123456789-0' })
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

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  emergencyContactName?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  emergencyContactPhone?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  emergencyContactRelationship?: string;
}
