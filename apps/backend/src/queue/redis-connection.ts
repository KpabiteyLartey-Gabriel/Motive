import { ConfigService } from '@nestjs/config';

// Shared Redis connection options for the notification queue and worker.
// BullMQ's Worker requires maxRetriesPerRequest to be null.
export function buildRedisConnection(config: ConfigService) {
  return {
    host: config.get<string>('REDIS_HOST', 'localhost'),
    port: Number(config.get<string>('REDIS_PORT') || 6379),
    password: config.get<string>('REDIS_PASSWORD') || undefined,
    maxRetriesPerRequest: null as null,
  };
}
