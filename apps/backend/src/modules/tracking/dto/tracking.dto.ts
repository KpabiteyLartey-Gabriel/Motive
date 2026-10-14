import { IsString, IsOptional, IsNumber, IsBoolean, IsDateString, IsEnum, IsIn, IsInt, Min, Max } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TrackingDeviceStatus } from '@prisma/client';

export class RegisterDeviceDto {
  @ApiProperty() @IsString() vehicleId: string;
  @ApiProperty() @IsString() deviceSerial: string;
  @ApiPropertyOptional() @IsOptional() @IsString() deviceModel?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() simNumber?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() notes?: string;
}

export class UpdateDeviceStatusDto {
  @ApiProperty({ enum: TrackingDeviceStatus })
  @IsEnum(TrackingDeviceStatus)
  status: TrackingDeviceStatus;
}

export class IngestLocationDto {
  @ApiProperty() @IsString() deviceSerial: string;
  @ApiProperty() @IsNumber() latitude: number;
  @ApiProperty() @IsNumber() longitude: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() altitude?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() speed?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() heading?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() accuracy?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() address?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isMoving?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsDateString() recordedAt?: string;
}

export class CreateGeofenceDto {
  @ApiProperty() @IsString() name: string;
  @ApiPropertyOptional() @IsOptional() @IsString() description?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() type?: string;
  @ApiPropertyOptional() @IsOptional() @IsNumber() centerLat?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() centerLng?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() radiusMeters?: number;
  @ApiPropertyOptional() @IsOptional() polygon?: Array<{ lat: number; lng: number }>;
}

export class CreateLocationShareDto {
  @ApiProperty({ description: 'Vehicle ID to share location for' })
  @IsString()
  vehicleId: string;

  @ApiProperty({
    description: 'Share duration in hours',
    minimum: 1,
    maximum: 168,
    example: 24,
  })
  @IsInt()
  @Min(1)
  @Max(168)
  durationHours: number;

  @ApiPropertyOptional({ description: 'Optional label shown to the recipient', example: 'Track my Sprinter today' })
  @IsOptional()
  @IsString()
  label?: string;
}

export class RevokeLocationShareDto {
  // No body needed — share id comes from the URL param
}

export class IssueDeviceCommandDto {
  @ApiProperty({ enum: ['ENGINE_OFF', 'ENGINE_ON'] })
  @IsIn(['ENGINE_OFF', 'ENGINE_ON'])
  type: 'ENGINE_OFF' | 'ENGINE_ON';

  @ApiPropertyOptional({ example: 'Vehicle reported stolen' })
  @IsOptional() @IsString() reason?: string;
}

export class AckDeviceCommandDto {
  @ApiProperty() @IsString() deviceSerial: string;
}
