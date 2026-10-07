import { Suspense } from 'react';

import { AuditView } from '@/components/admin/audit/audit-view';
import { adminPageMetadata } from '@/lib/admin/page-metadata';

export const generateMetadata = adminPageMetadata('audit');

export default function AdminAuditPage() {
  return (
    <Suspense fallback={null}>
      <AuditView />
    </Suspense>
  );
}
