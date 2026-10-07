'use client';

import type { BookingStatus, PaymentStatus, VehicleStatus } from '@drivetn/types';
import { Badge, type BadgeTone } from '@drivetn/ui/badge';
import { BookingStatusBadge, PaymentStatusBadge } from '@drivetn/ui/status-badges';
import { useTranslations } from 'next-intl';

export function BookingStatusTag({
  status,
  className,
}: {
  status: BookingStatus;
  className?: string;
}) {
  const t = useTranslations('status.booking');
  return (
    <BookingStatusBadge status={status} className={className}>
      {t(status)}
    </BookingStatusBadge>
  );
}

export function PaymentStatusTag({
  status,
  className,
}: {
  status: PaymentStatus;
  className?: string;
}) {
  const t = useTranslations('status.payment');
  return (
    <PaymentStatusBadge status={status} className={className}>
      {t(status)}
    </PaymentStatusBadge>
  );
}

/** Disponibilité affichée d'un véhicule : statut administratif ou location en cours. */
export type VehicleAvailability = VehicleStatus | 'ON_RENT';

const AVAILABILITY_TONES: Record<VehicleAvailability, BadgeTone> = {
  ACTIVE: 'success',
  ON_RENT: 'violet',
  MAINTENANCE: 'warning',
  INACTIVE: 'neutral',
};

export function VehicleAvailabilityTag({
  availability,
  className,
}: {
  availability: VehicleAvailability;
  className?: string;
}) {
  const t = useTranslations('agency.fleet.availability');
  return (
    <Badge tone={AVAILABILITY_TONES[availability]} className={className}>
      <span className="size-1.5 rounded-full bg-current" aria-hidden="true" />
      {t(availability)}
    </Badge>
  );
}
