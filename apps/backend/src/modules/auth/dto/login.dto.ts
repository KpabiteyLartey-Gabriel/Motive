import { IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({ example: 'kofi.mensah@example.com', description: 'Email or phone number' })
  @IsString()
  identifier: string;

  @ApiProperty({ example: 'SecurePassword123!' })
  @IsString()
  password: string;
}
