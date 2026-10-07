import { Suspense } from 'react';

import { PaymentsView } from '@/components/agency/payments/payments-view';
import { agencyPageMetadata } from '@/lib/agency/page-metadata';

export const generateMetadata = agencyPageMetadata('payments');

export default function AgencyPaymentsPage() {
  return (
    <Suspense fallback={null}>
      <PaymentsView />
    </Suspense>
  );
}
