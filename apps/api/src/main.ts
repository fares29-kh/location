import 'reflect-metadata';

import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';

import { AppModule } from './app.module';
import { configureApp, SWAGGER_PATH } from './app.setup';
import { APP_CONFIG } from './config/config.constants';
import type { Env } from './config/env';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const config = app.get<Env>(APP_CONFIG);

  configureApp(app, config);
  app.enableShutdownHooks();

  await app.listen(config.PORT, '0.0.0.0');

  const logger = new Logger('Bootstrap');
  logger.log(`${config.APP_NAME} API démarrée sur le port ${config.PORT}`);
  if (config.SWAGGER_ENABLED) {
    logger.log(`Documentation Swagger : /${SWAGGER_PATH}`);
  }
}

bootstrap().catch((error: unknown) => {
  new Logger('Bootstrap').error(error instanceof Error ? (error.stack ?? error.message) : error);
  process.exit(1);
});
