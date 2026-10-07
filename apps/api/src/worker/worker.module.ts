import { Module } from '@nestjs/common';

import { ConfigModule } from '../config/config.module';
import { RedisModule } from '../redis/redis.module';
import { HeartbeatProcessor } from './heartbeat.processor';

@Module({
  imports: [ConfigModule, RedisModule],
  providers: [HeartbeatProcessor],
})
export class WorkerModule {}
