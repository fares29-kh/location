'use client';

import { type BookingStatus, type PaymentKind, pickLocalized } from '@drivetn/types';
import { Alert } from '@drivetn/ui/alert';
import { Badge, type BadgeTone } from '@drivetn/ui/badge';
import { Button } from '@drivetn/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@drivetn/ui/card';
import { cn } from '@drivetn/ui/lib/cn';
import { PAYMENT_METHOD_ICONS } from '@drivetn/ui/payment-method-badges';
import { Skeleton } from '@drivetn/ui/skeleton';
import { toast } from '@drivetn/ui/toaster';
import {
  CalendarClock,
  Copy,
  Fuel,
  Gauge,
  MapPin,
  MessageSquareQuote,
  Plus,
  Settings2,
  Users,
  Wallet,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { type ReactNode, useState } from 'react';

import { useCategoryLabel } from '@/components/vehicle-categories';
import { Link } from '@/i18n/navigation';
import { useAgencySettings, useBooking } from '@/lib/agency/queries';
import type { BookingView } from '@/lib/agency/types';

import { PageHeader } from '../page-header';
import { ContactActions, customerName, CustomerIdentity } from '../people';
import { QueryError } from '../query-states';
import { BookingStatusTag, PaymentStatusTag } from '../status-tags';
import { useAgencyFormat } from '../use-agency-format';
import { vehicleCoverUrl } from '@/lib/agency/vehicle-photos';

import { VehicleThumb } from '../vehicle-thumb';
import { BookingActionsBar } from './booking-actions';
import { RecordPaymentDialog } from './record-payment-dialog';

const KIND_TONES: Record<PaymentKind, BadgeTone> = {
  RENTAL: 'success',
  REFUND: 'danger',
  DEPOSIT_HELD: 'info',
  DEPOSIT_RETURNED: 'neutral',
};

const STATUS_DOT: Record<BookingStatus, string> = {
  PENDING: 'bg-warning',
  CONFIRMED: 'bg-blue-500',
  PICKED_UP: 'bg-violet-500',
  RETURNED: 'bg-info',
  COMPLETED: 'bg-success',
  CANCELLED: 'bg-muted-foreground',
  EXPIRED: 'bg-muted-foreground',
  REJECTED: 'bg-danger',
  NO_SHOW: 'bg-danger',
};

function InfoRow({ label, children }: { label: ReactNode; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-end font-medium text-foreground">{children}</dd>
    </div>
  );
}

function TripCard({ booking }: { booking: BookingView }) {
  const t = useTranslations('agency.bookingDetail');
  const format = useAgencyFormat();
  const legs = [
    { key: 'pickup', at: booking.pickupAt, place: booking.pickupLocation },
    { key: 'return', at: booking.returnAt, place: booking.returnLocation },
  ] as const;

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-3 pb-4">
        <CardTitle className="text-base">{t('trip')}</CardTitle>
        <Badge tone="primary">{t('duration', { count: booking.days })}</Badge>
      </CardHeader>
      <CardContent className="grid gap-4">
        <ol className="relative grid gap-5 sm:grid-cols-2 sm:gap-4">
          {legs.map((leg) => (
            <li key={leg.key} className="grid gap-1.5 rounded-control bg-surface-muted/60 p-4">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {t(leg.key)}
              </span>
              <span className="flex items-center gap-2 font-heading text-lg font-semibold">
                <CalendarClock className="size-4 text-primary" aria-hidden="true" />
                {format.weekdayDate(leg.at)}
              </span>
              <span className="text-sm tabular-nums text-foreground">{format.time(leg.at)}</span>
              <span className="flex items-start gap-1.5 text-sm text-muted-foreground">
                <MapPin className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                {pickLocalized(leg.place, format.locale)}
              </span>
            </li>
          ))}
        </ol>
        {booking.customerNote !== null && (
          <figure className="flex gap-3 rounded-control border border-dashed border-border p-4 text-sm">
            <MessageSquareQuote className="size-5 shrink-0 text-primary" aria-hidden="true" />
            <div className="grid gap-1">
              <figcaption className="font-medium">{t('customerNote')}</figcaption>
              <blockquote className="text-muted-foreground">{booking.customerNote}</blockquote>
            </div>
          </figure>
        )}
      </CardContent>
    </Card>
  );
}

