'use client';

import { MAINTENANCE_DAYS_MAX, MAINTENANCE_NOTE_MAX } from '@drivetn/types';
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
import { Field, fieldDescribedBy } from '@drivetn/ui/field';
import { Input } from '@drivetn/ui/input';
import { cn } from '@drivetn/ui/lib/cn';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@drivetn/ui/select';
import { Textarea } from '@drivetn/ui/textarea';
import { toast } from '@drivetn/ui/toaster';
import { CalendarOff, Wrench } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useId, useState } from 'react';
import { z } from 'zod';

import { Link } from '@/i18n/navigation';
import { addDays, type DayKey, diffInDays, todayKey } from '@/lib/agency/dates';
import { useAddMaintenance } from '@/lib/agency/queries';
import type { Vehicle } from '@/lib/agency/types';
import { ApiError } from '@/lib/api/errors';

import { type AgencyFormat, useAgencyFormat } from '../use-agency-format';

const QUICK_DURATIONS = [1, 2, 3, 7] as const;
const QUICK_REASONS = ['oilChange', 'tyres', 'service', 'inspection', 'bodywork'] as const;

const conflictSchema = z.object({
  reason: z.literal('BOOKINGS_OVERLAP'),
  bookings: z.array(z.object({ id: z.string(), reference: z.string() })),
});

type ServerConflict =
  { kind: 'bookings'; bookings: { id: string; reference: string }[] } | { kind: 'maintenance' };

function serverConflict(error: unknown): ServerConflict | null {
  if (!(error instanceof ApiError) || error.status !== 409) {
    return null;
  }
  const bookings = conflictSchema.safeParse(error.details);
  if (bookings.success) {
    return { kind: 'bookings', bookings: bookings.data.bookings };
  }
  return error.detailString('constraint') === 'vehicle_maintenances_no_overlap'
    ? { kind: 'maintenance' }
    : null;
}

export function vehicleLabel(vehicle: Pick<Vehicle, 'brand' | 'model' | 'plateNumber'>): string {
  const name = `${vehicle.brand} ${vehicle.model}`;
  return vehicle.plateNumber === null ? name : `${name} · ${vehicle.plateNumber}`;
}

/** « 12 oct. » ou « 12 oct. – 14 oct. » (jours inclus). */
export function daySpanLabel(format: AgencyFormat, from: DayKey, to: DayKey): string {
  const label = (day: DayKey) => format.dayMonth(`${day}T12:00:00Z`);
  return from === to ? label(from) : `${label(from)} – ${label(to)}`;
}

export interface MaintenanceDraft {
  vehicleId: string | null;
  from: DayKey;
}

