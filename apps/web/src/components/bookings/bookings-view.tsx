'use client';

import {
  AGENCY_TIME_ZONE,
  type BookingStatus,
  canCustomerReview,
  canEditCustomerReview,
  type CustomerBooking,
  formatNationalPhone,
  pickLocalized,
  toE164,
} from '@drivetn/types';
import { Button } from '@drivetn/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@drivetn/ui/card';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@drivetn/ui/dialog';
import { EmptyState } from '@drivetn/ui/empty-state';
import { ErrorState } from '@drivetn/ui/error-state';
import { Money } from '@drivetn/ui/money';
import { Rating } from '@drivetn/ui/rating';
import { Skeleton } from '@drivetn/ui/skeleton';
import { BookingStatusBadge } from '@drivetn/ui/status-badges';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@drivetn/ui/tabs';
import { toast } from '@drivetn/ui/toaster';
import { WhatsAppButton } from '@drivetn/ui/whatsapp-button';
import {
  ArrowRight,
  Building2,
  CalendarCheck,
  CalendarClock,
  CarFront,
  Check,
  History,
  MapPin,
  Phone,
  Plus,
  Search,
} from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';

import { AgencyLogo } from '@/components/agencies/agency-logo';
import { PageHero } from '@/components/client/page-hero';
import { Link } from '@/i18n/navigation';
import { ApiError } from '@/lib/api/errors';
import { useCancelBooking, useMyBookings } from '@/lib/bookings';

import { ReviewDialog } from './review-dialog';

const TABS = [
  { id: 'upcoming', icon: CalendarClock, statuses: ['PENDING', 'CONFIRMED'] },
  { id: 'active', icon: CarFront, statuses: ['PICKED_UP'] },
  {
    id: 'past',
    icon: History,
    statuses: ['RETURNED', 'COMPLETED', 'CANCELLED', 'REJECTED', 'NO_SHOW', 'EXPIRED'],
  },
] as const satisfies readonly {
  id: string;
  icon: typeof CalendarClock;
  statuses: readonly BookingStatus[];
}[];

type TabId = (typeof TABS)[number]['id'];

const JOURNEY = ['PENDING', 'CONFIRMED', 'PICKED_UP', 'COMPLETED'] as const;

const CHECKLIST = ['identity', 'license', 'deposit', 'payment'] as const;

function tabOf(status: BookingStatus): TabId {
  return (
    TABS.find((tab) => (tab.statuses as readonly BookingStatus[]).includes(status))?.id ?? 'past'
  );
}

function useDateTimeFormat() {
  const locale = useLocale();
  const format = new Intl.DateTimeFormat(`${locale}-TN-u-nu-latn`, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: AGENCY_TIME_ZONE,
  });
  return (iso: string) => format.format(new Date(iso));
}

