import { IsString, IsOptional, IsEnum, IsDateString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ComplianceDocumentType, ComplianceStatus } from '@prisma/client';

export class CreateComplianceRecordDto {
  @ApiProperty({ enum: ComplianceDocumentType }) @IsEnum(ComplianceDocumentType) documentType: ComplianceDocumentType;
  @ApiPropertyOptional() @IsOptional() @IsString() vehicleId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() driverId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() documentNumber?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() issuer?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() issueDate?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() expiryDate?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() fileUrl?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() fileName?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() notes?: string;
}

export class UpdateComplianceStatusDto {
  @ApiProperty({ enum: ComplianceStatus }) @IsEnum(ComplianceStatus) status: ComplianceStatus;
  @ApiPropertyOptional() @IsOptional() @IsString() notes?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() expiryDate?: string;
}
