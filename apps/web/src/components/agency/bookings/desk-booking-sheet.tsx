'use client';

import {
  type DeskBookingInput,
  isValidTunisianPhone,
  rangesOverlap,
  rentalPriceMillimes,
  rentalWindow,
  todayKey,
} from '@drivetn/types';
import { Button } from '@drivetn/ui/button';
import { Field } from '@drivetn/ui/field';
import { Input } from '@drivetn/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@drivetn/ui/select';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@drivetn/ui/sheet';
import { Textarea } from '@drivetn/ui/textarea';
import { toast } from '@drivetn/ui/toaster';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';
import { useId, useMemo, useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';

import { controlProps } from '@/components/auth/control-props';
import { useRouter } from '@/i18n/navigation';
import { ApiError } from '@/lib/api/errors';
import { useVehicleAvailability } from '@/lib/availability';
import { useCreateDeskBooking, useVehicles } from '@/lib/agency/queries';
import type { VehicleView } from '@/lib/agency/types';

import { useAgencyFormat } from '../use-agency-format';
import { applyFieldIssues, useValidationMessage } from '../use-validation-message';

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { message: 'INVALID_DATE' });
const name = z.string().trim().min(1, { message: 'REQUIRED' }).max(60, { message: 'TOO_LONG' });

function deskFormSchema(today: string) {
  return z
    .object({
      vehicleId: z.string().min(1, { message: 'REQUIRED' }),
      pickup: day,
      return: day,
      phone: z
        .string()
        .trim()
        .min(1, { message: 'REQUIRED' })
        .refine(isValidTunisianPhone, { message: 'INVALID_TUNISIAN_PHONE' }),
      firstName: name,
      lastName: name,
      note: z.string().trim().max(300, { message: 'TOO_LONG' }),
    })
    .refine((value) => value.pickup >= today, { message: 'PAST_DATE', path: ['pickup'] })
    .refine((value) => value.return > value.pickup, {
      message: 'RETURN_BEFORE_PICKUP',
      path: ['return'],
    });
}

type DeskFormValues = z.infer<ReturnType<typeof deskFormSchema>>;

function vehicleLabel(vehicle: VehicleView): string {
  const plate = vehicle.plateNumber?.trim() ?? '';
  return plate.length > 0
    ? `${vehicle.brand} ${vehicle.model} · ${plate}`
    : `${vehicle.brand} ${vehicle.model}`;
}