function CancelDialog({
  booking,
  onOpenChange,
}: {
  booking: CustomerBooking;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations('client.bookings.cancel');
  const tCommon = useTranslations('common');
  const cancel = useCancelBooking();

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent closeLabel={tCommon('close')} className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t('title')}</DialogTitle>
          <DialogDescription>{t('text', { reference: booking.reference })}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="secondary">{t('keep')}</Button>
          </DialogClose>
          <Button
            variant="danger"
            loading={cancel.isPending}
            onClick={() => {
              cancel.mutate(
                { id: booking.id, input: {} },
                {
                  onSuccess: () => {
                    toast.success(t('done'));
                    onOpenChange(false);
                  },
                  onError: (error) => {
                    toast.error(
                      error instanceof ApiError && error.code === 'BOOKING_NOT_CANCELLABLE'
                        ? t('notCancellable')
                        : t('error'),
                    );
                  },
                },
              );
            }}
          >
            {t('confirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function BookingCard({
  booking,
  onCancel,
  onReview,
}: {
  booking: CustomerBooking;
  onCancel: (booking: CustomerBooking) => void;
  onReview: (booking: CustomerBooking) => void;
}) {
  const t = useTranslations('client.bookings');
  const tStatus = useTranslations('status.booking');
  const tCatalog = useTranslations('client.catalog');
  const locale = useLocale();
  const formatDateTime = useDateTimeFormat();

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border p-5">
        <div className="grid gap-1">
          <h3 className="text-lg font-bold leading-tight">
            {booking.vehicle.brand} {booking.vehicle.model}
          </h3>
          <p className="text-sm text-muted-foreground">
            {tCatalog(`transmission.${booking.vehicle.transmission}`)} ·{' '}
            {t('card.seats', { count: booking.vehicle.seats })} ·{' '}
            <span className="font-mono text-xs" dir="ltr">
              {booking.reference}
            </span>
          </p>
        </div>
        <BookingStatusBadge status={booking.status}>{tStatus(booking.status)}</BookingStatusBadge>
      </div>

      <div className="grid gap-5 p-5 sm:grid-cols-2">
        <div className="grid content-start gap-3 text-sm">
          <p className="flex flex-wrap items-center gap-2 font-medium">
            <CalendarClock className="size-4 shrink-0 text-primary" aria-hidden="true" />
            <span>{formatDateTime(booking.pickupAt)}</span>
            <ArrowRight
              className="size-4 shrink-0 text-muted-foreground rtl:rotate-180"
              aria-hidden="true"
            />
            <span>{formatDateTime(booking.returnAt)}</span>
          </p>
          <p className="flex items-center gap-2 text-muted-foreground">
            <MapPin className="size-4 shrink-0 text-primary" aria-hidden="true" />
            {pickLocalized(booking.pickupLocation, locale)}
          </p>
          <p className="text-muted-foreground">{t(`statusHints.${booking.status}`)}</p>
        </div>

        <dl className="grid content-start gap-2 rounded-card bg-surface-muted/60 p-4 text-sm">
          <div className="flex items-center justify-between gap-3">
            <dt className="text-muted-foreground">{t('card.days', { count: booking.days })}</dt>
            <dd className="font-bold tabular-nums">
              <Money millimes={booking.totalMillimes} locale={locale} />
            </dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt className="text-muted-foreground">{t('card.deposit')}</dt>
            <dd className="tabular-nums">
              <Money millimes={booking.depositMillimes} locale={locale} />
            </dd>
          </div>
          <p className="text-xs text-muted-foreground">{t('card.payAtAgency')}</p>
        </dl>
        {booking.review !== null && (
          <div className="grid gap-2 rounded-control border border-border bg-surface-muted/40 p-3 text-sm sm:col-span-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-medium">{t('review.yours')}</p>
              <Rating
                value={booking.review.rating}
                label={t('review.ratingValue', { rating: booking.review.rating })}
              />
            </div>
            <p className="text-pretty text-muted-foreground">{booking.review.comment}</p>
            {booking.review.moderationStatus === 'HIDDEN' && (
              <p className="text-xs text-muted-foreground">{t('review.hidden')}</p>
            )}
            {booking.review.moderationStatus === 'FLAGGED' && (
              <p className="text-xs text-muted-foreground">{t('review.flagged')}</p>
            )}
            {booking.review.reply !== null && (
              <p className="border-s-2 border-primary ps-3 text-muted-foreground">
                <span className="font-medium text-foreground">{t('review.agencyReply')} </span>
                {booking.review.reply}
              </p>
            )}
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border bg-surface-muted/30 px-5 py-4">
        <div className="grid min-w-0 gap-0.5 text-sm">
          <p className="flex items-center gap-2 font-medium">
            {booking.agency.logoUrl === null ? (
              <Building2 className="size-4 shrink-0 text-primary" aria-hidden="true" />
            ) : (
              <AgencyLogo
                name={booking.agency.name}
                logoUrl={booking.agency.logoUrl}
                className="size-7 rounded-md p-0.5 ring-1 ring-border"
              />
            )}
            <span className="truncate">{booking.agency.name}</span>
          </p>
          {booking.agency.address.length > 0 && (
            <p className="truncate text-muted-foreground">{booking.agency.address}</p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {booking.agency.phone.length > 0 && (
            <Button asChild variant="secondary" size="sm">
              <a href={`tel:${booking.agency.phone}`} dir="ltr">
                <Phone aria-hidden="true" />
                {t('card.call')}
              </a>
            </Button>
          )}
          {booking.agency.extraPhones.map((extraPhone) => (
            <Button key={extraPhone} asChild variant="secondary" size="sm">
              <a href={`tel:${toE164(extraPhone)}`} dir="ltr">
                <Phone aria-hidden="true" />
                {formatNationalPhone(extraPhone)}
              </a>
            </Button>
          ))}
          {booking.agency.whatsappPhone.length > 0 && (
            <WhatsAppButton
              size="sm"
              phone={booking.agency.whatsappPhone}
              message={t('card.whatsappMessage', { reference: booking.reference })}
            >
              WhatsApp
            </WhatsAppButton>
          )}
          {canCustomerReview(booking.status) &&
            (booking.review === null || canEditCustomerReview(booking.review)) && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  onReview(booking);
                }}
              >
                {booking.review === null ? t('review.write') : t('review.edit')}
              </Button>
            )}
          {booking.canCancel && (
            <Button
              variant="ghost"
              size="sm"
              className="text-danger hover:text-danger"
              onClick={() => {
                onCancel(booking);
              }}
            >
              {t('card.cancel')}
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}

function BookingsSkeleton() {
  return (
    <div className="grid gap-4" aria-hidden="true">
      {Array.from({ length: 2 }, (_, index) => (
        <Card key={index} className="grid gap-4 p-5">
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-4 w-64" />
          <Skeleton className="h-16 w-full" />
        </Card>
      ))}
    </div>
  );
}

export function BookingsView({ firstName }: { firstName: string }) {
  const t = useTranslations('client.bookings');
  const tStatus = useTranslations('status.booking');
  const tCommon = useTranslations('common');
  const bookings = useMyBookings();
  const [selectedTab, setSelectedTab] = useState<TabId | null>(null);
  const [cancelling, setCancelling] = useState<CustomerBooking | null>(null);
  const [reviewing, setReviewing] = useState<CustomerBooking | null>(null);

  const list = bookings.data ?? [];
  const byTab = Object.fromEntries(
    TABS.map((tab) => [tab.id, list.filter((booking) => tabOf(booking.status) === tab.id)]),
  ) as Record<TabId, CustomerBooking[]>;
  const tab: TabId = selectedTab ?? (byTab.active.length > 0 ? 'active' : 'upcoming');

  const searchAction = (
    <Button asChild>
      <Link href="/search">
        <Search aria-hidden="true" />
        {t('empty.action')}
      </Link>
    </Button>
  );

  return (
    <>
      <PageHero
        id="bookings-title"
        icon={CalendarCheck}
        eyebrow={t('eyebrow')}
        title={t('title')}
        subtitle={t('subtitle', { name: firstName })}
        actions={
          <Button asChild variant="cta" size="lg" className="shadow-lg shadow-cta/25">
            <Link href="/search">
              <Plus aria-hidden="true" />
              {t('newBooking')}
            </Link>
          </Button>
        }
      />

      <div className="container grid gap-8 py-8 sm:py-12 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <Tabs
          value={tab}
          onValueChange={(value) => {
            setSelectedTab(TABS.find((item) => item.id === value)?.id ?? 'upcoming');
          }}
          className="min-w-0"
        >
          <TabsList aria-label={t('tabs.label')} className="w-full sm:w-auto">
            {TABS.map((item) => (
              <TabsTrigger key={item.id} value={item.id} className="flex-1 sm:flex-none">
                <item.icon className="size-4" aria-hidden="true" />
                {t(`tabs.${item.id}`)}
                {byTab[item.id].length > 0 && (
                  <span className="rounded-full bg-surface-muted px-1.5 text-xs tabular-nums">
                    {byTab[item.id].length}
                  </span>
                )}
              </TabsTrigger>
            ))}
          </TabsList>
          {TABS.map((item) => (
            <TabsContent key={item.id} value={item.id} className="mt-6">
              {bookings.isPending ? (
                <BookingsSkeleton />
              ) : bookings.isError ? (
                <ErrorState
                  title={t('loadErrorTitle')}
                  description={t('loadErrorText')}
                  retryLabel={tCommon('retry')}
                  onRetry={() => {
                    void bookings.refetch();
                  }}
                  retrying={bookings.isRefetching}
                />
              ) : byTab[item.id].length > 0 ? (
                <ul className="grid gap-4">
                  {byTab[item.id].map((booking) => (
                    <li key={booking.id}>
                      <BookingCard
                        booking={booking}
                        onCancel={setCancelling}
                        onReview={setReviewing}
                      />
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState
                  icon={item.icon}
                  title={t(`empty.${item.id}Title`)}
                  description={t(`empty.${item.id}Text`)}
                  action={item.id === 'active' ? undefined : searchAction}
                  className="bg-surface py-16 shadow-soft"
                />
              )}
            </TabsContent>
          ))}
        </Tabs>

        <aside className="grid content-start gap-6">
          <Card>
            <CardHeader>
              <CardTitle>{t('journey.title')}</CardTitle>
              <CardDescription>{t('journey.description')}</CardDescription>
            </CardHeader>
            <CardContent>
              <ol className="grid gap-5">
                {JOURNEY.map((status, index) => (
                  <li key={status} className="relative flex gap-3">
                    {index < JOURNEY.length - 1 && (
                      <span
                        aria-hidden="true"
                        className="absolute start-[0.9375rem] top-9 h-[calc(100%-1rem)] w-px bg-border"
                      />
                    )}
                    <span
                      aria-hidden="true"
                      className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary-soft text-sm font-bold text-primary-soft-foreground ring-4 ring-surface"
                    >
                      {index + 1}
                    </span>
                    <div className="grid gap-1 pt-1">
                      <BookingStatusBadge status={status} className="w-fit">
                        {tStatus(status)}
                      </BookingStatusBadge>
                      <p className="text-sm text-muted-foreground">{t(`journey.${status}`)}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t('checklist.title')}</CardTitle>
              <CardDescription>{t('checklist.description')}</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="grid gap-3 text-sm">
                {CHECKLIST.map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-success-soft text-success-soft-foreground">
                      <Check className="size-3.5" strokeWidth={3} aria-hidden="true" />
                    </span>
                    {t(`checklist.${item}`)}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </aside>
      </div>

      {reviewing !== null && (
        <ReviewDialog
          key={reviewing.id}
          booking={reviewing}
          onOpenChange={(open) => {
            if (!open) {
              setReviewing(null);
            }
          }}
        />
      )}

      {cancelling !== null && (
        <CancelDialog
          key={cancelling.id}
          booking={cancelling}
          onOpenChange={(open) => {
            if (!open) {
              setCancelling(null);
            }
          }}
        />
      )}
    </>
  );
}
