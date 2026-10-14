import { Module } from '@nestjs/common';
import { HubtelDirectPayProvider } from './providers/hubtel.provider';
import { MTNDirectP2PProvider } from './providers/mtn.provider';
import { MockPaymentProvider } from './providers/mock.provider';
import { PaymentProviderFactory } from './payment-provider.factory';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [
    HubtelDirectPayProvider,
    MTNDirectP2PProvider,
    MockPaymentProvider,
    PaymentProviderFactory,
  ],
  exports: [PaymentProviderFactory],
})
export class PaymentIntegrationModule {}
