import { Body, Controller, Get, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { OnboardingService } from './onboarding.service';
import { SetAccountTypeDto, SubmitDriverLicenceDto, SubmitNationalIdDto } from './dto/onboarding.dto';

@ApiTags('Onboarding')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('onboarding')
export class OnboardingController {
  constructor(private readonly onboarding: OnboardingService) {}

  @Get('me')
  @ApiOperation({ summary: 'Current onboarding state: account, account type, National ID, and (drivers) licence steps' })
  async me(@CurrentUser() user: any) {
    return this.onboarding.getState(user.id);
  }

  @Post('account-type')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Step 2: choose Driver or Owner account type' })
  async setAccountType(@CurrentUser() user: any, @Body() dto: SetAccountTypeDto) {
    return this.onboarding.setAccountType(user.id, dto.accountType);
  }

  @Post('national-id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Step 3: submit National ID (Ghana Card) for verification' })
  async submitNationalId(@CurrentUser() user: any, @Body() dto: SubmitNationalIdDto) {
    return this.onboarding.submitNationalId(user.id, dto.ghanaCardNumber);
  }

  @Post('driver-licence')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Step 4 (drivers only): submit Driver's Licence for verification" })
  async submitDriverLicence(@CurrentUser() user: any, @Body() dto: SubmitDriverLicenceDto) {
    return this.onboarding.submitDriverLicence(user.id, dto);
  }
}
