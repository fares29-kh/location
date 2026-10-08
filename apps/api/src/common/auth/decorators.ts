import type { AdminPermission, UserRole } from '@drivetn/types';
import {
  createParamDecorator,
  type ExecutionContext,
  SetMetadata,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';

import { ADMIN_PERMISSION_KEY, IS_PUBLIC_KEY, ROLES_KEY } from './auth.constants';
import type { AuthenticatedUser } from './authenticated-user';

/** Route accessible sans session. */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

/** Restreint une route à certains rôles (vérifié par le RolesGuard). */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);

/** Action d'administration réservée aux rôles qui en ont le droit (vérifié par le RolesGuard). */
export const RequireAdminPermission = (permission: AdminPermission) =>
  SetMetadata(ADMIN_PERMISSION_KEY, permission);

export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthenticatedUser => {
    const user = context.switchToHttp().getRequest<Request>().user;
    if (user === undefined) {
      throw new UnauthorizedException('Session requise.');
    }
    return user;
  },
);
