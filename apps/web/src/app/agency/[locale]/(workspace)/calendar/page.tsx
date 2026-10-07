import { Skeleton } from '@drivetn/ui/skeleton';
import { Suspense } from 'react';

import { PlanningView } from '@/components/agency/planning/planning-view';
import { agencyPageMetadata } from '@/lib/agency/page-metadata';

export const generateMetadata = agencyPageMetadata('calendar');

export default function AgencyPlanningPage() {
  return (
    <Suspense fallback={<Skeleton className="h-[32rem] rounded-card" />}>
      <PlanningView />
    </Suspense>
  );
}
