import { Suspense } from 'react';

import { ReviewsView } from '@/components/agency/reviews/reviews-view';
import { agencyPageMetadata } from '@/lib/agency/page-metadata';

export const generateMetadata = agencyPageMetadata('reviews');

export default function AgencyReviewsPage() {
  return (
    <Suspense fallback={null}>
      <ReviewsView />
    </Suspense>
  );
}