function VehicleCard({ booking }: { booking: BookingView }) {
  const t = useTranslations('agency.bookingDetail');
  const tFleet = useTranslations('agency.fleet');
  const categoryLabel = useCategoryLabel();
  const { vehicle } = booking;
  const specs = [
    { icon: Settings2, label: tFleet(`transmissions.${vehicle.transmission}`) },
    { icon: Fuel, label: tFleet(`fuels.${vehicle.fuel}`) },
    { icon: Users, label: tFleet('seats', { count: vehicle.seats }) },
    {
      icon: Gauge,
      label:
        vehicle.mileageLimitKm === null
          ? tFleet('unlimitedMileage')
          : tFleet('mileagePerDay', { km: vehicle.mileageLimitKm }),
    },
  ];
  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="text-base">{t('vehicle')}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <VehicleThumb
          color={vehicle.color}
          photoUrl={vehicleCoverUrl(vehicle)}
          size="md"
          className="sm:size-16"
        />
        <div className="grid flex-1 gap-1">
          <p className="font-heading text-lg font-semibold">
            {vehicle.brand} {vehicle.model}{' '}
            <span className="text-sm font-normal text-muted-foreground">{vehicle.year}</span>
          </p>
          <p className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            {vehicle.plateNumber !== null && (
              <Badge tone="outline" className="tabular-nums" dir="ltr">
                {vehicle.plateNumber}
              </Badge>
            )}
            {categoryLabel(vehicle.category)}
          </p>
        </div>
        <ul className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm text-muted-foreground">
          {specs.map(({ icon: Icon, label }) => (
            <li key={label} className="flex items-center gap-1.5">
              <Icon className="size-4" aria-hidden="true" />
              {label}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

function PaymentsCard({ booking }: { booking: BookingView }) {
  const t = useTranslations('agency.bookingDetail');
  const tPayments = useTranslations('agency.payments');
  const tMethod = useTranslations('status.paymentMethod');
  const format = useAgencyFormat();
  const { data: settings } = useAgencySettings();
  const [open, setOpen] = useState(false);
  const { payment } = booking;
  const progress =
    booking.totalMillimes === 0
      ? 0
      : Math.min(1, Math.max(0, payment.paidMillimes / booking.totalMillimes));
  const canRecord = !['PENDING', 'REJECTED', 'EXPIRED'].includes(booking.status);

  return (
    <Card>
      <CardHeader className="flex-row flex-wrap items-start justify-between gap-3 pb-4">
        <div className="grid gap-1">
          <CardTitle className="flex items-center gap-2 text-base">
            {t('payments')}
            <PaymentStatusTag status={payment.status} />
          </CardTitle>
          <CardDescription>{t('paymentsHint')}</CardDescription>
        </div>
        {canRecord && (
          <Button
            size="sm"
            variant="soft"
            onClick={() => {
              setOpen(true);
            }}
          >
            <Plus aria-hidden="true" />
            {tPayments('recordAction')}
          </Button>
        )}
      </CardHeader>
      <CardContent className="grid gap-5">
        <div className="grid gap-2">
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="text-muted-foreground">
              {t('paidOf', {
                paid: format.money(payment.paidMillimes),
                total: format.money(booking.totalMillimes),
              })}
            </span>
            <span className="font-semibold tabular-nums">{format.percent(progress)}</span>
          </div>
          <div
            className="h-2 overflow-hidden rounded-full bg-surface-muted"
            role="progressbar"
            aria-label={t('payments')}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(progress * 100)}
          >
            <div
              className="h-full rounded-full bg-success transition-[width] duration-500"
              style={{ width: `${String(progress * 100)}%` }}
            />
          </div>
          <dl className="grid grid-cols-2 gap-3 pt-2 sm:grid-cols-3">
            <div className="rounded-control bg-surface-muted/60 p-3">
              <dt className="text-xs text-muted-foreground">{t('balance')}</dt>
              <dd
                className={cn(
                  'font-semibold tabular-nums',
                  payment.balanceMillimes > 0 && 'text-warning-soft-foreground',
                )}
              >
                {format.money(payment.balanceMillimes)}
              </dd>
            </div>
            <div className="rounded-control bg-surface-muted/60 p-3">
              <dt className="text-xs text-muted-foreground">{t('depositHeld')}</dt>
              <dd className="font-semibold tabular-nums">
                {format.money(payment.depositHeldMillimes)}
              </dd>
            </div>
            <div className="col-span-2 rounded-control bg-surface-muted/60 p-3 sm:col-span-1">
              <dt className="text-xs text-muted-foreground">{t('depositPlanned')}</dt>
              <dd className="font-semibold tabular-nums">
                {format.money(booking.depositMillimes)}
              </dd>
            </div>
          </dl>
        </div>

        {booking.payments.length === 0 ? (
          <p className="flex items-center gap-2 rounded-control border border-dashed border-border p-4 text-sm text-muted-foreground">
            <Wallet className="size-4" aria-hidden="true" />
            {t('noPayments')}
          </p>
        ) : (
          <ul className="divide-y divide-border rounded-control border border-border">
            {booking.payments.map((record) => {
              const Icon = PAYMENT_METHOD_ICONS[record.method];
              const outgoing = record.kind === 'REFUND' || record.kind === 'DEPOSIT_RETURNED';
              return (
                <li key={record.id} className="flex flex-wrap items-center gap-3 p-3 text-sm">
                  <span className="flex size-9 items-center justify-center rounded-full bg-surface-muted text-muted-foreground">
                    <Icon className="size-4" aria-hidden="true" />
                  </span>
                  <span className="grid min-w-0 flex-1 gap-0.5">
                    <span className="flex flex-wrap items-center gap-2">
                      <Badge tone={KIND_TONES[record.kind]}>
                        {tPayments(`kinds.${record.kind}`)}
                      </Badge>
                      <span className="text-muted-foreground">{tMethod(record.method)}</span>
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {format.dateTime(record.recordedAt)}
                      {record.note !== null && ` · ${record.note}`}
                    </span>
                  </span>
                  <span
                    className={cn(
                      'font-semibold tabular-nums',
                      outgoing ? 'text-muted-foreground' : 'text-foreground',
                    )}
                  >
                    {outgoing ? '−' : '+'}
                    {format.money(record.amountMillimes)}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
      {open && (
        <RecordPaymentDialog
          booking={booking}
          open
          onOpenChange={setOpen}
          acceptedMethods={settings?.conditions.acceptedPaymentMethods}
        />
      )}
    </Card>
  );
}

function CustomerCard({ booking }: { booking: BookingView }) {
  const t = useTranslations('agency.bookingDetail');
  const format = useAgencyFormat();
  const { customer } = booking;
  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="text-base">{t('customer')}</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4">
        <CustomerIdentity customer={customer} size="lg" />
        <ContactActions
          phone={customer.phone}
          message={t('whatsappMessage', {
            name: customer.firstName,
            reference: booking.reference,
            date: format.shortDateTime(booking.pickupAt),
          })}
        />
        <dl className="divide-y divide-border border-t border-border">
          <InfoRow label={t('email')}>
            {customer.email === null ? (
              <span className="text-muted-foreground">—</span>
            ) : (
              <a href={`mailto:${customer.email}`} className="break-all hover:underline" dir="ltr">
                {customer.email}
              </a>
            )}
          </InfoRow>
          <InfoRow label={t('city')}>{customer.city}</InfoRow>
        </dl>
        <Button asChild variant="link" className="justify-start">
          <Link href={`/customers?customer=${customer.id}`}>{t('openCustomer')}</Link>
        </Button>
      </CardContent>
    </Card>
  );
}

function PriceCard({ booking }: { booking: BookingView }) {
  const t = useTranslations('agency.bookingDetail');
  const format = useAgencyFormat();
  const gross = booking.dailyRateMillimes * booking.days;
  const discount = gross - booking.totalMillimes;
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{t('price')}</CardTitle>
      </CardHeader>
      <CardContent>
        <dl className="divide-y divide-border">
          <InfoRow
            label={t('dailyRateTimesDays', {
              count: booking.days,
              rate: format.money(booking.dailyRateMillimes),
            })}
          >
            {format.money(gross)}
          </InfoRow>
          {discount > 0 && (
            <InfoRow label={t('longRentalDiscount')}>
              <span className="text-success">−{format.money(discount)}</span>
            </InfoRow>
          )}
          <div className="flex items-center justify-between gap-4 pt-3">
            <dt className="font-semibold">{t('total')}</dt>
            <dd className="font-heading text-xl font-bold tabular-nums">
              {format.money(booking.totalMillimes)}
            </dd>
          </div>
        </dl>
        <p className="mt-3 text-xs text-muted-foreground">{t('payAtAgency')}</p>
      </CardContent>
    </Card>
  );
}

function HistoryCard({ booking }: { booking: BookingView }) {
  const t = useTranslations('agency.bookingDetail');
  const tStatus = useTranslations('status.booking');
  const format = useAgencyFormat();
  const events = [...booking.history].reverse();
  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="text-base">{t('history')}</CardTitle>
      </CardHeader>
      <CardContent>
        <ol className="relative grid gap-5 border-s border-border ps-5">
          {events.map((event, index) => (
            <li key={`${event.status}-${event.at}`} className="relative grid gap-0.5">
              <span
                className={cn(
                  'absolute -start-[1.6rem] top-1 size-2.5 rounded-full ring-4 ring-surface',
                  STATUS_DOT[event.status],
                )}
                aria-hidden="true"
              />
              <span className={cn('text-sm', index === 0 ? 'font-semibold' : 'font-medium')}>
                {event.status === 'PENDING' ? t('requestReceived') : tStatus(event.status)}
              </span>
              <span className="text-xs text-muted-foreground">{format.dateTime(event.at)}</span>
              {event.reason !== null && (
                <span className="mt-1 rounded-control bg-surface-muted px-2.5 py-1.5 text-xs text-muted-foreground">
                  {event.reason}
                </span>
              )}
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  );
}

function DetailSkeleton() {
  return (
    <div className="grid min-w-0 grid-cols-1 gap-6" aria-busy="true">
      <div className="grid gap-3">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-8 w-80 max-w-full" />
      </div>
      <div className="grid min-w-0 grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="grid min-w-0 gap-6 lg:col-span-2">
          <Skeleton className="h-56 rounded-card" />
          <Skeleton className="h-36 rounded-card" />
        </div>
        <div className="grid content-start gap-6">
          <Skeleton className="h-64 rounded-card" />
          <Skeleton className="h-40 rounded-card" />
        </div>
      </div>
    </div>
  );
}

export function BookingDetailView({ bookingId }: { bookingId: string }) {
  const t = useTranslations('agency.bookingDetail');
  const tBookings = useTranslations('agency.bookings');
  const format = useAgencyFormat();
  const { data: booking, isPending, isError, error, refetch, isFetching } = useBooking(bookingId);
  const back = { href: '/bookings', label: tBookings('title') };

  if (isPending) {
    return <DetailSkeleton />;
  }
  if (isError) {
    return (
      <div className="grid min-w-0 grid-cols-1 gap-6">
        <PageHeader title={t('fallbackTitle')} back={back} />
        <QueryError error={error} onRetry={() => void refetch()} retrying={isFetching} />
      </div>
    );
  }

  return (
    <div className="grid min-w-0 grid-cols-1 gap-6">
      <PageHeader
        back={back}
        eyebrow={
          <span className="inline-flex items-center gap-2">
            <span className="font-mono">{booking.reference}</span>
            <button
              type="button"
              className="rounded p-0.5 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label={t('copyReference')}
              onClick={() => {
                void navigator.clipboard.writeText(booking.reference).then(() => {
                  toast.success(t('referenceCopied'));
                });
              }}
            >
              <Copy className="size-3.5" aria-hidden="true" />
            </button>
          </span>
        }
        title={
          <span className="flex flex-wrap items-center gap-3">
            {customerName(booking.customer)}
            <BookingStatusTag
              status={booking.status}
              className="font-sans text-sm tracking-normal"
            />
          </span>
        }
        description={t('subtitle', {
          vehicle: `${booking.vehicle.brand} ${booking.vehicle.model}`,
          created: format.relative(booking.createdAt),
        })}
        actions={<BookingActionsBar booking={booking} />}
      />

      {booking.status === 'PENDING' && (
        <Alert tone="warning" title={t('pendingTitle')}>
          {t('pendingText', { since: format.relative(booking.createdAt) })}
        </Alert>
      )}
      {booking.status === 'RETURNED' && booking.payment.depositHeldMillimes > 0 && (
        <Alert tone="info" title={t('depositReminderTitle')}>
          {t('depositReminderText', { amount: format.money(booking.payment.depositHeldMillimes) })}
        </Alert>
      )}

      <div className="grid min-w-0 grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="grid min-w-0 content-start gap-6 lg:col-span-2">
          <TripCard booking={booking} />
          <PaymentsCard booking={booking} />
          <VehicleCard booking={booking} />
        </div>
        <div className="grid content-start gap-6">
          <CustomerCard booking={booking} />
          <PriceCard booking={booking} />
          <HistoryCard booking={booking} />
        </div>
      </div>
    </div>
  );
}
