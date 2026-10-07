import { Suspense } from 'react';

import { PlatformBookingsView } from '@/components/admin/bookings/platform-bookings-view';
import { adminPageMetadata } from '@/lib/admin/page-metadata';

export const generateMetadata = adminPageMetadata('bookings');

export default function AdminBookingsPage() {
  return (
    <Suspense fallback={null}>
      <PlatformBookingsView />
    </Suspense>
  );
}
