'use client';

import { VEHICLE_STATUSES, type VehicleStatus } from '@drivetn/types';
import {
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from '@drivetn/ui/dropdown-menu';
import { toast } from '@drivetn/ui/toaster';
import { useTranslations } from 'next-intl';

import { useVehicleStatus } from '@/lib/agency/queries';

/** Choix du statut d'un véhicule, à placer dans un `DropdownMenuContent`. */
export function VehicleStatusItems({
  vehicleId,
  status,
  onRent,
}: {
  vehicleId: string;
  status: VehicleStatus;
  onRent: boolean;
}) {
  const t = useTranslations('agency.fleet.statusMenu');
  const mutation = useVehicleStatus();

  return (
    <>
      <DropdownMenuLabel>{t('title')}</DropdownMenuLabel>
      <DropdownMenuRadioGroup
        value={status}
        onValueChange={(value) => {
          const next = VEHICLE_STATUSES.find((candidate) => candidate === value);
          if (next === undefined || next === status) {
            return;
          }
          mutation.mutate(
            { id: vehicleId, status: next },
            {
              onSuccess: () => toast.success(t(`success.${next}`)),
              onError: () => toast.error(t('error')),
            },
          );
        }}
      >
        {VEHICLE_STATUSES.map((option) => (
          <DropdownMenuRadioItem
            key={option}
            value={option}
            disabled={onRent || mutation.isPending}
          >
            {t(`options.${option}`)}
          </DropdownMenuRadioItem>
        ))}
      </DropdownMenuRadioGroup>
      {onRent && <p className="px-2 pb-2 pt-1 text-xs text-muted-foreground">{t('onRentHint')}</p>}
    </>
  );
}
