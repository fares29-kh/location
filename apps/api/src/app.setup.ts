import { VersioningType } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';

import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import type { Env } from './config/env';

export const API_PREFIX = 'api';
export const SWAGGER_PATH = `${API_PREFIX}/docs`;

/** Configuration HTTP commune au serveur et aux tests d'intégration. */
export function configureApp(app: NestExpressApplication, config: Env): void {
  app.set('trust proxy', 1);
  // La redirection HTTPS est assurée par Traefik : forcer l'upgrade casserait Swagger en HTTP local.
  app.use(helmet({ contentSecurityPolicy: { directives: { upgradeInsecureRequests: null } } }));
  if (config.CORS_ORIGINS.length > 0) {
    app.enableCors({ origin: config.CORS_ORIGINS, credentials: true });
  }
  app.setGlobalPrefix(API_PREFIX);
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
  app.useGlobalFilters(new HttpExceptionFilter());

  if (config.SWAGGER_ENABLED) {
    const document = SwaggerModule.createDocument(
      app,
      new DocumentBuilder()
        .setTitle(`${config.APP_NAME} API`)
        .setDescription(
          `API REST de ${config.APP_NAME}. Aucun paiement en ligne : les paiements sont déclaratifs.`,
        )
        .setVersion('1.0')
        .build(),
    );
    SwaggerModule.setup(SWAGGER_PATH, app, document, { jsonDocumentUrl: `${SWAGGER_PATH}/json` });
  }
}
