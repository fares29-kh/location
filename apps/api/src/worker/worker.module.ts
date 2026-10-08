import { Module } from '@nestjs/common';

import { AuditModule } from '../audit/audit.module';
import { ConfigModule } from '../config/config.module';
import { MessagingProviderModule } from '../messaging/messaging-provider.module';
import { PlatformModule } from '../platform/platform.module';
import { PrismaModule } from '../prisma/prisma.module';
import { RedisModule } from '../redis/redis.module';
import { HeartbeatProcessor } from './heartbeat.processor';
import { MessagingProcessor } from './messaging.processor';
import { PlatformJobsProcessor } from './platform-jobs.processor';

@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    RedisModule,
    AuditModule,
    PlatformModule,
    MessagingProviderModule,
  ],
  providers: [HeartbeatProcessor, MessagingProcessor, PlatformJobsProcessor],
})
export class WorkerModule {}
