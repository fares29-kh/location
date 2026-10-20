'use client';

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
import { cn } from '@drivetn/ui/lib/cn';
import { toast } from '@drivetn/ui/toaster';
import { Tooltip, TooltipContent, TooltipTrigger } from '@drivetn/ui/tooltip';
import { Trash2, Wrench } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

import { diffInDays } from '@/lib/agency/dates';
import { useRemoveMaintenance } from '@/lib/agency/queries';
import type { Vehicle, VehicleMaintenance } from '@/lib/agency/types';

import { useAgencyFormat } from '../use-agency-format';
import { daySpanLabel, vehicleLabel } from './maintenance-dialog';
import { maintenanceTimeRange, placeInRange, type TimeRange } from './planning-model';

/** Hachures orange : entretien (planifié ou statut « en entretien »). */
export const MAINTENANCE_HATCH =
  'repeating-linear-gradient(135deg, hsl(var(--warning) / 0.22) 0 6px, hsl(var(--warning) / 0.08) 6px 12px)';

function usePeriodLabel(maintenance: VehicleMaintenance) {
  const t = useTranslations('agency.planning');
  const format = useAgencyFormat();
  return t('maintenancePeriod', {
    dates: daySpanLabel(format, maintenance.from, maintenance.to),
    days: t('span', { count: diffInDays(maintenance.from, maintenance.to) + 1 }),
  });
}

export function MaintenanceBar({
  maintenance,
  vehicle,
  range,
}: {
  maintenance: VehicleMaintenance;
  vehicle: Vehicle;
  range: TimeRange;
}) {
  const t = useTranslations('agency.planning');
  const tCommon = useTranslations('common');
  const [open, setOpen] = useState(false);
  const removal = useRemoveMaintenance();
  const period = usePeriodLabel(maintenance);
  const place = placeInRange(maintenanceTimeRange(maintenance), range);
  if (!place.visible) {
    return null;
  }
  const title = maintenance.note.length > 0 ? maintenance.note : t('plannedMaintenance');

  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-label={t('maintenanceBarLabel', { vehicle: vehicleLabel(vehicle), period })}
            style={{
              insetInlineStart: `${String(place.offset)}%`,
              width: `${String(place.width)}%`,
              backgroundImage: MAINTENANCE_HATCH,
            }}
            className={cn(
              'absolute top-1/2 z-[1] flex h-9 min-w-2 -translate-y-1/2 items-center gap-1.5 overflow-hidden border border-warning/50 bg-surface px-2 text-xs font-medium text-warning-soft-foreground shadow-sm transition-shadow hover:shadow-md',
              'focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
              place.clippedStart ? 'rounded-s-none' : 'rounded-s-control',
              place.clippedEnd ? 'rounded-e-none' : 'rounded-e-control',
            )}
            onClick={() => {
              setOpen(true);
            }}
          >
            <Wrench className="size-3.5 shrink-0" aria-hidden="true" />
            <span className="truncate">{title}</span>
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" className="grid gap-0.5">
          <span className="font-semibold">{t('plannedMaintenance')}</span>
          <span>{period}</span>
          {maintenance.note.length > 0 && <span>{maintenance.note}</span>}
        </TooltipContent>
      </Tooltip>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent closeLabel={tCommon('close')}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span className="flex size-8 items-center justify-center rounded-full bg-warning-soft text-warning-soft-foreground">
                <Wrench className="size-4" aria-hidden="true" />
              </span>
              {t('maintenanceDetail.title')}
            </DialogTitle>
            <DialogDescription>{vehicleLabel(vehicle)}</DialogDescription>
          </DialogHeader>
          <dl className="grid gap-3 rounded-control bg-surface-muted p-4 text-sm">
            <div className="grid gap-0.5">
              <dt className="text-xs text-muted-foreground">{t('maintenanceDetail.period')}</dt>
              <dd className="font-medium">{period}</dd>
            </div>
            <div className="grid gap-0.5">
              <dt className="text-xs text-muted-foreground">{t('maintenanceDetail.note')}</dt>
              <dd className={cn(maintenance.note.length === 0 && 'text-muted-foreground')}>
                {maintenance.note.length > 0 ? maintenance.note : t('maintenanceDetail.noNote')}
              </dd>
            </div>
          </dl>
          <p className="text-sm text-muted-foreground">{t('maintenanceDetail.hint')}</p>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="secondary">{t('maintenanceDetail.close')}</Button>
            </DialogClose>
            <Button
              variant="danger"
              loading={removal.isPending}
              onClick={() => {
                removal.mutate(
                  { vehicleId: maintenance.vehicleId, maintenanceId: maintenance.id },
                  {
                    onSuccess: () => {
                      toast.success(t('maintenanceDetail.deleted'));
                      setOpen(false);
                    },
                    onError: () => toast.error(t('maintenanceDetail.deleteError')),
                  },
                );
              }}
            >
              {!removal.isPending && <Trash2 aria-hidden="true" />}
              {t('maintenanceDetail.delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
