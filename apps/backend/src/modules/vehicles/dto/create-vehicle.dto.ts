import {
  IsString, IsInt, IsEnum, IsOptional, IsNumber, Min, Max, IsArray, ArrayMaxSize
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { VehicleType, FuelType, TransmissionType } from '@prisma/client';

export class CreateVehicleDto {
  @ApiProperty({ example: 'GR-1234-24' })
  @IsString()
  registrationNumber: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  vin?: string;

  @ApiProperty({ example: 'Toyota' })
  @IsString()
  make: string;

  @ApiProperty({ example: 'Corolla' })
  @IsString()
  model: string;

  @ApiProperty({ example: 2020 })
  @IsInt()
  @Min(1980)
  @Max(new Date().getFullYear() + 1)
  year: number;

  @ApiPropertyOptional({ example: 'White' })
  @IsString()
  @IsOptional()
  color?: string;

  @ApiProperty({ enum: VehicleType })
  @IsEnum(VehicleType)
  type: VehicleType;

  @ApiProperty({ enum: FuelType })
  @IsEnum(FuelType)
  fuelType: FuelType;

  @ApiProperty({ enum: TransmissionType })
  @IsEnum(TransmissionType)
  transmission: TransmissionType;

  @ApiPropertyOptional()
  @IsInt()
  @IsOptional()
  mileage?: number;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  location?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  region?: string;

  @ApiPropertyOptional({ type: [String], description: 'Vehicle photo URLs (https://… or /uploads/vehicles/…), max 10' })
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  @IsOptional()
  imageUrls?: string[];
}
