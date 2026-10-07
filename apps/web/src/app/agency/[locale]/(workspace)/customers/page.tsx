import { Suspense } from 'react';

import { CustomersView } from '@/components/agency/customers/customers-view';
import { agencyPageMetadata } from '@/lib/agency/page-metadata';

export const generateMetadata = agencyPageMetadata('customers');

export default function AgencyCustomersPage() {
  return (
    <Suspense fallback={null}>
      <CustomersView />
    </Suspense>
  );
}
