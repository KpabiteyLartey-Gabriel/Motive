import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ServicesService } from './services.service';
import { CreateProviderServiceDto, RequestServiceDto, UpdateProviderServiceDto, UpdateServiceRequestStatusDto } from './dto/services.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('Services')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('services')
export class ServicesController {
  constructor(private readonly services: ServicesService) {}

  @Get()
  @ApiOperation({ summary: 'Published provider services — shown in Servicing for owners, drivers and users' })
  async list(@Query('category') category?: string, @Query('q') q?: string) {
    return this.services.listPublic({ category, q });
  }

  @Get('mine')
  @ApiOperation({ summary: 'Services published by my Service Provider account' })
  async mine(@CurrentUser() user: any) {
    return this.services.listMine(user.id);
  }

  @Get('requests/mine')
  @ApiOperation({ summary: 'Service requests I have made' })
  async myRequests(@CurrentUser() user: any) {
    return this.services.listMyRequests(user.id);
  }

  @Get('requests/incoming')
  @ApiOperation({ summary: 'Requests for my services (Service Provider account)' })
  async incomingRequests(@CurrentUser() user: any) {
    return this.services.listIncomingRequests(user.id);
  }

  @Post(':id/request')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Request this service for a vehicle' })
  async request(@CurrentUser() user: any, @Param('id') id: string, @Body() dto: RequestServiceDto) {
    return this.services.requestService(user.id, id, dto);
  }

  @Patch('requests/:id/status')
  @ApiOperation({ summary: 'Provider accepts/declines/completes a request; requester cancels' })
  async updateRequestStatus(@CurrentUser() user: any, @Param('id') id: string, @Body() dto: UpdateServiceRequestStatusDto) {
    return this.services.updateRequestStatus(user.id, id, dto);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Publish a service (Service Provider account required)' })
  async create(@CurrentUser() user: any, @Body() dto: CreateProviderServiceDto) {
    return this.services.create(user.id, dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update one of my published services' })
  async update(@CurrentUser() user: any, @Param('id') id: string, @Body() dto: UpdateProviderServiceDto) {
    return this.services.update(user.id, id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Remove one of my published services' })
  async remove(@CurrentUser() user: any, @Param('id') id: string) {
    return this.services.remove(user.id, id);
  }
}
