import type { UserRole } from '@drivetn/types';
import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';

import { ROLES_KEY } from './auth.constants';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const roles = this.reflector.getAllAndOverride<UserRole[] | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (roles === undefined || roles.length === 0) {
      return true;
    }
    const user = context.switchToHttp().getRequest<Request>().user;
    if (user === undefined || !roles.includes(user.role)) {
      throw new ForbiddenException('Accès réservé.');
    }
    return true;
  }
}
