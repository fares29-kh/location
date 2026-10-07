import type { AdminRole } from '@drivetn/types';

/**
 * Actions sensibles de l'administration. Tous les rôles consultent l'ensemble des écrans ;
 * seules les actions sont restreintes (l'API applique les mêmes règles côté serveur).
 */
export type AdminPermission =
  'agencies.decide' | 'users.manage' | 'reviews.moderate' | 'billing.manage' | 'settings.manage';

const ROLE_PERMISSIONS: Record<AdminRole, readonly AdminPermission[]> = {
  SUPER_ADMIN: [
    'agencies.decide',
    'users.manage',
    'reviews.moderate',
    'billing.manage',
    'settings.manage',
  ],
  SUPPORT: ['agencies.decide', 'users.manage', 'reviews.moderate'],
  FINANCE: ['billing.manage'],
};

export function hasAdminPermission(role: AdminRole | null, permission: AdminPermission): boolean {
  return role !== null && ROLE_PERMISSIONS[role].includes(permission);
}
