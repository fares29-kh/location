import { Global, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';

import { APP_CONFIG } from '../../config/config.constants';
import type { Env } from '../../config/env';
import { RateLimitGuard } from '../../rate-limit/rate-limit.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { OriginGuard } from './origin.guard';

/**
 * Guards globaux, exécutés dans cet ordre : origine (CSRF), limitation de débit,
 * authentification, puis rôles.
 */
@Global()
@Module({
  imports: [
    JwtModule.registerAsync({
      inject: [APP_CONFIG],
      useFactory: (config: Env) => ({
        secret: config.JWT_ACCESS_SECRET,
        signOptions: { algorithm: 'HS256', expiresIn: config.ACCESS_TOKEN_TTL_SECONDS },
      }),
    }),
  ],
  providers: [
    { provide: APP_GUARD, useClass: OriginGuard },
    { provide: APP_GUARD, useClass: RateLimitGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
  exports: [JwtModule],
})
export class SecurityModule {}
