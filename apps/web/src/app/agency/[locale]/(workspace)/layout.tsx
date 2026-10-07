import type { ReactNode } from 'react';

import { AgencyShell } from '@/components/shell/agency-shell';
import { getServerEnv } from '@/env';
import { requirePortalUser } from '@/lib/auth/session';
import { type LocaleParams, resolveLocale } from '@/lib/locale-params';
import { readSidebarCollapsed } from '@/lib/sidebar-preference.server';

export default async function AgencyWorkspaceLayout({
  children,
  params,
}: LocaleParams & { children: ReactNode }) {
  const user = await requirePortalUser('agency', await resolveLocale(params));

  return (
    <AgencyShell
      user={user}
      designEnabled={getServerEnv().DESIGN_PAGE_ENABLED}
      sidebarCollapsed={await readSidebarCollapsed('agency')}
    >
      {children}
    </AgencyShell>
  );
}
