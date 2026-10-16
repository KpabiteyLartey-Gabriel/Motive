import { IsString, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateOwnerProfileDto {
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
  bankName?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  bankAccountNumber?: string;

  @ApiPropertyOptional({ example: '+233241234567' })
  @IsString()
  @IsOptional()
  momoNumber?: string;

  @ApiPropertyOptional({ example: 'MTN' })
  @IsString()
  @IsOptional()
  momoProvider?: string;
}
