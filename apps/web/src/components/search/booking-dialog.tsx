'use client';

import {
  BOOKING_NOTE_MAX,
  dayKeyToDate,
  rangesOverlap,
  rentalPriceMillimes,
  todayKey,
  WEEKLY_DISCOUNT_DAYS,
} from '@drivetn/types';
import { Alert } from '@drivetn/ui/alert';
import { Button } from '@drivetn/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@drivetn/ui/dialog';
import { Field } from '@drivetn/ui/field';
import { Money } from '@drivetn/ui/money';
import { PaymentMethodBadges } from '@drivetn/ui/payment-method-badges';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@drivetn/ui/select';
import { Textarea } from '@drivetn/ui/textarea';
import { toast } from '@drivetn/ui/toaster';
import { zodResolver } from '@hookform/resolvers/zod';
import { CalendarClock, ShieldCheck, UserRound, Zap } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useId, useRef, useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';

import { controlProps } from '@/components/auth/control-props';
import { useRouter } from '@/i18n/navigation';
import { ApiError } from '@/lib/api/errors';
import { useVehicleAvailability } from '@/lib/availability';
import { useCreateBooking } from '@/lib/bookings';

import { AvailabilityCalendar, lastOccupiedDay } from './availability-calendar';
import { type RentalDates, rentalDays, type SearchOffer } from './catalog';
import type { LocationOption } from './search-form';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

const bookingFormSchema = z
  .object({
    pickup: z.string().regex(ISO_DATE, { message: 'REQUIRED' }),
    return: z.string().regex(ISO_DATE, { message: 'REQUIRED' }),
    location: z.string().min(1, { message: 'REQUIRED' }),
    note: z.string().trim().max(BOOKING_NOTE_MAX, { message: 'TOO_LONG' }),
  })
  .refine((value) => value.return > value.pickup, {
    message: 'RETURN_BEFORE_PICKUP',
    path: ['return'],
  });

type BookingFormValues = z.input<typeof bookingFormSchema>;

const FORM_FIELDS = ['pickup', 'return', 'location', 'note'] as const;
const VALIDATION_CODES = ['REQUIRED', 'TOO_LONG', 'RETURN_BEFORE_PICKUP', 'PAST_DATE'] as const;

function isValidationCode(code: string): code is (typeof VALIDATION_CODES)[number] {
  return (VALIDATION_CODES as readonly string[]).includes(code);
}

/** Lieux du gouvernorat de l'agence ; tous les lieux si le référentiel ne le précise pas. */
function agencyLocations(options: readonly LocationOption[], governorateCode: string) {
  const local = options.filter((option) => option.governorateCode === governorateCode);
  return local.length > 0 ? local : options;
}

/**
 * Demande de réservation d'une offre. Aucun paiement en ligne : la location et la caution se
 * règlent à l'agence. À monter à l'ouverture pour repartir des critères de la recherche.
 */
