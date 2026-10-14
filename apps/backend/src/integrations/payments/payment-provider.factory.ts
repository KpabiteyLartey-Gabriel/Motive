import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { IPaymentProvider, PaymentProviderName } from './interfaces/payment-provider.interface';
import { HubtelDirectPayProvider } from './providers/hubtel.provider';
import { MTNDirectP2PProvider } from './providers/mtn.provider';
import { MockPaymentProvider } from './providers/mock.provider';

export const PAYMENT_PROVIDER_SETTING_KEY = 'payment.active_provider';

/**
 * PaymentProviderFactory
 *
 * Reads the active provider name from the SystemSetting table
 * (key: "payment.active_provider") and returns the matching provider instance.
 *
 * Admin changes the setting → next payment call uses the new provider.
 * No restart required.
 */
@Injectable()
export class PaymentProviderFactory {
  private readonly logger = new Logger(PaymentProviderFactory.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly hubtel: HubtelDirectPayProvider,
    private readonly mtn: MTNDirectP2PProvider,
    private readonly mock: MockPaymentProvider,
  ) {}

  async getActiveProvider(): Promise<IPaymentProvider> {
    const setting = await this.prisma.systemSetting.findUnique({
      where: { key: PAYMENT_PROVIDER_SETTING_KEY },
    });

    const nodeEnv = this.config.get<string>('NODE_ENV', 'development');
    const stored = (setting?.value as PaymentProviderName) || 'MOCK';

    // Production safety — never allow MOCK in production
    const providerName: PaymentProviderName =
      nodeEnv === 'production' && stored === 'MOCK' ? 'MTN_DIRECT_P2P' : stored;

    this.logger.debug(`Active payment provider: ${providerName}`);

    switch (providerName) {
      case 'HUBTEL_DIRECTPAY':
        return this.hubtel;
      case 'MTN_DIRECT_P2P':
        return this.mtn;
      case 'MOCK':
        return this.mock;
      default:
        throw new BadRequestException(`Unknown payment provider: ${providerName}`);
    }
  }

  /** List all available providers and which is currently active */
  async getProviderStatus() {
    const setting = await this.prisma.systemSetting.findUnique({
      where: { key: PAYMENT_PROVIDER_SETTING_KEY },
    });

    const active = (setting?.value as PaymentProviderName) || 'MOCK';
    const nodeEnv = this.config.get<string>('NODE_ENV', 'development');

    return {
      active,
      available: [
        {
          name: 'HUBTEL_DIRECTPAY',
          label: 'Hubtel DirectPay',
          description: 'Debit driver MoMo → credit owner MoMo directly. Supports MTN, Telecel, AirtelTigo.',
          isDirectPay: true,
          supportedNetworks: ['MTN', 'Telecel', 'AirtelTigo'],
        },
        {
          name: 'MTN_DIRECT_P2P',
          label: 'MTN Direct P2P',
          description: 'MTN Collections + Disbursements. MTN wallets only.',
          isDirectPay: false,
          supportedNetworks: ['MTN'],
        },
        {
          name: 'MOCK',
          label: 'Mock (Development Only)',
          description: 'Simulates payments in development. Cannot be used in production.',
          isDirectPay: true,
          supportedNetworks: ['ALL'],
          blocked: nodeEnv === 'production',
        },
      ],
    };
  }

  /** Switch the active provider — called by admin API */
  async setActiveProvider(providerName: PaymentProviderName, actorId: string) {
    const nodeEnv = this.config.get<string>('NODE_ENV', 'development');

    if (nodeEnv === 'production' && providerName === 'MOCK') {
      throw new BadRequestException('Mock provider cannot be activated in production');
    }

    const validProviders: PaymentProviderName[] = ['HUBTEL_DIRECTPAY', 'MTN_DIRECT_P2P', 'MOCK'];
    if (!validProviders.includes(providerName)) {
      throw new BadRequestException(`Invalid provider: ${providerName}`);
    }

    await this.prisma.systemSetting.upsert({
      where: { key: PAYMENT_PROVIDER_SETTING_KEY },
      update: { value: providerName, updatedBy: actorId },
      create: {
        key: PAYMENT_PROVIDER_SETTING_KEY,
        value: providerName,
        type: 'string',
        category: 'payments',
        isPublic: false,
        updatedBy: actorId,
      },
    });

    this.logger.log(`[Admin] Payment provider switched to ${providerName} by ${actorId}`);
    return this.getProviderStatus();
  }
}
