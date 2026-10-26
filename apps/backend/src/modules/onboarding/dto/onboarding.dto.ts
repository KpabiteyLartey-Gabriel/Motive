import { IsEnum, IsString, IsOptional, IsDateString, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum AccountType {
  DRIVER = 'DRIVER',
  OWNER = 'OWNER',
}

export class SetAccountTypeDto {
  @ApiProperty({ enum: AccountType, example: AccountType.DRIVER })
  @IsEnum(AccountType)
  accountType: AccountType;
}

export class SubmitNationalIdDto {
  @ApiProperty({ example: 'GHA-123456789-0', description: 'National ID (Ghana Card) number in the format GHA-000000000-0 (GHA, 9 digits, check digit). Undashed input is formatted automatically.' })
  @IsString()
  @MinLength(5)
  ghanaCardNumber: string;
}

export class SubmitDriverLicenceDto {
  @ApiProperty({ example: 'GH-123456789' })
  @IsString()
  @MinLength(4)
  licenseNumber: string;

  @ApiPropertyOptional({ example: 'Class B' })
  @IsString()
  @IsOptional()
  licenseClass?: string;

  @ApiPropertyOptional({ example: '2028-05-01' })
  @IsDateString()
  @IsOptional()
  licenseExpiryDate?: string;
}