/** Planifie un entretien : véhicule, premier et dernier jour inclus, motif facultatif. */
export function MaintenanceDialog({
  vehicles,
  draft,
  onClose,
}: {
  vehicles: readonly Vehicle[];
  draft: MaintenanceDraft;
  onClose: () => void;
}) {
  const t = useTranslations('agency.planning.maintenanceDialog');
  const tCommon = useTranslations('common');
  const format = useAgencyFormat();
  const id = useId();
  const mutation = useAddMaintenance();
  const today = todayKey();
  const [vehicleId, setVehicleId] = useState(draft.vehicleId);
  const [from, setFrom] = useState<string>(draft.from);
  const [to, setTo] = useState<string>(draft.from);
  const [note, setNote] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [conflict, setConflict] = useState<ServerConflict | null>(null);

  const vehicle = vehicles.find((candidate) => candidate.id === vehicleId);
  const vehicleError = vehicle === undefined ? t('errors.vehicleRequired') : undefined;
  const fromError =
    from === '' ? t('errors.fromRequired') : from < today ? t('errors.pastStart') : undefined;
  const toError =
    to === ''
      ? t('errors.toRequired')
      : from === ''
        ? undefined
        : to < from
          ? t('errors.endBeforeStart')
          : diffInDays(from, to) >= MAINTENANCE_DAYS_MAX
            ? t('errors.tooLong', { max: MAINTENANCE_DAYS_MAX })
            : undefined;
  const valid = vehicleError === undefined && fromError === undefined && toError === undefined;
  const dayCount = valid ? diffInDays(from, to) + 1 : null;

  function edit(apply: () => void) {
    apply();
    setConflict(null);
  }

  async function submit() {
    setSubmitted(true);
    if (!valid || vehicle === undefined) {
      return;
    }
    try {
      await mutation.mutateAsync({ vehicleId: vehicle.id, input: { from, to, note } });
      toast.success(t('success', { vehicle: vehicleLabel(vehicle) }));
      onClose();
    } catch (error) {
      const found = serverConflict(error);
      if (found === null) {
        toast.error(t('error'));
      }
      setConflict(found);
    }
  }

  const shown = (error: string | undefined) => (submitted ? error : undefined);

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) {
          onClose();
        }
      }}
    >
      <DialogContent closeLabel={tCommon('close')} className="sm:max-w-lg">
        <form
          className="grid gap-5"
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span className="flex size-8 items-center justify-center rounded-full bg-warning-soft text-warning-soft-foreground">
                <Wrench className="size-4" aria-hidden="true" />
              </span>
              {t('title')}
            </DialogTitle>
            <DialogDescription>{t('description')}</DialogDescription>
          </DialogHeader>

          <Field id={`${id}-vehicle`} label={t('vehicle')} error={shown(vehicleError)}>
            <Select
              value={vehicleId ?? ''}
              onValueChange={(value) => {
                edit(() => {
                  setVehicleId(value);
                });
              }}
            >
              <SelectTrigger
                id={`${id}-vehicle`}
                aria-invalid={shown(vehicleError) !== undefined || undefined}
                aria-describedby={fieldDescribedBy(`${id}-vehicle`, {
                  error: shown(vehicleError),
                })}
              >
                <SelectValue placeholder={t('vehiclePlaceholder')} />
              </SelectTrigger>
              <SelectContent>
                {vehicles.map((candidate) => (
                  <SelectItem key={candidate.id} value={candidate.id}>
                    {vehicleLabel(candidate)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <div className="grid gap-3">
            <div className="grid grid-cols-2 gap-3">
              <Field id={`${id}-from`} label={t('from')} error={shown(fromError)}>
                <Input
                  id={`${id}-from`}
                  type="date"
                  min={today}
                  value={from}
                  aria-invalid={shown(fromError) !== undefined || undefined}
                  aria-describedby={fieldDescribedBy(`${id}-from`, { error: shown(fromError) })}
                  onChange={(event) => {
                    const next = event.target.value;
                    edit(() => {
                      setFrom(next);
                      if (next !== '' && (to === '' || to < next)) {
                        setTo(next);
                      }
                    });
                  }}
                />
              </Field>
              <Field id={`${id}-to`} label={t('to')} error={shown(toError)}>
                <Input
                  id={`${id}-to`}
                  type="date"
                  min={from === '' ? today : from}
                  value={to}
                  aria-invalid={shown(toError) !== undefined || undefined}
                  aria-describedby={fieldDescribedBy(`${id}-to`, { error: shown(toError) })}
                  onChange={(event) => {
                    const next = event.target.value;
                    edit(() => {
                      setTo(next);
                    });
                  }}
                />
              </Field>
            </div>
            <div className="flex flex-wrap gap-2" role="group" aria-label={t('durationLabel')}>
              {QUICK_DURATIONS.map((count) => {
                const end = from === '' ? null : addDays(from, count - 1);
                return (
                  <Button
                    key={count}
                    type="button"
                    size="sm"
                    variant="secondary"
                    disabled={end === null}
                    aria-pressed={end !== null && to === end}
                    className={cn(
                      'h-8 rounded-full',
                      end !== null && to === end && 'border-primary bg-primary/10 text-primary',
                    )}
                    onClick={() => {
                      if (end !== null) {
                        edit(() => {
                          setTo(end);
                        });
                      }
                    }}
                  >
                    {t('duration', { count })}
                  </Button>
                );
              })}
            </div>
          </div>

          <div className="grid gap-2">
            <div className="flex flex-wrap gap-2" role="group" aria-label={t('reasonsLabel')}>
              {QUICK_REASONS.map((key) => (
                <Button
                  key={key}
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-7 rounded-full border border-dashed border-border px-3 text-xs"
                  onClick={() => {
                    setNote(t(`reasons.${key}`));
                  }}
                >
                  {t(`reasons.${key}`)}
                </Button>
              ))}
            </div>
            <Field id={`${id}-note`} label={t('note')}>
              <Textarea
                id={`${id}-note`}
                rows={2}
                maxLength={MAINTENANCE_NOTE_MAX}
                placeholder={t('notePlaceholder')}
                value={note}
                onChange={(event) => {
                  setNote(event.target.value);
                }}
              />
            </Field>
          </div>

          {dayCount !== null && (
            <p className="flex items-start gap-2 rounded-control bg-surface-muted px-3 py-2.5 text-sm">
              <CalendarOff
                className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                aria-hidden="true"
              />
              <span>
                {t('summary', {
                  days: t('duration', { count: dayCount }),
                  dates: daySpanLabel(format, from, to),
                })}
              </span>
            </p>
          )}

          {conflict?.kind === 'bookings' && (
            <Alert tone="danger" title={t('bookingsConflictTitle')}>
              <p>{t('bookingsConflict')}</p>
              <ul className="mt-1 flex flex-wrap gap-2">
                {conflict.bookings.map((booking) => (
                  <li key={booking.id}>
                    <Link
                      href={`/bookings/${booking.id}`}
                      className="font-semibold underline underline-offset-2"
                    >
                      {booking.reference}
                    </Link>
                  </li>
                ))}
              </ul>
            </Alert>
          )}
          {conflict?.kind === 'maintenance' && (
            <Alert tone="danger" title={t('maintenanceConflict')} />
          )}

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="secondary">
                {t('cancel')}
              </Button>
            </DialogClose>
            <Button type="submit" loading={mutation.isPending}>
              {t('submit')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
