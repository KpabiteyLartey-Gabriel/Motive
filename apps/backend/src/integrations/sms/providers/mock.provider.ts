import { Injectable, Logger } from '@nestjs/common';
import { ISmsProvider, SmsSendRequest, SmsSendResponse } from '../interfaces/sms-provider.interface';

/**
 * MockSmsProvider — used in development and tests.
 * Logs to console and returns success immediately.
 * Never runs in production: SmsIntegrationModule guards against it.
 */
@Injectable()
export class MockSmsProvider implements ISmsProvider {
  readonly name = 'MOCK';
  private readonly logger = new Logger(MockSmsProvider.name);

  async send(req: SmsSendRequest): Promise<SmsSendResponse> {
    this.logger.log(`[MockSMS] → ${req.to}: "${req.message}"`);
    return { success: true, messageId: `mock-${Date.now()}`, status: 'mock_sent' };
  }
}
