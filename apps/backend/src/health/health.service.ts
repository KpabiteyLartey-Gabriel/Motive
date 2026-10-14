import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class HealthService {
  constructor(private readonly prisma: PrismaService) {}

  async check() {
    const db = await this.checkDatabase();
    return {
      status: db.status === 'ok' ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      services: {
        database: db,
      },
    };
  }

  async checkDatabase() {
    try {
      const healthy = await this.prisma.healthCheck();
      return {
        status: healthy ? 'ok' : 'error',
        message: healthy ? 'Database connected' : 'Database unreachable',
      };
    } catch (error) {
      return {
        status: 'error',
        message: 'Database check failed',
      };
    }
  }
}
