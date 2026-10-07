import { SetMetadata } from '@nestjs/common';

import type { RateLimitRule } from './rate-limit.service';

export const RATE_LIMIT_KEY = 'drivetn:rateLimit';

export interface RateLimitOptions extends RateLimitRule {
  /** Nom du compteur, partagé par toutes les routes qui l'utilisent. */
  name: string;
}

/** Limite le nombre d'appels par adresse IP sur une route. */
export const RateLimit = (options: RateLimitOptions) => SetMetadata(RATE_LIMIT_KEY, options);
