import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditAction } from '@prisma/client';

export interface AuditLogEntry {
  actorId?: string;
  action: AuditAction;
  resource: string;
  resourceId?: string;
  previousData?: any;
  newData?: any;
  ipAddress?: string;
  userAgent?: string;
  requestId?: string;
  metadata?: any;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  async log(entry: AuditLogEntry): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          actorId: entry.actorId,
          action: entry.action,
          resource: entry.resource,
          resourceId: entry.resourceId,
          previousData: entry.previousData,
          newData: entry.newData,
          ipAddress: entry.ipAddress,
          userAgent: entry.userAgent,
          requestId: entry.requestId,
          metadata: entry.metadata,
        },
      });
    } catch (error) {
      // Audit log failure must not break the main operation
      this.logger.error('Failed to write audit log', error);
    }
  }
}
