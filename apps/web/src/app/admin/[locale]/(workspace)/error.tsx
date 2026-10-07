'use client';

import { RouteError, type RouteErrorProps } from '@/components/pages/route-error';

export default function AdminWorkspaceError(props: RouteErrorProps) {
  return <RouteError {...props} />;
}
