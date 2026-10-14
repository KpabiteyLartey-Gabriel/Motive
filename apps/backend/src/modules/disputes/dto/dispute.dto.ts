import { IsString, IsOptional, IsEnum } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateDisputeDto {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  contractId?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  vehicleId?: string;

  @ApiProperty({ example: 'PAYMENT' })
  @IsString()
  type: string; // PAYMENT, CONTRACT, VEHICLE_DAMAGE, MAINTENANCE, REVENUE, VEHICLE_RETURN, OTHER

  @ApiProperty({ example: 'Dispute over missed payment' })
  @IsString()
  subject: string;

  @ApiProperty()
  @IsString()
  description: string;

  @ApiPropertyOptional({ example: 'NORMAL' })
  @IsString()
  @IsOptional()
  priority?: string; // LOW, NORMAL, HIGH, CRITICAL

  /** Other party user IDs */
  @ApiPropertyOptional()
  @IsOptional()
  respondentIds?: string[];
}

export class AddDisputeMessageDto {
  @ApiProperty()
  @IsString()
  message: string;

  @ApiPropertyOptional()
  @IsOptional()
  isInternal?: boolean;
}

export class ResolveDisputeDto {
  @ApiProperty()
  @IsString()
  resolution: string;
}
