import type { UserRole } from '@drivetn/types';
import { type ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { describe, expect, it } from 'vitest';

import type { AuthenticatedUser } from './authenticated-user';
import { ROLES_KEY } from './auth.constants';
import { Roles } from './decorators';
import { RolesGuard } from './roles.guard';

const openHandler = () => 'open';
const restrictedHandler = () => 'restricted';
Roles('ADMIN', 'AGENCY_OWNER')(restrictedHandler);

function contextFor(handler: () => string, user?: AuthenticatedUser): ExecutionContext {
  return {
    getHandler: () => handler,
    getClass: () => Object,
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  } as unknown as ExecutionContext;
}

function userWith(role: UserRole): AuthenticatedUser {
  return { id: 'user-1', role, adminRole: null };
}

describe('RolesGuard', () => {
  const guard = new RolesGuard(new Reflector());

  it('pose les rôles en métadonnées via @Roles', () => {
    expect(new Reflector().get<UserRole[]>(ROLES_KEY, restrictedHandler)).toEqual([
      'ADMIN',
      'AGENCY_OWNER',
    ]);
  });

  it('laisse passer une route sans @Roles', () => {
    expect(guard.canActivate(contextFor(openHandler))).toBe(true);
  });

  it('autorise les rôles listés', () => {
    expect(guard.canActivate(contextFor(restrictedHandler, userWith('ADMIN')))).toBe(true);
    expect(guard.canActivate(contextFor(restrictedHandler, userWith('AGENCY_OWNER')))).toBe(true);
  });

  it('refuse les autres rôles et l’absence d’utilisateur', () => {
    expect(() => guard.canActivate(contextFor(restrictedHandler, userWith('CUSTOMER')))).toThrow(
      ForbiddenException,
    );
    expect(() => guard.canActivate(contextFor(restrictedHandler))).toThrow(ForbiddenException);
  });
});
