import { BadRequestException, Body, Controller, Get, HttpCode, HttpStatus, Param, Post, UploadedFiles, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AccountsService } from './accounts.service';
import { AccountCreationService } from './account-creation.service';
import { ConfirmCreationInterestDto, CreateCompanyAccountDto, CreateServiceProviderDto, PayAccountCreationDto } from './dto/accounts.dto';
import { SubmitDriverLicenceDto, SubmitNationalIdDto } from '../onboarding/dto/onboarding.dto';

@ApiTags('Accounts')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('accounts')
export class AccountsController {
  constructor(
    private readonly accounts: AccountsService,
    private readonly creation: AccountCreationService,
  ) {}

  @Get('me')
  @ApiOperation({ summary: 'All accounts the signed-in user holds: Driver, Owner, Service Provider, Company, plus company memberships' })
  async me(@CurrentUser() user: any) {
    return this.accounts.getMyAccounts(user.id);
  }

  // ── Paid Driver/Owner creation ─────────────────────────────
  // No free direct create: start -> confirm code -> pay -> the account
  // is provisioned on confirmed payment.
  @Get('me/creation/charges')
  @ApiOperation({ summary: 'Current Driver/Owner account creation charges (set by an admin)' })
  async creationCharges() {
    return this.creation.getCharges();
  }

  @Post('me/creation/:kind/start')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Start Driver/Owner creation: sends one interest code to phone, email and in-app notifications' })
  async creationStart(@CurrentUser() user: any, @Param('kind') kind: string) {
    return this.creation.start(user.id, kind);
  }

  @Post('me/creation/:kind/confirm')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Confirm interest in a Driver/Owner account with the 6-digit code' })
  async creationConfirm(@CurrentUser() user: any, @Param('kind') kind: string, @Body() dto: ConfirmCreationInterestDto) {
    return this.creation.confirm(user.id, kind, dto.code);
  }

  @Post('me/creation/:kind/pay')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Pay the Driver/Owner account creation charge; the account is created on confirmed payment' })
  async creationPay(@CurrentUser() user: any, @Param('kind') kind: string, @Body() dto: PayAccountCreationDto) {
    return this.creation.pay(user.id, kind, dto);
  }

  @Get('me/creation/:kind/status')
  @ApiOperation({ summary: 'Driver/Owner creation order status (polls a pending payment)' })
  async creationStatus(@CurrentUser() user: any, @Param('kind') kind: string) {
    return this.creation.status(user.id, kind);
  }

  @Post('me/service-provider')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a Service Provider account (active immediately, no verification)' })
  async createServiceProvider(@CurrentUser() user: any, @Body() dto: CreateServiceProviderDto) {
    return this.accounts.createServiceProvider(user.id, dto);
  }

  @Post('me/company')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a Company account (only for users without Driver/Owner/Service Provider accounts); creator becomes Company Admin' })
  async createCompany(@CurrentUser() user: any, @Body() dto: CreateCompanyAccountDto) {
    return this.accounts.createCompany(user.id, dto);
  }

  @Post('me/driver/national-id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Submit National ID for the Driver account' })
  async driverNationalId(@CurrentUser() user: any, @Body() dto: SubmitNationalIdDto) {
    return this.accounts.submitNationalId(user.id, 'DRIVER', dto.ghanaCardNumber);
  }

  @Post('me/owner/national-id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Submit National ID for the Owner account' })
  async ownerNationalId(@CurrentUser() user: any, @Body() dto: SubmitNationalIdDto) {
    return this.accounts.submitNationalId(user.id, 'OWNER', dto.ghanaCardNumber);
  }

  @Post('me/identity-verification')
  @HttpCode(HttpStatus.OK)
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Submit identity verification for a Driver/Owner account: Ghana Card number, card front + back images, and a live camera capture. Reviewed by a person — never auto-approved.' })
  @UseInterceptors(FileFieldsInterceptor(
    [
      { name: 'idFront', maxCount: 1 },
      { name: 'idBack', maxCount: 1 },
      { name: 'selfie', maxCount: 1 },
    ],
    {
      limits: { fileSize: 10 * 1024 * 1024 },
      fileFilter: (_req: any, file: any, cb: any) => cb(null, /^(image\/(jpeg|png|webp))$/.test(file.mimetype || '')),
    },
  ))
  async identityVerification(
    @CurrentUser() user: any,
    @Body() body: { kind?: string; ghanaCardNumber?: string; livenessChallenge?: string; livenessPassed?: string },
    @UploadedFiles() files: { idFront?: any[]; idBack?: any[]; selfie?: any[] },
  ) {
    const kind = String(body?.kind || '').toUpperCase();
    if (kind !== 'DRIVER' && kind !== 'OWNER') throw new BadRequestException('Account kind must be DRIVER or OWNER.');
    return this.accounts.submitIdentityVerification(
      user.id,
      kind as 'DRIVER' | 'OWNER',
      body?.ghanaCardNumber || '',
      { idFront: files?.idFront?.[0], idBack: files?.idBack?.[0], selfie: files?.selfie?.[0] },
      body?.livenessChallenge,
      body?.livenessPassed === 'true',
    );
  }

  @Post('me/driver/licence-verification')
  @HttpCode(HttpStatus.OK)
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: "Driver Phase 2 (unlocks after Ghana Card + live face check): licence details with front + back of the Driver's Licence" })
  @UseInterceptors(FileFieldsInterceptor(
    [
      { name: 'licenceFront', maxCount: 1 },
      { name: 'licenceBack', maxCount: 1 },
    ],
    {
      limits: { fileSize: 10 * 1024 * 1024 },
      fileFilter: (_req: any, file: any, cb: any) => cb(null, /^(image\/(jpeg|png|webp))$/.test(file.mimetype || '')),
    },
  ))
  async licenceVerification(
    @CurrentUser() user: any,
    @Body() body: { licenseNumber?: string; licenseClass?: string; licenseExpiryDate?: string },
    @UploadedFiles() files: { licenceFront?: any[]; licenceBack?: any[] },
  ) {
    if (!body?.licenseNumber) throw new BadRequestException("Enter your Driver's Licence number.");
    return this.accounts.submitLicenceVerification(
      user.id,
      { licenseNumber: body.licenseNumber, licenseClass: body.licenseClass, licenseExpiryDate: body.licenseExpiryDate },
      { licenceFront: files?.licenceFront?.[0], licenceBack: files?.licenceBack?.[0] },
    );
  }

  @Post('me/driver/licence')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Submit Driver's Licence for the Driver account" })
  async driverLicence(@CurrentUser() user: any, @Body() dto: SubmitDriverLicenceDto) {
    return this.accounts.submitDriverLicence(user.id, dto);
  }
}
