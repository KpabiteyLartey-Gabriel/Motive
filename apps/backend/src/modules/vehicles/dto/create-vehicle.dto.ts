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

  @ApiPropertyOptional({ description: 'Chassis number as stamped on the vehicle and shown on the DVLA Vehicle Registration Certificate. Required for verification.' })
  @IsString()
  @IsOptional()
  chassisNumber?: string;

  @ApiPropertyOptional({ description: 'Engine number from the registration certificate. Required for verification.' })
  @IsString()
  @IsOptional()
  engineNumber?: string;

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

export class UpdateVehicleDto {
  @ApiPropertyOptional() @IsString() @IsOptional() registrationNumber?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() chassisNumber?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() engineNumber?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() vin?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() make?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() model?: string;
  @ApiPropertyOptional() @IsInt() @Min(1980) @Max(new Date().getFullYear() + 1) @IsOptional() year?: number;
  @ApiPropertyOptional() @IsString() @IsOptional() color?: string;
  @ApiPropertyOptional({ enum: VehicleType }) @IsEnum(VehicleType) @IsOptional() type?: VehicleType;
  @ApiPropertyOptional({ enum: FuelType }) @IsEnum(FuelType) @IsOptional() fuelType?: FuelType;
  @ApiPropertyOptional({ enum: TransmissionType }) @IsEnum(TransmissionType) @IsOptional() transmission?: TransmissionType;
  @ApiPropertyOptional() @IsString() @IsOptional() region?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() location?: string;
  @ApiPropertyOptional() @IsInt() @IsOptional() mileage?: number;
  @ApiPropertyOptional() @IsNumber() @IsOptional() estimatedValue?: number;
}

export const VERIFICATION_EVIDENCE_KINDS = ['frontPlate', 'rearPlate', 'vinPlate', 'registrationCert'] as const;
export type VerificationEvidenceKind = (typeof VERIFICATION_EVIDENCE_KINDS)[number];

export class SetVerificationEvidenceDto {
  @ApiProperty({ enum: VERIFICATION_EVIDENCE_KINDS, description: 'Which required evidence image this is: front plate, rear plate, VIN/chassis plate, or the DVLA Vehicle Registration Certificate' })
  @IsString()
  kind: string;

  @ApiProperty({ description: 'URL of the uploaded evidence image (https://… or /uploads/…)' })
  @IsString()
  url: string;
}

export class SubmitVerificationDto {
  @ApiPropertyOptional({ description: 'Evidence URLs by kind. Any not already saved must be provided here; frontPlate, rearPlate, vinPlate and registrationCert are all required.' })
  @IsOptional()
  evidence?: Partial<Record<VerificationEvidenceKind, string>>;
}

export class VerificationDecisionDto {
  @ApiProperty({ description: 'true to verify the vehicle, false to reject it' })
  @IsBoolean()
  approve: boolean;

  @ApiPropertyOptional({ description: 'Required when rejecting: what does not match or is unclear, so the owner can fix and resubmit' })
  @IsString()
  @IsOptional()
  note?: string;
}
