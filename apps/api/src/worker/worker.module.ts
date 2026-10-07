import { Module } from '@nestjs/common';

import { ConfigModule } from '../config/config.module';
import { MessagingProviderModule } from '../messaging/messaging-provider.module';
import { RedisModule } from '../redis/redis.module';
import { HeartbeatProcessor } from './heartbeat.processor';
import { MessagingProcessor } from './messaging.processor';

@Module({
  imports: [ConfigModule, RedisModule, MessagingProviderModule],
  providers: [HeartbeatProcessor, MessagingProcessor],
})
export class WorkerModule {}
