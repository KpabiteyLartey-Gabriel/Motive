import { IsString, IsOptional, IsNumber, IsPositive } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateMaintenanceRequestDto {
  @ApiProperty()
  @IsString()
  vehicleId: string;

  @ApiProperty({ example: 'ROUTINE' })
  @IsString()
  type: string; // ROUTINE, BREAKDOWN, ACCIDENT, INSPECTION

  @ApiProperty()
  @IsString()
  description: string;

  @ApiPropertyOptional({ example: 'NORMAL' })
  @IsString()
  @IsOptional()
  urgency?: string; // LOW, NORMAL, HIGH, CRITICAL

  @ApiPropertyOptional()
  @IsNumber()
  @IsPositive()
  @IsOptional()
  estimatedCost?: number;
}

export class UpdateMaintenanceStatusDto {
  @ApiProperty()
  @IsString()
  status: string;

  @ApiPropertyOptional()
  @IsNumber()
  @IsOptional()
  actualCost?: number;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  notes?: string;
}
