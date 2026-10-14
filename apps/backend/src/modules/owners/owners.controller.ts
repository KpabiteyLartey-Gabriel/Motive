import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { OwnersService } from './owners.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('Owners')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('owners')
export class OwnersController {
  constructor(private readonly ownersService: OwnersService) {}

  @Post('profile')
  @ApiOperation({ summary: 'Create owner profile for current user' })
  async createProfile(@CurrentUser() user: any, @Body() dto: any) {
    return this.ownersService.createProfile(user.id, dto);
  }

  @Get('profile')
  @ApiOperation({ summary: 'Get own owner profile' })
  async getMyProfile(@CurrentUser() user: any) {
    return this.ownersService.getProfile(user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get owner by ID' })
  async findOne(@Param('id') id: string) {
    return this.ownersService.getOwnerById(id);
  }
}
