import { Suspense } from 'react';

import { ExpensesView } from '@/components/agency/expenses/expenses-view';
import { agencyPageMetadata } from '@/lib/agency/page-metadata';

export const generateMetadata = agencyPageMetadata('expenses');

export default function AgencyExpensesPage() {
  return (
    <Suspense fallback={null}>
      <ExpensesView />
    </Suspense>
  );
}
