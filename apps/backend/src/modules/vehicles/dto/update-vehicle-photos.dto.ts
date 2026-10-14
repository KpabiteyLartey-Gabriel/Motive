import { IsArray, ArrayMaxSize, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateVehiclePhotosDto {
  @ApiProperty({ type: [String], description: 'Full photo list for the vehicle (https://… or /uploads/vehicles/…), max 10. Send [] to remove all photos.' })
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  imageUrls: string[];
}
