import {
  Controller, Get, Post, Patch, Param, Query, Body, Headers,
  UseGuards, HttpCode, HttpStatus, RawBodyRequest, Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { PaymentStatus, UserRole } from '@prisma/client';
import { PaymentsService } from './payments.service';
import { InitiatePaymentDto } from './dto/initiate-payment.dto';
import { PaymentProviderFactory } from '../../integrations/payments/payment-provider.factory';
import { type PaymentProviderName } from '../../integrations/payments/interfaces/payment-provider.interface';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { IsString } from 'class-validator';

class SwitchProviderDto {
  @IsString() provider: PaymentProviderName;
}

@ApiTags('Payments')
@ApiBearerAuth('access-token')
@Controller('payments')
export class PaymentsController {
  constructor(
    private readonly paymentsService: PaymentsService,
    private readonly providerFactory: PaymentProviderFactory,
  ) {}

  // ── Initiate ───────────────────────────────────────────────
  @Post()
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Initiate a payment (calls active provider)' })
  async initiate(@CurrentUser() user: any, @Body() dto: InitiatePaymentDto) {
    return this.paymentsService.initiate(user.id, dto);
  }

  // ── List ───────────────────────────────────────────────────
  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'List payments' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'status', required: false, enum: PaymentStatus })
  @ApiQuery({ name: 'contractId', required: false })
  async findAll(
    @CurrentUser() user: any,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('status') status?: string,
    @Query('contractId') contractId?: string,
  ) {
    return this.paymentsService.findAll({
      page, limit, status, contractId,
      userId: user.id, userRole: user.primaryRole,
    });
  }

  // ── Transactions (ledger) ──────────────────────────────────
  @Get('transactions')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'List ledger transactions' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'contractId', required: false })
  async getTransactions(
    @CurrentUser() user: any,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('contractId') contractId?: string,
  ) {
    return this.paymentsService.getTransactions({
      page, limit, contractId,
      userId: user.id, userRole: user.primaryRole,
    });
  }

  // ── Get by ID ──────────────────────────────────────────────
  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get payment by ID' })
  async findOne(@Param('id') id: string, @CurrentUser() user: any) {
    return this.paymentsService.findById(id, user.id, user.primaryRole);
  }

  // ── Provider config (Admin only) ───────────────────────────
  @Get('provider/status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get active payment provider and available options (Admin)' })
  async getProviderStatus() {
    return this.providerFactory.getProviderStatus();
  }

  @Post('provider/switch')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Switch the active payment provider (Admin)' })
  async switchProvider(@Body() dto: SwitchProviderDto, @CurrentUser() user: any) {
    return this.providerFactory.setActiveProvider(dto.provider, user.id);
  }

  // ── Webhooks (no auth — verified by provider signature) ────

  /**
   * POST /payments/webhooks/hubtel
   * Receives Hubtel payment status callbacks.
   * Signature is verified inside handleHubtelWebhook via HMAC-SHA256.
   */
  @Post('webhooks/hubtel')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Hubtel payment webhook (no auth — signature verified)' })
  async hubtelWebhook(
    @Body() payload: any,
    @Headers() headers: Record<string, string>,
  ) {
    return this.paymentsService.handleHubtelWebhook(payload, headers);
  }

  /**
   * POST /payments/webhooks/mtn
   * Receives MTN MoMo payment status callbacks.
   * Status is verified by cross-referencing provider reference.
   */
  @Post('webhooks/mtn')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'MTN MoMo webhook (no auth — reference verified)' })
  async mtnWebhook(
    @Body() payload: any,
    @Headers() headers: Record<string, string>,
  ) {
    return this.paymentsService.handleMTNWebhook(payload, headers);
  }
}