export function DeskBookingSheet({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations('agency.bookings.create');
  const tCommon = useTranslations('common');
  const format = useAgencyFormat();
  const router = useRouter();
  const id = useId();
  const today = todayKey();
  const schema = useMemo(() => deskFormSchema(today), [today]);
  const vehicles = useVehicles();
  const create = useCreateDeskBooking();
  const validationMessage = useValidationMessage();
  const [formError, setFormError] = useState<string | null>(null);
  const activeVehicles = (vehicles.data ?? []).filter((vehicle) => vehicle.status === 'ACTIVE');

  const form = useForm<DeskFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      vehicleId: '',
      pickup: '',
      return: '',
      phone: '',
      firstName: '',
      lastName: '',
      note: '',
    },
  });
  const vehicleId = useWatch({ control: form.control, name: 'vehicleId' });
  const pickup = useWatch({ control: form.control, name: 'pickup' });
  const dropoff = useWatch({ control: form.control, name: 'return' });
  const availability = useVehicleAvailability(vehicleId);
  const selected = activeVehicles.find((vehicle) => vehicle.id === vehicleId) ?? null;
  const datesValid = /^\d{4}-\d{2}-\d{2}$/.test(pickup) && dropoff > pickup;
  const taken = datesValid && rangesOverlap(pickup, dropoff, availability.data?.unavailable ?? []);
  const quote =
    selected !== null && datesValid
      ? rentalPriceMillimes(selected.dailyRateMillimes, rentalWindow(pickup, dropoff).days)
      : null;

  const { errors } = form.formState;
  const error = (field: keyof DeskFormValues) => validationMessage(errors[field]?.message);

  const close = (next: boolean) => {
    if (!next) {
      form.reset();
      setFormError(null);
    }
    onOpenChange(next);
  };

  return (
    <Sheet open={open} onOpenChange={close}>
      <SheetContent
        side="end"
        closeLabel={tCommon('close')}
        className="w-full max-w-full gap-0 p-0 sm:max-w-xl"
      >
        <form
          noValidate
          className="flex h-full flex-col"
          onSubmit={(event) => {
            void form.handleSubmit(async (values) => {
              setFormError(null);
              if (
                rangesOverlap(values.pickup, values.return, availability.data?.unavailable ?? [])
              ) {
                setFormError(t('unavailable'));
                return;
              }
              const input: DeskBookingInput = {
                vehicleId: values.vehicleId,
                pickup: values.pickup,
                return: values.return,
                phone: values.phone,
                firstName: values.firstName,
                lastName: values.lastName,
                note: values.note.length === 0 ? undefined : values.note,
              };
              try {
                const booking = await create.mutateAsync(input);
                toast.success(t('success', { reference: booking.reference }));
                form.reset();
                onOpenChange(false);
                router.push(`/bookings/${booking.id}`);
              } catch (caught) {
                if (caught instanceof ApiError && caught.code === 'VEHICLE_UNAVAILABLE') {
                  void availability.refetch();
                  setFormError(t('unavailable'));
                  return;
                }
                if (
                  !applyFieldIssues(caught, form.setError, [
                    'phone',
                    'pickup',
                    'return',
                    'vehicleId',
                  ])
                ) {
                  setFormError(t('error'));
                }
              }
            })(event);
          }}
        >
          <SheetHeader className="border-b border-border p-6 pe-14">
            <SheetTitle>{t('title')}</SheetTitle>
            <SheetDescription>{t('description')}</SheetDescription>
          </SheetHeader>
          <div className="grid flex-1 gap-4 overflow-y-auto p-6">
            {activeVehicles.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('noVehicle')}</p>
            ) : (
              <Field id={`${id}-vehicle`} label={t('vehicle')} error={error('vehicleId')}>
                <Controller
                  control={form.control}
                  name="vehicleId"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger
                        id={`${id}-vehicle`}
                        aria-invalid={error('vehicleId') !== undefined}
                        onBlur={field.onBlur}
                        ref={field.ref}
                      >
                        <SelectValue placeholder={t('vehiclePlaceholder')} />
                      </SelectTrigger>
                      <SelectContent>
                        {activeVehicles.map((vehicle) => (
                          <SelectItem key={vehicle.id} value={vehicle.id}>
                            {vehicleLabel(vehicle)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </Field>
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              <Field id={`${id}-pickup`} label={t('pickup')} error={error('pickup')}>
                <Input
                  {...controlProps(`${id}-pickup`, { error: error('pickup') })}
                  type="date"
                  min={today}
                  dir="ltr"
                  {...form.register('pickup')}
                />
              </Field>
              <Field id={`${id}-return`} label={t('return')} error={error('return')}>
                <Input
                  {...controlProps(`${id}-return`, { error: error('return') })}
                  type="date"
                  min={pickup.length > 0 ? pickup : today}
                  dir="ltr"
                  {...form.register('return')}
                />
              </Field>
            </div>
            {taken && (
              <p className="text-sm text-destructive" role="alert">
                {t('unavailable')}
              </p>
            )}
            <Field
              id={`${id}-phone`}
              label={t('phone')}
              hint={t('phoneHint')}
              error={error('phone')}
            >
              <Input
                {...controlProps(`${id}-phone`, { error: error('phone'), hint: t('phoneHint') })}
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                dir="ltr"
                placeholder="20 123 456"
                {...form.register('phone')}
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field id={`${id}-first`} label={t('firstName')} error={error('firstName')}>
                <Input
                  {...controlProps(`${id}-first`, { error: error('firstName') })}
                  autoComplete="given-name"
                  {...form.register('firstName')}
                />
              </Field>
              <Field id={`${id}-last`} label={t('lastName')} error={error('lastName')}>
                <Input
                  {...controlProps(`${id}-last`, { error: error('lastName') })}
                  autoComplete="family-name"
                  {...form.register('lastName')}
                />
              </Field>
            </div>
            <Field id={`${id}-note`} label={t('note')} error={error('note')}>
              <Textarea
                {...controlProps(`${id}-note`, { error: error('note') })}
                rows={3}
                placeholder={t('notePlaceholder')}
                {...form.register('note')}
              />
            </Field>
            {quote !== null && (
              <p className="text-sm">
                <span className="text-muted-foreground">{t('total')} · </span>
                <span className="font-medium tabular-nums">{format.money(quote)}</span>
              </p>
            )}
            {formError !== null && (
              <p className="text-sm text-destructive" role="alert">
                {formError}
              </p>
            )}
          </div>
          <div className="flex justify-end gap-2 border-t border-border p-6">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                close(false);
              }}
            >
              {t('cancel')}
            </Button>
            <Button
              type="submit"
              disabled={create.isPending || activeVehicles.length === 0 || taken}
            >
              {t('submit')}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
