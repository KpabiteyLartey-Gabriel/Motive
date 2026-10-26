import { IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class GoogleAuthDto {
  @ApiProperty({ description: 'Google Identity Services ID token (credential) from Continue with Google' })
  @IsString()
  @MinLength(20)
  idToken: string;
}
