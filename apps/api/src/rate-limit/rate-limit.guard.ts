import { type CanActivate, type ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request, Response } from 'express';

import { RATE_LIMIT_KEY, type RateLimitOptions } from './rate-limit.decorator';
import { RateLimitService, tooManyRequests } from './rate-limit.service';

@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly rateLimit: RateLimitService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const options = this.reflector.getAllAndOverride<RateLimitOptions | undefined>(RATE_LIMIT_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (options === undefined || context.getType() !== 'http') {
      return true;
    }
    const http = context.switchToHttp();
    const request = http.getRequest<Request>();
    const result = await this.rateLimit.hit(`${options.name}:ip:${request.ip ?? 'unknown'}`, {
      limit: options.limit,
      windowSeconds: options.windowSeconds,
    });
    if (!result.allowed) {
      http.getResponse<Response>().setHeader('Retry-After', String(result.retryAfterSeconds));
      throw tooManyRequests(result.retryAfterSeconds);
    }
    return true;
  }
}
