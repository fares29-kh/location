'use client';

import { VEHICLE_STATUSES, type VehicleStatus } from '@drivetn/types';
import {
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from '@drivetn/ui/dropdown-menu';
import { toast } from '@drivetn/ui/toaster';
import { Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { type ReactNode, useState } from 'react';

import { useDeleteVehicle, useVehicleStatus } from '@/lib/agency/queries';
import { ApiError } from '@/lib/api/errors';

import { ConfirmDialog } from './confirm-dialog';

type Withdrawal = Exclude<VehicleStatus, 'ACTIVE'>;

/** Statut et suppression, avec confirmation avant de retirer un véhicule de la location. */
export function VehicleGuards({
  vehicleId,
  name,
  status,
  onRent,
  children,
}: {
  vehicleId: string;
  name: string;
  status: VehicleStatus;
  onRent: boolean;
  children: (parts: { statusItems: ReactNode; deleteItem: ReactNode }) => ReactNode;
}) {
  const t = useTranslations('agency.fleet');
  const tStatus = useTranslations('agency.fleet.statusMenu');
  const tCommon = useTranslations('common');
  const statusChange = useVehicleStatus();
  const deletion = useDeleteVehicle();
  const [withdrawal, setWithdrawal] = useState<Withdrawal | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [statusError, setStatusError] = useState<string | undefined>(undefined);
  const [deleteError, setDeleteError] = useState<string | undefined>(undefined);

  function applyStatus(next: VehicleStatus) {
    statusChange.mutate(
      { id: vehicleId, status: next },
      {
        onSuccess: () => {
          setWithdrawal(null);
          toast.success(tStatus(`success.${next}`));
        },
        onError: () => {
          const message = tStatus('error');
          if (next === 'ACTIVE') {
            toast.error(message);
            return;
          }
          setStatusError(message);
        },
      },
    );
  }

  return (
    <>
      {children({
        statusItems: (
          <>
            <DropdownMenuLabel>{tStatus('title')}</DropdownMenuLabel>
            <DropdownMenuRadioGroup
              value={status}
              onValueChange={(value) => {
                const next = VEHICLE_STATUSES.find((candidate) => candidate === value);
                if (next === undefined || next === status) {
                  return;
                }
                if (next === 'ACTIVE') {
                  applyStatus(next);
                  return;
                }
                setStatusError(undefined);
                setWithdrawal(next);
              }}
            >
              {VEHICLE_STATUSES.map((option) => (
                <DropdownMenuRadioItem
                  key={option}
                  value={option}
                  disabled={onRent || statusChange.isPending}
                >
                  {tStatus(`options.${option}`)}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
            {onRent && (
              <p className="px-2 pb-2 pt-1 text-xs text-muted-foreground">
                {tStatus('onRentHint')}
              </p>
            )}
          </>
        ),
        deleteItem: (
          <DropdownMenuItem
            destructive
            disabled={onRent || deletion.isPending}
            onSelect={() => {
              setDeleteError(undefined);
              setDeleting(true);
            }}
          >
            <Trash2 aria-hidden="true" />
            {t('delete.action')}
          </DropdownMenuItem>
        ),
      })}
      {withdrawal !== null && (
        <ConfirmDialog
          open
          title={tStatus(`confirmTitle.${withdrawal}`, { name })}
          description={tStatus(`confirmText.${withdrawal}`)}
          confirmLabel={tStatus(`confirm.${withdrawal}`)}
          dismissLabel={tStatus('dismiss')}
          closeLabel={tCommon('close')}
          destructive={withdrawal === 'INACTIVE'}
          pending={statusChange.isPending}
          error={statusError}
          onOpenChange={(open) => {
            if (!open && !statusChange.isPending) {
              setWithdrawal(null);
            }
          }}
          onConfirm={() => {
            applyStatus(withdrawal);
          }}
        />
      )}
      {deleting && (
        <ConfirmDialog
          open
          title={t('delete.title', { name })}
          description={t('delete.text')}
          confirmLabel={t('delete.confirm')}
          dismissLabel={t('delete.dismiss')}
          closeLabel={tCommon('close')}
          destructive
          pending={deletion.isPending}
          error={deleteError}
          onOpenChange={(open) => {
            if (!open && !deletion.isPending) {
              setDeleting(false);
            }
          }}
          onConfirm={() => {
            deletion.mutate(vehicleId, {
              onSuccess: () => {
                setDeleting(false);
                toast.success(t('delete.success', { name }));
              },
              onError: (error) => {
                setDeleteError(
                  error instanceof ApiError && error.detailString('reason') === 'OPEN_BOOKINGS'
                    ? t('delete.blocked')
                    : t('delete.error'),
                );
              },
            });
          }}
        />
      )}
    </>
  );
}
