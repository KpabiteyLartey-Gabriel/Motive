import {
  Controller, Get, Post, Patch, Param, Body, UseGuards, UseInterceptors, UploadedFile,
  BadRequestException, HttpCode, HttpStatus,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiConsumes } from '@nestjs/swagger';
import { MarketplaceService } from './marketplace.service';
import { ExpressInterestDto, SendMessageDto } from './dto/marketplace.dto';
import { StorageService } from '../storage/storage.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

const IMAGE_OR_DOC = /^(image\/(png|jpe?g|webp|gif)|application\/pdf)$/i;

@ApiTags('Marketplace')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('marketplace')
export class MarketplaceController {
  constructor(
    private readonly marketplace: MarketplaceService,
    private readonly storage: StorageService,
  ) {}

  @Get('explore')
  @ApiOperation({ summary: 'Verified, published vehicles still open to drivers on Explore' })
  async explore(@CurrentUser() user: any) {
    return this.marketplace.explore(user.id);
  }

  @Post('vehicles/:vehicleId/interest')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Driver shows interest in a vehicle (starts a chat with the owner)' })
  async expressInterest(@Param('vehicleId') vehicleId: string, @CurrentUser() user: any, @Body() dto: ExpressInterestDto) {
    return this.marketplace.expressInterest(user.id, vehicleId, dto.message);
  }

  @Get('vehicles/:vehicleId/interests')
  @ApiOperation({ summary: 'Owner side: drivers who showed interest in this vehicle' })
  async vehicleInterests(@Param('vehicleId') vehicleId: string, @CurrentUser() user: any) {
    return this.marketplace.vehicleInterests(user.id, user.primaryRole, vehicleId);
  }

  @Get('my-interests')
  @ApiOperation({ summary: 'Driver: my vehicle interests' })
  async myInterests(@CurrentUser() user: any) {
    return this.marketplace.myInterests(user.id);
  }

  @Post('interests/:interestId/approve')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Owner approves one driver (vehicle leaves Explore)' })
  async approve(@Param('interestId') interestId: string, @CurrentUser() user: any) {
    return this.marketplace.approveInterest(user.id, user.primaryRole, interestId);
  }

  @Post('interests/:interestId/decline')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Owner declines a driver interest' })
  async decline(@Param('interestId') interestId: string, @CurrentUser() user: any) {
    return this.marketplace.declineInterest(user.id, user.primaryRole, interestId);
  }

  @Post('interests/:interestId/release')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Owner releases an approved driver (vehicle returns to Explore, codes revoked)' })
  async release(@Param('interestId') interestId: string, @CurrentUser() user: any) {
    return this.marketplace.releaseInterest(user.id, user.primaryRole, interestId);
  }

  @Get('threads')
  @ApiOperation({ summary: 'My chat conversations (owner or driver)' })
  async threads(@CurrentUser() user: any) {
    return this.marketplace.myThreads(user.id);
  }

  @Get('threads/:threadId/messages')
  @ApiOperation({ summary: 'Messages in a conversation (marks them read)' })
  async messages(@Param('threadId') threadId: string, @CurrentUser() user: any) {
    return this.marketplace.listMessages(user.id, threadId);
  }

  @Post('threads/:threadId/messages')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Send a chat message or document link' })
  async send(@Param('threadId') threadId: string, @CurrentUser() user: any, @Body() dto: SendMessageDto) {
    return this.marketplace.sendMessage(user.id, threadId, dto);
  }

  @Post('threads/:threadId/attachments')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Upload a document/image to send in this chat (multipart, field "file")' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', {
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (_req: any, file: any, cb: any) => cb(null, IMAGE_OR_DOC.test(file.mimetype || '')),
  }))
  async uploadAttachment(@Param('threadId') threadId: string, @CurrentUser() user: any, @UploadedFile() file: any) {
    if (!file) throw new BadRequestException('No file received (field "file", images or PDF, max 10MB)');
    // participant check happens on send; store under the thread folder
    const stored = await this.storage.uploadFile(file, `chat/${threadId}`);
    return { url: stored.url, name: file.originalname || 'document' };
  }

  @Post('contracts/:contractId/access-code')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Owner generates the one-driver access code for a contract (returned once — share it in chat)' })
  async generateCode(@Param('contractId') contractId: string, @CurrentUser() user: any) {
    return this.marketplace.generateAccessCode(user.id, contractId);
  }
}
