import type { ReactNode } from 'react';

import { AgencyShell } from '@/components/shell/agency-shell';
import { VehicleCategoriesProvider } from '@/components/vehicle-categories';
import { getServerEnv } from '@/env';
import { requirePortalUser } from '@/lib/auth/session';
import { type LocaleParams, resolveLocale } from '@/lib/locale-params';
import { readSidebarCollapsed } from '@/lib/sidebar-preference.server';
import { fetchVehicleCategories } from '@/lib/vehicle-catalog';

export default async function AgencyWorkspaceLayout({
  children,
  params,
}: LocaleParams & { children: ReactNode }) {
  const user = await requirePortalUser('agency', await resolveLocale(params));
  const [categories, sidebarCollapsed] = await Promise.all([
    fetchVehicleCategories(),
    readSidebarCollapsed('agency'),
  ]);

  return (
    <VehicleCategoriesProvider categories={categories}>
      <AgencyShell
        user={user}
        designEnabled={getServerEnv().DESIGN_PAGE_ENABLED}
        sidebarCollapsed={sidebarCollapsed}
      >
        {children}
      </AgencyShell>
    </VehicleCategoriesProvider>
  );
}
