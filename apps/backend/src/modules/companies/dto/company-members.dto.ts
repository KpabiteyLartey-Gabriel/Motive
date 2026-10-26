import { IsEmail, IsIn, IsOptional, IsString, IsBoolean, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';

export const COMPANY_MEMBER_ROLES = [
  UserRole.COMPANY_ADMIN,
  UserRole.FLEET_MANAGER,
  UserRole.COMPANY_MEMBER,
  UserRole.SERVICE_PROVIDER,
  UserRole.DRIVER,
  UserRole.OWNER,
] as const;

export class AddCompanyMemberDto {
  @ApiProperty({ example: 'fleet.manager@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ enum: COMPANY_MEMBER_ROLES, example: UserRole.FLEET_MANAGER })
  @IsIn(COMPANY_MEMBER_ROLES as unknown as string[])
  role: UserRole;

  @ApiPropertyOptional({ example: 'Fleet Manager — Accra operations' })
  @IsString()
  @IsOptional()
  title?: string;
}

export class UpdateCompanyMemberRoleDto {
  @ApiProperty({ enum: COMPANY_MEMBER_ROLES })
  @IsIn(COMPANY_MEMBER_ROLES as unknown as string[])
  role: UserRole;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  title?: string;
}

export class SetCompanyMemberActiveDto {
  @ApiProperty()
  @IsBoolean()
  isActive: boolean;
}

export class CreateInviteDto {
  @ApiProperty({ example: 'person@example.com or +233244000000', description: 'Email address or phone number of the person to invite' })
  @IsString()
  contact: string;

  @ApiProperty({ enum: COMPANY_MEMBER_ROLES, example: UserRole.FLEET_MANAGER })
  @IsIn(COMPANY_MEMBER_ROLES as unknown as string[])
  role: UserRole;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  title?: string;
}

export class AcceptInviteDto {
  @ApiProperty() @IsString() firstName: string;
  @ApiProperty() @IsString() lastName: string;
  @ApiProperty({ minLength: 8 }) @IsString() @MinLength(8) password: string;
  @ApiPropertyOptional() @IsString() @IsOptional() email?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() phone?: string;
}
