import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { OwnershipTransferStatus } from '@prisma/client';
import { OwnershipTransferService } from './ownership-transfer.service';
import {
  RequestOwnershipTransferDto,
  ReviewOwnershipTransferDto,
  ApproveOwnershipTransferDto,
  RejectOwnershipTransferDto,
} from './dto/ownership-transfer.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('Ownership Transfers')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('ownership-transfers')
export class OwnershipTransferController {
  constructor(private readonly service: OwnershipTransferService) {}

  /**
   * GET /ownership-transfers/eligibility/:contractId
   * Check whether a Work & Pay contract qualifies for an ownership transfer.
   */
  @Get('eligibility/:contractId')
  @ApiOperation({ summary: 'Check ownership transfer eligibility for a Work & Pay contract' })
  async checkEligibility(
    @Param('contractId') contractId: string,
    @CurrentUser() user: any,
  ) {
    return this.service.checkEligibility(contractId, user.id);
  }

  /**
   * POST /ownership-transfers
   * Driver requests an ownership transfer after completing their Work & Pay obligations.
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Request an ownership transfer (driver/owner)' })
  async requestTransfer(
    @Body() dto: RequestOwnershipTransferDto,
    @CurrentUser() user: any,
  ) {
    return this.service.requestTransfer(dto.contractId, user.id);
  }

  /**
   * GET /ownership-transfers
   * List transfers — drivers/owners see their own; admins see all.
   */
  @Get()
  @ApiOperation({ summary: 'List ownership transfers' })
  @ApiQuery({ name: 'page',      required: false })
  @ApiQuery({ name: 'limit',     required: false })
  @ApiQuery({ name: 'status',    required: false })
  @ApiQuery({ name: 'vehicleId', required: false })
  async findAll(
    @CurrentUser() user: any,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('status') status?: OwnershipTransferStatus,
    @Query('vehicleId') vehicleId?: string,
  ) {
    return this.service.findAll({
      page, limit, status, vehicleId,
      userId: user.id,
      userRole: user.primaryRole,
    });
  }

  /**
   * GET /ownership-transfers/:id
   */
  @Get(':id')
  @ApiOperation({ summary: 'Get ownership transfer by ID' })
  async findOne(@Param('id') id: string) {
    return this.service.findById(id);
  }

  /**
   * PATCH /ownership-transfers/:id/request-documents
   * Admin requests additional documents before proceeding.
   */
  @Patch(':id/request-documents')
  @ApiOperation({ summary: '[Admin] Request documents for a transfer' })
  async requestDocuments(
    @Param('id') id: string,
    @Body() dto: ReviewOwnershipTransferDto,
    @CurrentUser() user: any,
  ) {
    return this.service.requestDocuments(
      id, dto.documentsRequired ?? [], dto.reviewNotes, user.id,
    );
  }

  /**
   * PATCH /ownership-transfers/:id/approve
   * Admin approves the transfer — ready for final execution.
   */
  @Patch(':id/approve')
  @ApiOperation({ summary: '[Admin] Approve an ownership transfer' })
  async approveTransfer(
    @Param('id') id: string,
    @Body() dto: ApproveOwnershipTransferDto,
    @CurrentUser() user: any,
  ) {
    return this.service.approveTransfer(id, dto.approvalNotes, user.id);
  }

  /**
   * PATCH /ownership-transfers/:id/complete
   * Admin executes the actual ownership handover.
   * Updates vehicle owner record and marks transfer TRANSFERRED.
   */
  @Patch(':id/complete')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '[Admin] Complete an ownership transfer — executes the handover' })
  async completeTransfer(
    @Param('id') id: string,
    @CurrentUser() user: any,
  ) {
    return this.service.completeTransfer(id, user.id);
  }

  /**
   * PATCH /ownership-transfers/:id/reject
   * Admin rejects the transfer.
   */
  @Patch(':id/reject')
  @ApiOperation({ summary: '[Admin] Reject an ownership transfer' })
  async rejectTransfer(
    @Param('id') id: string,
    @Body() dto: RejectOwnershipTransferDto,
    @CurrentUser() user: any,
  ) {
    return this.service.rejectTransfer(id, dto.reason, user.id);
  }
}
