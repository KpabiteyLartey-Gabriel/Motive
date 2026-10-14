import { IsString, IsIn, IsOptional } from 'class-validator';

export class RegisterPushTokenDto {
  @IsString()
  token: string;

  @IsIn(['ios', 'android'])
  platform: 'ios' | 'android';

  @IsOptional()
  @IsString()
  deviceId?: string;
}
