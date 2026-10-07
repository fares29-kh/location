import type { ReactNode } from 'react';

import { AdminShell } from '@/components/shell/admin-shell';
import { getServerEnv } from '@/env';
import { requirePortalUser } from '@/lib/auth/session';
import { type LocaleParams, resolveLocale } from '@/lib/locale-params';
import { readSidebarCollapsed } from '@/lib/sidebar-preference.server';

export default async function AdminWorkspaceLayout({
  children,
  params,
}: LocaleParams & { children: ReactNode }) {
  const user = await requirePortalUser('admin', await resolveLocale(params));

  return (
    <AdminShell
      user={user}
      designEnabled={getServerEnv().DESIGN_PAGE_ENABLED}
      sidebarCollapsed={await readSidebarCollapsed('admin')}
    >
      {children}
    </AdminShell>
  );
}
