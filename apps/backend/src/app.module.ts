import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard } from '@nestjs/throttler';

import { PrismaModule } from './prisma/prisma.module';
import { HealthModule } from './health/health.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { DriversModule } from './modules/drivers/drivers.module';
import { OwnersModule } from './modules/owners/owners.module';
import { CompaniesModule } from './modules/companies/companies.module';
import { VehiclesModule } from './modules/vehicles/vehicles.module';
import { AuditModule } from './modules/audit/audit.module';
import { AdminModule } from './modules/admin/admin.module';
import { ContractsModule } from './modules/contracts/contracts.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { SettlementsModule } from './modules/settlements/settlements.module';
import { DisputesModule } from './modules/disputes/disputes.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { MaintenanceModule } from './modules/maintenance/maintenance.module';
import { TrackingModule } from './modules/tracking/tracking.module';
import { IncidentsModule } from './modules/incidents/incidents.module';
import { ComplianceModule } from './modules/compliance/compliance.module';
import { MarketplaceModule } from './modules/marketplace/marketplace.module';
import { OnboardingModule } from './modules/onboarding/onboarding.module';
import { AccountsModule } from './modules/accounts/accounts.module';

import appConfig from './config/app.config';
import databaseConfig from './config/database.config';
import jwtConfig from './config/jwt.config';

@Module({
  imports: [
    // Configuration
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig, databaseConfig, jwtConfig],
      envFilePath: ['.env', '.env.local'],
    }),

    // Rate limiting
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => [
        {
          ttl: configService.get<number>('THROTTLE_TTL', 60) * 1000,
          limit: configService.get<number>('THROTTLE_LIMIT', 100),
        },
      ],
    }),

    // Core infrastructure
    PrismaModule,

    // Health
    HealthModule,

    // Feature modules
    AuthModule,
    UsersModule,
    DriversModule,
    OwnersModule,
    CompaniesModule,
    VehiclesModule,
    AuditModule,
    AdminModule,
    ContractsModule,
    PaymentsModule,
    SettlementsModule,
    DisputesModule,
    NotificationsModule,
    MaintenanceModule,
    TrackingModule,
    IncidentsModule,
    ComplianceModule,
    MarketplaceModule,
    OnboardingModule,
    AccountsModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
