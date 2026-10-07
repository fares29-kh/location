'use client';

import type { CurrentUser } from '@drivetn/types';
import { createContext, type ReactNode, use, useEffect } from 'react';

import { ADMIN_DEMO_MODE, identifyDemoAdmin } from '@/lib/admin/api';
import { type AdminPermission, hasAdminPermission } from '@/lib/admin/permissions';

const AdminSessionContext = createContext<CurrentUser | null>(null);

/** Administrateur connecté, accessible aux écrans pour adapter les actions à son rôle. */
export function AdminSessionProvider({
  user,
  children,
}: {
  user: CurrentUser;
  children: ReactNode;
}) {
  useEffect(() => {
    if (ADMIN_DEMO_MODE) {
      identifyDemoAdmin(user);
    }
  }, [user]);
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
