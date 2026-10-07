import { Suspense } from 'react';

import { BillingView } from '@/components/admin/billing/billing-view';
import { adminPageMetadata } from '@/lib/admin/page-metadata';

export const generateMetadata = adminPageMetadata('billing');

export default function AdminBillingPage() {
  return (
    <Suspense fallback={null}>
      <BillingView />
    </Suspense>
  );
}
