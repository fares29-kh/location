import { Suspense } from 'react';

import { UsersView } from '@/components/admin/users/users-view';
import { adminPageMetadata } from '@/lib/admin/page-metadata';

export const generateMetadata = adminPageMetadata('users');

export default function AdminUsersPage() {
  return (
    <Suspense fallback={null}>
      <UsersView />
    </Suspense>
  );
}