export function BookingDialog({
  offer,
  dates,
  location,
  locationOptions,
  onOpenChange,
}: {
  offer: SearchOffer;
  dates: RentalDates | null;
  location: string | null;
  locationOptions: readonly LocationOption[];
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations('client.booking');
  const tMethod = useTranslations('status.paymentMethod');
  const tCommon = useTranslations('common');
  const locale = useLocale();
  const router = useRouter();
  const id = useId();
  const [today] = useState(todayKey);
  const [unavailable, setUnavailable] = useState(false);
  const [overlapWarning, setOverlapWarning] = useState(false);
  const createBooking = useCreateBooking();
  const availability = useVehicleAvailability(offer.id);
  const ranges = availability.data?.unavailable ?? [];
  const vehicleGone = availability.error instanceof ApiError && availability.error.status === 404;

  const places = agencyLocations(locationOptions, offer.agency.governorateCode);
  const form = useForm<BookingFormValues>({
    resolver: zodResolver(bookingFormSchema),
    defaultValues: {
      pickup: dates?.pickup ?? '',
      return: dates?.dropoff ?? '',
      location: places.some((place) => place.value === location)
        ? (location ?? '')
        : places.length === 1
          ? (places[0]?.value ?? '')
          : '',
      note: '',
    },
  });
  const { errors } = form.formState;
  const [pickup, dropoff] = useWatch({ control: form.control, name: ['pickup', 'return'] });
  const days = dropoff > pickup ? rentalDays(pickup, dropoff) : null;
  const datesTaken =
    overlapWarning ||
    (ISO_DATE.test(pickup) &&
      ISO_DATE.test(dropoff) &&
      dropoff > pickup &&
      rangesOverlap(pickup, dropoff, ranges));
  const refreshedSearch = useRef(false);
  useEffect(() => {
    if (
      refreshedSearch.current ||
      !availability.isSuccess ||
      dates === null ||
      !rangesOverlap(dates.pickup, dates.dropoff, availability.data.unavailable)
    ) {
      return;
    }
    refreshedSearch.current = true;
    router.refresh();
  }, [availability.isSuccess, availability.data, dates, router]);

  const formatDay = (day: string) =>
    new Intl.DateTimeFormat(`${locale}-TN-u-nu-latn`, {
      day: 'numeric',
      month: 'long',
      timeZone: 'Africa/Tunis',
    }).format(dayKeyToDate(day));

  const message = (code: string | undefined) =>
    code === undefined
      ? undefined
      : isValidationCode(code)
        ? t(`validation.${code}`)
        : t('validation.generic');
  const locationError = message(errors.location?.message);
  const noteError = message(errors.note?.message);

  const submit = form.handleSubmit(async (values) => {
    setUnavailable(false);
    if (rangesOverlap(values.pickup, values.return, ranges)) {
      setOverlapWarning(true);
      return;
    }
    try {
      const booking = await createBooking.mutateAsync({
        vehicleId: offer.id,
        pickup: values.pickup,
        return: values.return,
        location: values.location,
        note: values.note.length > 0 ? values.note : undefined,
      });
      if (booking.status === 'CONFIRMED') {
        toast.success(t('confirmedTitle'), {
          description: t('confirmedText', { reference: booking.reference }),
        });
      } else {
        toast.success(t('sentTitle'), {
          description: t('sentText', { reference: booking.reference, agency: offer.agency.name }),
        });
      }
      onOpenChange(false);
      router.push('/bookings');
    } catch (error) {
      if (error instanceof ApiError && error.code === 'VEHICLE_UNAVAILABLE') {
        setUnavailable(true);
        void availability.refetch();
        router.refresh();
        return;
      }
      if (error instanceof ApiError && error.validationIssues.length > 0) {
        for (const issue of error.validationIssues) {
          const field = FORM_FIELDS.find((name) => name === issue.path);
          if (field !== undefined) {
            form.setError(field, { type: 'server', message: issue.message });
          }
        }
        return;
      }
      toast.error(t('error'));
    }
  });

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent
        closeLabel={tCommon('close')}
        className="max-h-[92dvh] max-w-2xl overflow-y-auto"
      >
        <form
          noValidate
          className="grid gap-5"
          onSubmit={(event) => {
            void submit(event);
          }}
        >
          <DialogHeader>
            <DialogTitle>{t('title', { vehicle: `${offer.brand} ${offer.model}` })}</DialogTitle>
            <DialogDescription>{t('description', { agency: offer.agency.name })}</DialogDescription>
          </DialogHeader>

          {(unavailable || datesTaken || vehicleGone) && (
            <Alert tone="danger" title={t('unavailableTitle')}>
              {datesTaken ? t('calendar.overlap') : t('unavailableText')}
            </Alert>
          )}

          {ranges.length > 0 && (
            <div className="grid gap-2 rounded-card border border-border bg-surface-muted/60 p-4 text-sm">
              <p className="font-semibold">{t('calendar.takenTitle')}</p>
              <ul className="grid gap-1 text-muted-foreground">
                {ranges.map((range) => {
                  const until = lastOccupiedDay(range);
                  return (
                    <li key={`${range.pickup}-${range.return}`}>
                      {until === range.pickup
                        ? t('calendar.takenOne', { day: formatDay(range.pickup) })
                        : t('calendar.takenRange', {
                            from: formatDay(range.pickup),
                            until: formatDay(until),
                          })}
                    </li>
                  );
                })}
              </ul>
              <p className="text-muted-foreground">{t('calendar.takenHint')}</p>
            </div>
          )}

          {availability.isLoading ? (
            <p className="text-sm text-muted-foreground">{t('calendar.loading')}</p>
          ) : vehicleGone ? null : (
            <AvailabilityCalendar
              pickup={pickup}
              dropoff={dropoff}
              ranges={ranges}
              today={today}
              locale={locale}
              labels={{
                label: t('calendar.label'),
                previous: t('calendar.previous'),
                next: t('calendar.next'),
                occupied: t('calendar.occupied'),
              }}
              onSelect={(nextPickup, nextReturn) => {
                setOverlapWarning(false);
                setUnavailable(false);
                form.setValue('pickup', nextPickup, { shouldValidate: true });
                form.setValue('return', nextReturn, { shouldValidate: true });
              }}
              onOverlap={() => {
                setOverlapWarning(true);
              }}
            />
          )}

          <p className="text-sm text-muted-foreground">
            {days === null
              ? pickup.length > 0
                ? t('calendar.chooseReturn')
                : t('calendar.choosePickup')
              : t('calendar.chosen', {
                  pickup: formatDay(pickup),
                  return: formatDay(dropoff),
                })}
          </p>

          <Field
            id={`${id}-location`}
            label={t('fields.location')}
            hint={t('locationHint')}
            error={locationError}
          >
            <Controller
              control={form.control}
              name="location"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger
                    {...controlProps(`${id}-location`, {
                      error: locationError,
                      hint: t('locationHint'),
                    })}
                    onBlur={field.onBlur}
                  >
                    <SelectValue placeholder={t('locationPlaceholder')} />
                  </SelectTrigger>
                  <SelectContent className="max-h-72 overflow-y-auto">
                    {places.map((place) => (
                      <SelectItem key={place.value} value={place.value}>
                        {place.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </Field>

          <Field id={`${id}-note`} label={t('fields.note')} error={noteError}>
            <Textarea
              {...controlProps(`${id}-note`, { error: noteError })}
              rows={2}
              maxLength={BOOKING_NOTE_MAX}
              placeholder={t('notePlaceholder')}
              {...form.register('note')}
            />
          </Field>

          <section
            aria-label={t('summary.title')}
            className="grid gap-3 rounded-card border border-border bg-surface-muted/60 p-4 text-sm"
          >
            {days === null ? (
              <p className="text-muted-foreground">{t('summary.pickDates')}</p>
            ) : (
              <dl className="grid gap-2">
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-muted-foreground">
                    {t('summary.rate', { count: days })}{' '}
                    <Money millimes={offer.pricePerDayMillimes} locale={locale} />
                  </dt>
                  <dd className="tabular-nums">
                    <Money millimes={offer.pricePerDayMillimes * days} locale={locale} />
                  </dd>
                </div>
                {days >= WEEKLY_DISCOUNT_DAYS && (
                  <div className="flex items-center justify-between gap-3 text-success">
                    <dt>{t('summary.weeklyDiscount')}</dt>
                    <dd className="tabular-nums">
                      −
                      <Money
                        millimes={
                          offer.pricePerDayMillimes * days -
                          rentalPriceMillimes(offer.pricePerDayMillimes, days)
                        }
                        locale={locale}
                      />
                    </dd>
                  </div>
                )}
                <div className="flex items-center justify-between gap-3 border-t border-border pt-2 text-base font-bold">
                  <dt>{t('summary.total')}</dt>
                  <dd className="tabular-nums">
                    <Money
                      millimes={rentalPriceMillimes(offer.pricePerDayMillimes, days)}
                      locale={locale}
                    />
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-3 text-muted-foreground">
                  <dt>{t('summary.deposit')}</dt>
                  <dd className="tabular-nums">
                    <Money millimes={offer.depositMillimes} locale={locale} />
                  </dd>
                </div>
              </dl>
            )}
            <ul className="grid gap-2 border-t border-border pt-3 text-muted-foreground">
              <li className="flex items-start gap-2">
                {offer.agency.instantConfirmation ? (
                  <Zap className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
                ) : (
                  <CalendarClock
                    className="mt-0.5 size-4 shrink-0 text-primary"
                    aria-hidden="true"
                  />
                )}
                {offer.agency.instantConfirmation
                  ? t('conditions.instant')
                  : t('conditions.request')}
              </li>
              <li className="flex items-start gap-2">
                <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
                {t('conditions.cancellation', { hours: offer.agency.freeCancellationHours })}
              </li>
              <li className="flex items-start gap-2">
                <UserRound className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
                {t('conditions.driverAge', { age: offer.agency.minDriverAge })}
              </li>
            </ul>
            {offer.agency.acceptedPaymentMethods.length > 0 && (
              <div className="grid gap-2">
                <p className="text-muted-foreground">{t('conditions.payment')}</p>
                <PaymentMethodBadges
                  methods={offer.agency.acceptedPaymentMethods}
                  getLabel={(method) => tMethod(method)}
                />
              </div>
            )}
          </section>

          <DialogFooter>
            <DialogClose asChild>
              <Button variant="secondary">{tCommon('close')}</Button>
            </DialogClose>
            <Button
              type="submit"
              variant="cta"
              loading={createBooking.isPending}
              disabled={days === null || datesTaken || availability.isLoading || vehicleGone}
              className="shadow-md shadow-cta/20"
            >
              {offer.agency.instantConfirmation ? t('submitInstant') : t('submit')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
