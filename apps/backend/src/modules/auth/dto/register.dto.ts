import { IsEmail, IsOptional, IsString, MinLength, IsEnum, IsMobilePhone } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';

export class RegisterDto {
  @ApiPropertyOptional({ example: 'kofi.mensah@example.com' })
  @IsEmail()
  @IsOptional()
  email?: string;

  @ApiPropertyOptional({ example: '+233201234567' })
  @IsString()
  @IsOptional()
  phone?: string;

  @ApiProperty({ example: 'Kofi' })
  @IsString()
  firstName: string;

  @ApiProperty({ example: 'Mensah' })
  @IsString()
  lastName: string;

  @ApiProperty({ example: 'SecurePassword123!' })
  @IsString()
  @MinLength(8)
  password: string;

  @ApiPropertyOptional({ enum: UserRole, example: UserRole.DRIVER, description: 'Optional. Omit during new onboarding: the account starts as PENDING and the user picks Driver or Owner in the next step.' })
  @IsEnum(UserRole)
  @IsOptional()
  role?: UserRole;
}
