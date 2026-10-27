import { IsEnum, IsNumber, IsOptional, IsPositive, IsString, Length, MinLength } from 'class-validator';
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

export class ConfirmCreationInterestDto {
  @ApiProperty({ example: '123456', description: 'The 6-digit code sent to your phone, email and in-app notifications' })
  @IsString() @Length(6, 6)
  code: string;
}

export class PayAccountCreationDto {
  @ApiProperty({ example: '0244000000', description: 'Mobile money number to charge' })
  @IsString() @MinLength(7)
  payerPhone: string;

  @ApiPropertyOptional({ example: 'MOMO' })
  @IsString() @IsOptional()
  paymentMethod?: string;

  @ApiPropertyOptional({ example: 'MTN' })
  @IsString() @IsOptional()
  paymentProvider?: string;
}

export class UpdateChargeDto {
  @ApiProperty({ example: 20, description: 'Account creation charge in GHS' })
  @IsNumber() @IsPositive()
  amountGhs: number;
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
