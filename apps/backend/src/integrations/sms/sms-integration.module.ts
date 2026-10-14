import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ArkeselSmsProvider } from './providers/arkesel.provider';
import { MockSmsProvider } from './providers/mock.provider';
import { ISmsProvider } from './interfaces/sms-provider.interface';

export const SMS_PROVIDER = 'SMS_PROVIDER';

/**
 * SmsIntegrationModule
 *
 * Selects the active SMS provider based on the SMS_PROVIDER env var.
 *
 *   SMS_PROVIDER=arkesel  → ArkeselSmsProvider (production default)
 *   SMS_PROVIDER=mock     → MockSmsProvider (development default)
 *
 * The MOCK provider is BLOCKED in production regardless of the env var value.
 *
 * Required env vars for Arkesel:
 *   ARKESEL_API_KEY
 *   ARKESEL_SENDER_ID     (default: GHMotive)
 *   ARKESEL_SANDBOX       (default: false)
 */
@Module({
  imports: [ConfigModule],
  providers: [
    ArkeselSmsProvider,
    MockSmsProvider,
    {
      provide: SMS_PROVIDER,
      inject: [ConfigService, ArkeselSmsProvider, MockSmsProvider],
      useFactory: (
        config: ConfigService,
        arkesel: ArkeselSmsProvider,
        mock: MockSmsProvider,
      ): ISmsProvider => {
        const nodeEnv   = config.get<string>('NODE_ENV', 'development');
        const provider  = config.get<string>('SMS_PROVIDER', 'mock').toLowerCase();

        // Safety: never allow mock in production
        if (nodeEnv === 'production' && provider === 'mock') {
          throw new Error(
            'SMS_PROVIDER=mock is not allowed in production. Set SMS_PROVIDER=arkesel and configure ARKESEL_API_KEY.',
          );
        }

        if (provider === 'arkesel') return arkesel;
        return mock;
      },
    },
  ],
  exports: [SMS_PROVIDER],
})
export class SmsIntegrationModule {}
