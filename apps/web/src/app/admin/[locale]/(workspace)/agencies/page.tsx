import { Suspense } from 'react';

import { AgenciesView } from '@/components/admin/agencies/agencies-view';
import { adminPageMetadata } from '@/lib/admin/page-metadata';

export const generateMetadata = adminPageMetadata('agencies');

export default function AdminAgenciesPage() {
  return (
    <Suspense fallback={null}>
      <AgenciesView />
    </Suspense>
  );
}
