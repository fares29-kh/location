import { Suspense } from 'react';

import { ModerationView } from '@/components/admin/reviews/moderation-view';
import { adminPageMetadata } from '@/lib/admin/page-metadata';

export const generateMetadata = adminPageMetadata('reviews');

export default function AdminReviewsPage() {
  return (
    <Suspense fallback={null}>
      <ModerationView />
    </Suspense>
  );
}
