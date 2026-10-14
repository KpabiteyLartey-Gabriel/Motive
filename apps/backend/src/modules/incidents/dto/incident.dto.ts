import { IsString, IsOptional, IsEnum, IsDateString, IsNumber } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IncidentType, IncidentStatus } from '@prisma/client';

export class CreateIncidentDto {
  @ApiProperty({ enum: IncidentType }) @IsEnum(IncidentType) type: IncidentType;
  @ApiProperty() @IsString() title: string;
  @ApiProperty() @IsString() description: string;
  @ApiProperty() @IsDateString() incidentDate: string;
  @ApiPropertyOptional() @IsOptional() @IsString() vehicleId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() contractId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() location?: string;
  @ApiPropertyOptional() @IsOptional() @IsNumber() latitude?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() longitude?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() policeReference?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() insuranceClaim?: string;
  @ApiPropertyOptional() @IsOptional() @IsNumber() estimatedDamage?: number;
}

export class UpdateIncidentStatusDto {
  @ApiProperty({ enum: IncidentStatus }) @IsEnum(IncidentStatus) status: IncidentStatus;
  @ApiPropertyOptional() @IsOptional() @IsString() resolutionNotes?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() linkedDisputeId?: string;
}
