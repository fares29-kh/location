import { Module } from '@nestjs/common';

import { AgencyModule } from './agency/agency.module';
import { AuditModule } from './audit/audit.module';
import { AuthModule } from './auth/auth.module';
import { BookingsModule } from './bookings/bookings.module';
import { SecurityModule } from './common/security/security.module';
import { ConfigModule } from './config/config.module';
import { HealthModule } from './health/health.module';
import { LocationsModule } from './locations/locations.module';
import { PrismaModule } from './prisma/prisma.module';
import { RateLimitModule } from './rate-limit/rate-limit.module';
import { RedisModule } from './redis/redis.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    RedisModule,
    RateLimitModule,
    AuditModule,
    SecurityModule,
    HealthModule,
    AuthModule,
    UsersModule,
    LocationsModule,
    AgencyModule,
    BookingsModule,
  ],
})
export class AppModule {}
