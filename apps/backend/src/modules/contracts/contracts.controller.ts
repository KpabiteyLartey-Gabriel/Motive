import {
  Controller, Get, Post, Patch, Param, Query, Body, UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { IsString, IsOptional } from 'class-validator';
import { ContractStatus, ContractType } from '@prisma/client';
import { ContractsService } from './contracts.service';
import { CreateContractDto, ShareContractDto } from './dto/create-contract.dto';
import { ConfirmCodeDto } from '../marketplace/dto/marketplace.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

class TerminateContractDto {
  @IsString() reason: string;
}

class UpdateContractStatusDto {
  @IsString() status: string;
}

@ApiTags('Contracts')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('contracts')
export class ContractsController {
  constructor(private readonly contractsService: ContractsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new contract' })
  async create(@CurrentUser() user: any, @Body() dto: CreateContractDto) {
    return this.contractsService.create(user.id, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List contracts' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'status', required: false, enum: ContractStatus })
  @ApiQuery({ name: 'type', required: false, enum: ContractType })
  async findAll(
    @CurrentUser() user: any,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('status') status?: string,
    @Query('type') type?: string,
    @Query('vehicleId') vehicleId?: string,
  ) {
    return this.contractsService.findAll({
      page, limit, status, type, vehicleId,
      userId: user.id,
      userRole: user.primaryRole,
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get contract by ID' })
  async findOne(@Param('id') id: string, @CurrentUser() user: any) {
    return this.contractsService.findById(id, user.id, user.primaryRole);
  }

  @Post(':id/accept')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Accept / sign a contract' })
  async accept(@Param('id') id: string, @CurrentUser() user: any) {
    return this.contractsService.acceptContract(id, user.id);
  }

  @Post(':id/share')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Owner shares a draft contract with a driver by chat username (posts a contract card in chat, returns the confirmation code once)' })
  async share(@Param('id') id: string, @CurrentUser() user: any, @Body() dto: ShareContractDto) {
    return this.contractsService.shareContract(id, user.id, dto.chatUsername);
  }

  @Post(':id/confirm-code')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Driver confirms (signs) an Explore contract with the owner-issued access code' })
  async confirmCode(@Param('id') id: string, @CurrentUser() user: any, @Body() dto: ConfirmCodeDto) {
    return this.contractsService.confirmWithCode(id, user.id, dto.code);
  }

  @Patch(':id/status')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Change contract status (legal / platform admin oversight)' })
  async updateStatus(@Param('id') id: string, @Body() dto: UpdateContractStatusDto, @CurrentUser() user: any) {
    return this.contractsService.updateStatus(id, user.id, user.primaryRole, dto.status);
  }

  @Patch(':id/terminate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Terminate a contract' })
  async terminate(
    @Param('id') id: string,
    @Body() dto: TerminateContractDto,
    @CurrentUser() user: any,
  ) {
    return this.contractsService.terminateContract(id, user.id, dto.reason);
  }

  @Get(':id/schedule')
  @ApiOperation({ summary: 'Get payment schedule for a contract' })
  async getSchedule(@Param('id') id: string, @CurrentUser() user: any) {
    return this.contractsService.getPaymentSchedule(id, user.id, user.primaryRole);
  }
}
