'use client';

import { isBookingClosed } from '@drivetn/types';
import { Button } from '@drivetn/ui/button';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@drivetn/ui/sheet';
import { Skeleton } from '@drivetn/ui/skeleton';
import { CalendarClock, ChevronRight, Mail, MapPin } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

import { Link } from '@/i18n/navigation';
import { useCustomer } from '@/lib/agency/queries';
import type { CustomerDetail } from '@/lib/agency/types';

import { ContactActions, CustomerIdentity, customerName } from '../people';
import { QueryError } from '../query-states';
import { BookingStatusTag } from '../status-tags';
import { useAgencyFormat } from '../use-agency-format';

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-0.5 rounded-control bg-surface-muted px-3 py-2.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="font-semibold tabular-nums">{value}</dd>
    </div>
  );
}

function CustomerDetailContent({ customer }: { customer: CustomerDetail }) {
  const t = useTranslations('agency.customers.detail');
  const format = useAgencyFormat();
  const active = customer.bookings.filter((booking) => !isBookingClosed(booking.status));

  return (
    <div className="grid min-w-0 grid-cols-1 gap-6">
      <div className="grid gap-4">
        <CustomerIdentity customer={customer} size="lg" />
        <ContactActions
          phone={customer.phone}
          message={t('whatsappMessage', { name: customer.firstName })}
        />
      </div>

      <dl className="grid grid-cols-2 gap-2">
        <Stat label={t('bookings')} value={format.integer(customer.bookingsCount)} />
        <Stat label={t('completed')} value={format.integer(customer.completedCount)} />
        <Stat label={t('spent')} value={format.money(customer.totalSpentMillimes)} />
        <Stat label={t('since')} value={format.date(customer.createdAt)} />
      </dl>

      <ul className="grid gap-2 text-sm">
        <li className="flex items-center gap-2">
          <MapPin className="size-4 text-muted-foreground" aria-hidden="true" />
          {customer.city}
        </li>
        <li className="flex items-center gap-2">
          <Mail className="size-4 text-muted-foreground" aria-hidden="true" />
          {customer.email === null ? (
            <span className="text-muted-foreground">{t('noEmail')}</span>
          ) : (
            <a
              href={`mailto:${customer.email}`}
              className="truncate text-primary hover:underline"
              dir="ltr"
            >
              {customer.email}
            </a>
          )}
        </li>
        {active.length > 0 && (
          <li className="flex items-center gap-2 text-primary">
            <CalendarClock className="size-4" aria-hidden="true" />
            {t('activeBookings', { count: active.length })}
          </li>
        )}
      </ul>

      <section className="grid gap-3" aria-labelledby="customer-history">
        <h3 id="customer-history" className="text-sm font-semibold">
          {t('history')}
        </h3>
        {customer.bookings.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('noBookings')}</p>
        ) : (
          <ul className="grid divide-y divide-border rounded-control border border-border">
            {customer.bookings.map((booking) => (
              <li key={booking.id}>
                <Link
                  href={`/bookings/${booking.id}`}
                  className="group flex items-center gap-3 p-3 transition-colors hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                >
                  <span className="grid min-w-0 flex-1 gap-0.5">
                    <span className="truncate text-sm font-medium">
                      {booking.vehicle.brand} {booking.vehicle.model}
                    </span>
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {format.dayMonth(booking.pickupAt)} – {format.date(booking.returnAt)} ·{' '}
                      <span className="font-mono">{booking.reference}</span>
                    </span>
                  </span>
                  <span className="grid justify-items-end gap-1">
                    <span className="text-sm font-semibold tabular-nums">
                      {format.money(booking.totalMillimes)}
                    </span>
                    <BookingStatusTag status={booking.status} />
                  </span>
                  <ChevronRight
                    className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 rtl:rotate-180 rtl:group-hover:-translate-x-0.5"
                    aria-hidden="true"
                  />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function DetailSkeleton() {
  return (
    <div className="grid min-w-0 grid-cols-1 gap-6" aria-hidden="true">
      <div className="flex items-center gap-3">
        <Skeleton className="size-14 rounded-full" />
        <div className="grid flex-1 gap-2">
          <Skeleton className="h-5 w-1/2" />
          <Skeleton className="h-4 w-1/3" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={index} className="h-14" />
        ))}
      </div>
      <Skeleton className="h-40" />
    </div>
  );
}

/** Fiche client en panneau latéral ; l'identifiant vit dans l'URL (`?customer=`). */
export function CustomerSheet({
  customerId,
  onClose,
}: {
  customerId: string | null;
  onClose: () => void;
}) {
  const t = useTranslations('agency.customers.detail');
  const tCommon = useTranslations('common');
  // Garde le dernier client affiché pendant l'animation de fermeture.
  const [shownId, setShownId] = useState(customerId);
  if (customerId !== null && customerId !== shownId) {
    setShownId(customerId);
  }
  const { data, isPending, isError, error, refetch, isFetching } = useCustomer(shownId);

  return (
    <Sheet
      open={customerId !== null}
      onOpenChange={(open) => {
        if (!open) {
          onClose();
        }
      }}
    >
      <SheetContent
        side="end"
        closeLabel={tCommon('close')}
        className="w-full max-w-full gap-0 p-0 sm:max-w-md"
      >
        <SheetHeader className="border-b border-border p-6 pe-14">
          <SheetTitle>{data === undefined ? t('title') : customerName(data)}</SheetTitle>
          <SheetDescription>{t('description')}</SheetDescription>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto p-6">
          {shownId === null || isPending ? (
            <DetailSkeleton />
          ) : isError ? (
            <QueryError error={error} onRetry={() => void refetch()} retrying={isFetching} />
          ) : (
            <CustomerDetailContent customer={data} />
          )}
        </div>
        <div className="border-t border-border p-4 sm:px-6">
          <Button variant="secondary" className="w-full" onClick={onClose}>
            {tCommon('close')}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
