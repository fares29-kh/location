import { Suspense } from 'react';

import { FleetView } from '@/components/agency/fleet/fleet-view';
import { agencyPageMetadata } from '@/lib/agency/page-metadata';

export const generateMetadata = agencyPageMetadata('fleet');

export default function AgencyFleetPage() {
  return (
    <Suspense fallback={null}>
      <FleetView />
    </Suspense>
  );
}
