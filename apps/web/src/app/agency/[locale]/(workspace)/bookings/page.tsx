import { Suspense } from 'react';

import { BookingsView } from '@/components/agency/bookings/bookings-view';
import { TableSkeleton } from '@/components/agency/query-states';
import { agencyPageMetadata } from '@/lib/agency/page-metadata';

export const generateMetadata = agencyPageMetadata('bookings');

export default function AgencyBookingsPage() {
  return (
    <Suspense fallback={<TableSkeleton />}>
      <BookingsView />
    </Suspense>
  );
}
