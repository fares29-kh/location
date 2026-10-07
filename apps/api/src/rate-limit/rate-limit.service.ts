import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { Redis } from 'ioredis';

import { AppException } from '../common/errors/app.exception';
import { REDIS_CLIENT } from '../redis/redis.constants';

export interface RateLimitRule {
  limit: number;
  windowSeconds: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

const KEY_PREFIX = 'drivetn:rl:';

/** Compteurs à fenêtre fixe dans Redis (INCR + EXPIRE), partagés entre instances de l'API. */
@Injectable()
export class RateLimitService {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  async hit(key: string, rule: RateLimitRule): Promise<RateLimitResult> {
    const redisKey = `${KEY_PREFIX}${key}`;
    const results = await this.redis
      .multi()
      .incr(redisKey)
      .expire(redisKey, rule.windowSeconds, 'NX')
      .ttl(redisKey)
      .exec();
    const count = Number(results?.[0]?.[1] ?? 0);
    const ttl = Number(results?.[2]?.[1] ?? rule.windowSeconds);
    return {
      allowed: count <= rule.limit,
      remaining: Math.max(0, rule.limit - count),
      retryAfterSeconds: ttl > 0 ? ttl : rule.windowSeconds,
    };
  }

  /** Comptabilise une tentative et lève une erreur 429 si la limite est dépassée. */
  async consume(key: string, rule: RateLimitRule): Promise<void> {
    const result = await this.hit(key, rule);
    if (!result.allowed) {
      throw tooManyRequests(result.retryAfterSeconds);
    }
  }

  async reset(key: string): Promise<void> {
    await this.redis.del(`${KEY_PREFIX}${key}`);
  }
}

export function tooManyRequests(retryAfterSeconds: number): AppException {
  return new AppException(
    HttpStatus.TOO_MANY_REQUESTS,
    'TOO_MANY_REQUESTS',
    'Trop de tentatives, réessayez plus tard.',
    { retryAfterSeconds },
  );
}
