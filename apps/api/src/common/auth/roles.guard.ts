import { type AdminPermission, hasAdminPermission, type UserRole } from '@drivetn/types';
import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';

import { ADMIN_PERMISSION_KEY, ROLES_KEY } from './auth.constants';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const targets = [context.getHandler(), context.getClass()];
    const roles = this.reflector.getAllAndOverride<UserRole[] | undefined>(ROLES_KEY, targets);
    const permission = this.reflector.getAllAndOverride<AdminPermission | undefined>(
      ADMIN_PERMISSION_KEY,
      targets,
    );
    if ((roles === undefined || roles.length === 0) && permission === undefined) {
      return true;
    }
    const user = context.switchToHttp().getRequest<Request>().user;
    if (user === undefined) {
      throw new ForbiddenException('Accès réservé.');
    }
    if (roles !== undefined && roles.length > 0 && !roles.includes(user.role)) {
      throw new ForbiddenException('Accès réservé.');
    }
    if (
      permission !== undefined &&
      (user.role !== 'ADMIN' || !hasAdminPermission(user.adminRole, permission))
    ) {
      throw new ForbiddenException('Votre rôle ne permet pas cette action.');
    }
    return true;
  }
}
