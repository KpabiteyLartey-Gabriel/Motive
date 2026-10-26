import {
  Controller, Get, Post, Patch, Body, Param, Query, UseGuards, HttpCode, HttpStatus
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { CompanyType } from '@prisma/client';
import { CompaniesService } from './companies.service';
import { AddCompanyMemberDto, UpdateCompanyMemberRoleDto, SetCompanyMemberActiveDto, CreateInviteDto, AcceptInviteDto } from './dto/company-members.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Public } from '../auth/decorators/public.decorator';

@ApiTags('Companies')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('companies')
export class CompaniesController {
  constructor(private readonly companiesService: CompaniesService) {}

  @Post()
  @ApiOperation({ summary: 'Register a new company' })
  async create(@CurrentUser() user: any, @Body() dto: any) {
    return this.companiesService.create(user.id, dto);
  }

  @Get('mine')
  @ApiOperation({ summary: 'Companies the current user belongs to (provisions one for company admins)' })
  async mine(@CurrentUser() user: any) {
    return this.companiesService.getMyCompanies(user);
  }

  @Get()
  @ApiOperation({ summary: 'List companies' })
  async findAll(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('type') type?: CompanyType,
  ) {
    return this.companiesService.findAll({ page, limit, type });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get company by ID' })
  async findOne(@Param('id') id: string) {
    return this.companiesService.findById(id);
  }

  @Get(':id/members')
  @ApiOperation({ summary: 'List company members (company members only)' })
  async listMembers(@Param('id') id: string, @CurrentUser() user: any) {
    return this.companiesService.listMembers(id, user.id, user.primaryRole);
  }

  @Post(':id/members')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Add a user to the company by email (company admin only)' })
  async addMember(@Param('id') id: string, @CurrentUser() user: any, @Body() dto: AddCompanyMemberDto) {
    return this.companiesService.addMember(id, user.id, user.primaryRole, dto);
  }

  @Patch(':id/members/:memberId/role')
  @ApiOperation({ summary: 'Change a member role/title (company admin only)' })
  async updateMemberRole(@Param('id') id: string, @Param('memberId') memberId: string, @CurrentUser() user: any, @Body() dto: UpdateCompanyMemberRoleDto) {
    return this.companiesService.updateMemberRole(id, memberId, user.id, user.primaryRole, dto);
  }

  @Patch(':id/members/:memberId/active')
  @ApiOperation({ summary: 'Activate/deactivate a member (company admin only)' })
  async setMemberActive(@Param('id') id: string, @Param('memberId') memberId: string, @CurrentUser() user: any, @Body() dto: SetCompanyMemberActiveDto) {
    return this.companiesService.setMemberActive(id, memberId, dto.isActive, user.id, user.primaryRole);
  }

  @Post(':id/invites')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Invite a person by email or phone (company admin only). Adds them directly if they already have an account; otherwise sends an invite link by SMS/email.' })
  async createInvite(@Param('id') id: string, @CurrentUser() user: any, @Body() dto: CreateInviteDto) {
    return this.companiesService.createInvite(id, user.id, user.primaryRole, dto);
  }

  @Get(':id/invites')
  @ApiOperation({ summary: 'List company invites (company admin only)' })
  async listInvites(@Param('id') id: string, @CurrentUser() user: any) {
    return this.companiesService.listInvites(id, user.id, user.primaryRole);
  }

  @Post(':id/invites/:inviteId/resend')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Resend an invite with a fresh link (company admin only)' })
  async resendInvite(@Param('id') id: string, @Param('inviteId') inviteId: string, @CurrentUser() user: any) {
    return this.companiesService.resendInvite(id, inviteId, user.id, user.primaryRole);
  }

  @Post(':id/invites/:inviteId/revoke')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Revoke a pending invite (company admin only)' })
  async revokeInvite(@Param('id') id: string, @Param('inviteId') inviteId: string, @CurrentUser() user: any) {
    return this.companiesService.revokeInvite(id, inviteId, user.id, user.primaryRole);
  }
}

@ApiTags('Invites')
@Controller('invites')
export class InvitesController {
  constructor(private readonly companiesService: CompaniesService) {}

  @Public()
  @Get(':token')
  @ApiOperation({ summary: 'Resolve an invite link (public): company, role and contact to prefill onboarding' })
  async resolve(@Param('token') token: string) {
    return this.companiesService.resolveInvite(token);
  }

  @Public()
  @Post(':token/accept')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Accept an invite: creates the account tied to the company with the invited role (public)' })
  async accept(@Param('token') token: string, @Body() dto: AcceptInviteDto) {
    return this.companiesService.acceptInvite(token, dto);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @Post(':token/accept-existing')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Accept an invite while signed in: joins the company and keeps existing personal accounts' })
  async acceptExisting(@Param('token') token: string, @CurrentUser() user: any) {
    return this.companiesService.acceptInviteAsUser(token, user.id);
  }
}
