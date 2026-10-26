import { IsEnum, IsOptional, IsString, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CompanyType } from '@prisma/client';

export class CreateServiceProviderDto {
  @ApiProperty({ example: 'Ama Auto Works' })
  @IsString() @MinLength(2)
  businessName: string;

  @ApiProperty({ example: 'Mechanic', description: 'What service the business provides, e.g. Mechanic, Tyre shop, Towing, Car wash' })
  @IsString() @MinLength(2)
  serviceType: string;

  @ApiPropertyOptional() @IsString() @IsOptional() phone?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() address?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() city?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() region?: string;
}

export class CreateCompanyAccountDto {
  @ApiProperty({ example: 'Ama Transport Ltd' })
  @IsString() @MinLength(2)
  name: string;

  @ApiPropertyOptional({ enum: CompanyType, example: CompanyType.TRANSPORT })
  @IsEnum(CompanyType) @IsOptional()
  type?: CompanyType;

  @ApiPropertyOptional() @IsString() @IsOptional() email?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() phone?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() city?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() region?: string;
}
