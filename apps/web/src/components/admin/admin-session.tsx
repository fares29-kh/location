'use client';

import { type AdminPermission, type CurrentUser, hasAdminPermission } from '@drivetn/types';
import { createContext, type ReactNode, use } from 'react';

const AdminSessionContext = createContext<CurrentUser | null>(null);

/** Administrateur connecté, accessible aux écrans pour adapter les actions à son rôle. */
export function AdminSessionProvider({
  user,
  children,
}: {
  user: CurrentUser;
  children: ReactNode;
}) {
  return <AdminSessionContext value={user}>{children}</AdminSessionContext>;
}

export function useAdminSession(): CurrentUser {
  const user = use(AdminSessionContext);
  if (user === null) {
    throw new Error('useAdminSession doit être utilisé dans AdminSessionProvider');
  }
  return user;
}

export function useAdminPermission(permission: AdminPermission): boolean {
  return hasAdminPermission(useAdminSession().adminRole, permission);
}
