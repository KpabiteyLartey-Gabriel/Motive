import {
  IsString, IsEnum, IsOptional, IsDateString, IsNumber,
  IsInt, IsBoolean, IsPositive, ValidateNested, Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ContractType, OperatingModel } from '@prisma/client';

export class WorkAndPayTermsDto {
  // Owner's private purchase price. Optional for direct (physically agreed)
  // contracts, where only the total payable is contracted on.
  @IsNumber() @IsPositive() @IsOptional() vehicleValue?: number;
  @IsNumber() @IsPositive() depositAmount: number;
  @IsNumber() @IsPositive() totalPayable: number;
  @IsNumber() @IsPositive() installmentAmount: number;
  @IsString() installmentFrequency: string; // DAILY, WEEKLY, MONTHLY
  @IsInt() @IsPositive() totalInstallments: number;
  @IsNumber() @IsOptional() latePenaltyRate?: number;
  @IsInt() @Min(0) @IsOptional() gracePeriodDays?: number;
}

export class RentalTermsDto {
  @IsNumber() @IsOptional() salaryAmount?: number;
  @IsNumber() @IsOptional() revenueSharePercent?: number;
  @IsString() paymentFrequency: string; // WEEKLY, BIWEEKLY, MONTHLY
  @IsBoolean() @IsOptional() driverPaysInsurance?: boolean;
  @IsBoolean() @IsOptional() driverPaysMaintenance?: boolean;
  @IsBoolean() @IsOptional() driverPaysFuel?: boolean;
}

export class DrivingOnTermsDto {
  @IsNumber() @IsPositive() dailySalesAmount: number;
  @IsString() paymentFrequency: string; // DAILY, WEEKLY
  @IsBoolean() @IsOptional() driverPaysInsurance?: boolean;
  @IsBoolean() @IsOptional() driverPaysMaintenance?: boolean;
  @IsBoolean() @IsOptional() driverPaysFuel?: boolean;
}

export class CreateContractDto {
  @ApiProperty({ enum: ContractType })
  @IsEnum(ContractType)
  type: ContractType;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  vehicleId?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  title?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional()
  @IsDateString()
  @IsOptional()
  startDate?: string;

  @ApiPropertyOptional()
  @IsDateString()
  @IsOptional()
  endDate?: string;

  /** IDs of other parties: [{ userId?, driverId?, companyId?, role }] */
  @ApiPropertyOptional()
  @IsOptional()
  parties?: Array<{ userId?: string; driverId?: string; companyId?: string; role: string }>;

  /** Work & Pay specific terms */
  @ApiPropertyOptional()
  @IsOptional()
  @ValidateNested()
  @Type(() => WorkAndPayTermsDto)
  workAndPayTerms?: WorkAndPayTermsDto;

  /** Rental specific terms */
  @ApiPropertyOptional()
  @IsOptional()
  @ValidateNested()
  @Type(() => RentalTermsDto)
  rentalTerms?: RentalTermsDto;

  /** Driving On specific terms */
  @ApiPropertyOptional()
  @IsOptional()
  @ValidateNested()
  @Type(() => DrivingOnTermsDto)
  drivingOnTerms?: DrivingOnTermsDto;

  /** JSON object — responsibility matrix: fuel, maintenance, insurance */
  @ApiPropertyOptional()
  @IsOptional()
  responsibilityMatrix?: Record<string, any>;

  /** JSON object — extra agreed terms, e.g. { offDays: 'Sundays', source: 'DIRECT' } */
  @ApiPropertyOptional()
  @IsOptional()
  terms?: Record<string, any>;
}

export class ShareContractDto {
  @ApiProperty({ description: 'Chat username of the driver to share this contract with, with or without @' })
  @IsString()
  chatUsername: string;
}
