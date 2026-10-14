import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { HealthService } from './health.service';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  @ApiOperation({ summary: 'Check application health' })
  async check() {
    return this.healthService.check();
  }

  @Get('database')
  @ApiOperation({ summary: 'Check database connectivity' })
  async checkDatabase() {
    return this.healthService.checkDatabase();
  }
}
