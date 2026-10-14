import { IsString, IsNumber, IsPositive, IsOptional, IsEnum } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class InitiatePaymentDto {
  @ApiProperty({ example: 'cld1234...' })
  @IsString()
  contractId: string;

  @ApiPropertyOptional({ example: 'cld5678...' })
  @IsString()
  @IsOptional()
  paymentScheduleId?: string;

  @ApiPropertyOptional({ example: 'cld9999...' })
  @IsString()
  @IsOptional()
  paymentObligationId?: string;

  @ApiProperty({ example: 500.00 })
  @IsNumber()
  @IsPositive()
  amount: number;

  @ApiProperty({ example: '0244000000' })
  @IsString()
  payerPhone: string;

  @ApiProperty({ example: 'MOMO' })
  @IsString()
  paymentMethod: string;

  @ApiPropertyOptional({ example: 'MTN' })
  @IsString()
  @IsOptional()
  paymentProvider?: string;
}
