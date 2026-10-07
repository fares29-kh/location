import { Suspense } from 'react';

import { SettingsView } from '@/components/agency/settings/settings-view';
import { agencyPageMetadata } from '@/lib/agency/page-metadata';
import { fetchGovernorates } from '@/lib/locations';

export const generateMetadata = agencyPageMetadata('settings');

export default async function AgencySettingsPage() {
  const governorates = await fetchGovernorates();
  return (
    <Suspense fallback={null}>
      <SettingsView governorates={governorates} />
    </Suspense>
  );
}
