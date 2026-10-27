import { IsBoolean, IsEnum, IsInt, IsNumber, IsOptional, IsString, Min, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ProviderServiceCategory } from '@prisma/client';

export class CreateProviderServiceDto {
  @ApiProperty({ example: 'Full Detailing — interior & exterior deep clean' })
  @IsString() @MinLength(3)
  title: string;

  @ApiProperty({ enum: ProviderServiceCategory, example: ProviderServiceCategory.DETAILING })
  @IsEnum(ProviderServiceCategory)
  category: ProviderServiceCategory;

  @ApiPropertyOptional({ example: 'Wash, clay, polish, wax, interior shampoo and tyre shine.' })
  @IsOptional() @IsString()
  description?: string;

  @ApiPropertyOptional({ example: 450, description: 'Price in GHS' })
  @IsOptional() @IsNumber() @Min(0)
  priceGhs?: number;

  @ApiPropertyOptional({ example: 'from', description: 'e.g. "from", "per tyre", "per visit"' })
  @IsOptional() @IsString()
  priceNote?: string;

  @ApiPropertyOptional({ example: 180 })
  @IsOptional() @IsInt() @Min(0)
  durationMins?: number;
}

export class RequestServiceDto {
  @ApiPropertyOptional({ description: 'Vehicle linked to you in +Motive, if any' })
  @IsOptional() @IsString()
  vehicleId?: string;

  @ApiPropertyOptional({ example: 'My 2018 Toyota Corolla, GE-2477-24', description: 'Describe the vehicle when it is not linked in +Motive' })
  @IsOptional() @IsString()
  vehicleLabel?: string;

  @ApiPropertyOptional({ example: '2026-11-02', description: 'Preferred date (ISO date)' })
  @IsOptional() @IsString()
  preferredDate?: string;

  @ApiPropertyOptional({ example: '+233240001122' })
  @IsOptional() @IsString()
  contactPhone?: string;

  @ApiPropertyOptional({ example: 'Please come to Osu; the car is parked at home.' })
  @IsOptional() @IsString()
  notes?: string;
}

export class UpdateServiceRequestStatusDto {
  @ApiProperty({ enum: ['ACCEPTED', 'DECLINED', 'COMPLETED', 'CANCELLED'] })
  @IsString()
  status: string;

  @ApiPropertyOptional({ example: 'We can do Saturday 9am.' })
  @IsOptional() @IsString()
  providerNote?: string;
}

export class UpdateProviderServiceDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MinLength(3)
  title?: string;

  @ApiPropertyOptional({ enum: ProviderServiceCategory }) @IsOptional() @IsEnum(ProviderServiceCategory)
  category?: ProviderServiceCategory;

  @ApiPropertyOptional() @IsOptional() @IsString()
  description?: string;

  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0)
  priceGhs?: number;

  @ApiPropertyOptional() @IsOptional() @IsString()
  priceNote?: string;

  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0)
  durationMins?: number;

  @ApiPropertyOptional() @IsOptional() @IsBoolean()
  isAvailable?: boolean;
}
