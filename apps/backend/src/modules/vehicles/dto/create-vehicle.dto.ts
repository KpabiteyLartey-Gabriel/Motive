import {
  IsString, IsInt, IsEnum, IsOptional, IsNumber, Min, Max, IsArray, ArrayMaxSize, IsBoolean
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { VehicleType, FuelType, TransmissionType, OperatingModel, VehicleStatus } from '@prisma/client';

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

  @ApiPropertyOptional({ enum: OperatingModel, description: 'How the vehicle will earn: Work & Pay, Rental, or Driving On' })
  @IsEnum(OperatingModel)
  @IsOptional()
  operatingModel?: OperatingModel;

  @ApiPropertyOptional({ description: 'Publish immediately so the vehicle is AVAILABLE for contracts. Default false (saved as DRAFT).' })
  @IsBoolean()
  @IsOptional()
  publish?: boolean;

  @ApiPropertyOptional({ description: 'Company that will rent this vehicle out. Required when an owner publishes a RENTAL vehicle — only companies publish rentals.' })
  @IsString()
  @IsOptional()
  managingCompanyId?: string;

  @ApiPropertyOptional()
  @IsNumber()
  @IsOptional()
  estimatedValue?: number;

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

export class UpdateVehicleStatusDto {
  @ApiProperty({ enum: VehicleStatus, description: 'Owners may publish (AVAILABLE) or unpublish (DRAFT); other transitions are managed by contracts/admin.' })
  @IsEnum(VehicleStatus)
  status: VehicleStatus;
}

export class ChangeOperatingModelDto {
  @ApiProperty({ enum: OperatingModel, description: 'The contract type to change to. Work & Pay vehicles with a driver need driver approval.' })
  @IsEnum(OperatingModel)
  operatingModel: OperatingModel;

  @ApiPropertyOptional({ description: 'Company that will rent the vehicle out. Required when changing to RENTAL and the vehicle has no managing company yet.' })
  @IsString()
  @IsOptional()
  managingCompanyId?: string;
}

export class DecideModelChangeDto {
  @ApiProperty({ description: 'true to approve the change, false to reject it' })
  @IsBoolean()
  approve: boolean;
}
