import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class ExpressInterestDto {
  @ApiPropertyOptional({ description: 'Optional short message to the owner with your interest' })
  @IsString()
  @IsOptional()
  @MaxLength(500)
  message?: string;
}

export class SendMessageDto {
  @ApiPropertyOptional({ description: 'Message text' })
  @IsString()
  @IsOptional()
  @MaxLength(4000)
  body?: string;

  @ApiPropertyOptional({ description: 'URL of an attached document (e.g. a contract document uploaded first)' })
  @IsString()
  @IsOptional()
  attachmentUrl?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  attachmentName?: string;
}

export class SetChatUsernameDto {
  @ApiProperty({ description: 'Unique chat username, e.g. kwame.drives (letters, numbers, dot, underscore; 3-20 chars)' })
  @IsString()
  @MaxLength(24)
  chatUsername: string;
}

export class StartDirectThreadDto {
  @ApiProperty({ description: 'Chat username of the person to message, with or without @' })
  @IsString()
  @MaxLength(24)
  chatUsername: string;
}

export class ConfirmCodeDto {
  @ApiProperty({ description: 'The 6-digit access code the owner generated for you and shared in chat' })
  @IsString()
  code: string;
}
