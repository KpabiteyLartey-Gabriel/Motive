import {
  Controller, Get, Post, Patch, Param, Query, Body, UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { DisputeStatus } from '@prisma/client';
import { DisputesService } from './disputes.service';
import { CreateDisputeDto, AddDisputeMessageDto, ResolveDisputeDto } from './dto/dispute.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

class AssignDisputeDto {
  assigneeId: string;
}

@ApiTags('Disputes')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('disputes')
export class DisputesController {
  constructor(private readonly disputesService: DisputesService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new dispute' })
  async create(@CurrentUser() user: any, @Body() dto: CreateDisputeDto) {
    return this.disputesService.create(user.id, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List disputes' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'status', required: false, enum: DisputeStatus })
  @ApiQuery({ name: 'type', required: false })
  async findAll(
    @CurrentUser() user: any,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('status') status?: string,
    @Query('type') type?: string,
  ) {
    return this.disputesService.findAll({
      page, limit, status, type,
      userId: user.id,
      userRole: user.primaryRole,
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get dispute by ID' })
  async findOne(@Param('id') id: string, @CurrentUser() user: any) {
    return this.disputesService.findById(id, user.id, user.primaryRole);
  }

  @Post(':id/messages')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Add a message to a dispute' })
  async addMessage(
    @Param('id') id: string,
    @Body() dto: AddDisputeMessageDto,
    @CurrentUser() user: any,
  ) {
    return this.disputesService.addMessage(id, user.id, dto, user.primaryRole);
  }

  @Patch(':id/assign')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Assign dispute to a legal/dispute officer' })
  async assign(
    @Param('id') id: string,
    @Body() dto: AssignDisputeDto,
    @CurrentUser() user: any,
  ) {
    return this.disputesService.assign(id, dto.assigneeId, user.id);
  }

  @Patch(':id/resolve')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Resolve a dispute' })
  async resolve(
    @Param('id') id: string,
    @Body() dto: ResolveDisputeDto,
    @CurrentUser() user: any,
  ) {
    return this.disputesService.resolve(id, user.id, dto, user.primaryRole);
  }
}
