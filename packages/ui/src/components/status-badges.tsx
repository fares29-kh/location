import type { BookingStatus, PaymentStatus } from '@drivetn/types';
import type { ReactNode } from 'react';

import { Badge, type BadgeTone } from './badge';

/** En attente = ambre, confirmée = bleu, en cours = violet, rendue = cyan, terminée = vert, annulée = gris, refusée/no-show = rouge. */
export const BOOKING_STATUS_TONES: Record<BookingStatus, BadgeTone> = {
  PENDING: 'warning',
  CONFIRMED: 'blue',
  PICKED_UP: 'violet',
  RETURNED: 'info',
  COMPLETED: 'success',
  CANCELLED: 'neutral',
  EXPIRED: 'neutral',
  REJECTED: 'danger',
  NO_SHOW: 'danger',
};

/** Non payé = gris, avance reçue = ambre, payé = vert, remboursé = bleu clair. */
export const PAYMENT_STATUS_TONES: Record<PaymentStatus, BadgeTone> = {
  UNPAID: 'neutral',
  DEPOSIT_PAID: 'warning',
  PAID: 'success',
  REFUNDED_OFFLINE: 'info',
};

interface StatusBadgeProps<TStatus> {
  status: TStatus;
  /** Libellé traduit du statut. */
  children: ReactNode;
  className?: string;
}

function StatusDot() {
  return <span className="size-1.5 rounded-full bg-current" aria-hidden="true" />;
}

export function BookingStatusBadge({
  status,
  children,
  className,
}: StatusBadgeProps<BookingStatus>) {
  return (
    <Badge tone={BOOKING_STATUS_TONES[status]} data-status={status} className={className}>
      <StatusDot />
      {children}
    </Badge>
  );
}

export function PaymentStatusBadge({
  status,
  children,
  className,
}: StatusBadgeProps<PaymentStatus>) {
  return (
    <Badge tone={PAYMENT_STATUS_TONES[status]} data-status={status} className={className}>
      <StatusDot />
      {children}
    </Badge>
  );
}
