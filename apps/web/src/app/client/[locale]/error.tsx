'use client';

import { RouteError, type RouteErrorProps } from '@/components/pages/route-error';

export default function ClientError(props: RouteErrorProps) {
  return <RouteError {...props} />;
}
