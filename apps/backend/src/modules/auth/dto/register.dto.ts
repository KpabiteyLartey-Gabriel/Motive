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

  @ApiProperty({ enum: UserRole, example: UserRole.DRIVER })
  @IsEnum(UserRole)
  role: UserRole;
}
