'use client';

import {
  type AdminVehicleBrand,
  VEHICLE_BRAND_MAX,
  type VehicleBrandInput,
  vehicleBrandInputSchema,
} from '@drivetn/types';
import { Field } from '@drivetn/ui/field';
import { Input } from '@drivetn/ui/input';
import { toast } from '@drivetn/ui/toaster';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';
import { useId } from 'react';
import { useForm } from 'react-hook-form';

import { applyFieldIssues, useValidationMessage } from '@/components/agency/use-validation-message';
import { controlProps } from '@/components/auth/control-props';
import { useCreateVehicleBrand, useUpdateVehicleBrand } from '@/lib/admin/queries';

import { ReferentialFormDialog } from '../referentials/referential-ui';

/** Ajout (`brand` = `null`) ou renommage d'une marque. */
export function BrandDialog({
  brand,
  onClose,
}: {
  brand: AdminVehicleBrand | null;
  onClose: () => void;
}) {
  const t = useTranslations('admin.catalog.brands');
  const tRef = useTranslations('admin.referentials');
  const id = useId();
  const validationMessage = useValidationMessage();
  const create = useCreateVehicleBrand();
  const update = useUpdateVehicleBrand();
  const isNew = brand === null;
  const form = useForm<VehicleBrandInput, unknown, VehicleBrandInput>({
    resolver: zodResolver(vehicleBrandInputSchema),
    defaultValues: { name: brand?.name ?? '' },
  });
  const nameError = validationMessage(form.formState.errors.name?.message);
  const hint =
    !isNew && brand.vehiclesCount > 0 ? t('renameHint', { count: brand.vehiclesCount }) : undefined;

  return (
    <ReferentialFormDialog
      open
      onOpenChange={(open) => {
        if (!open) {
          onClose();
        }
      }}
      title={isNew ? t('createTitle') : t('editTitle')}
      submitLabel={isNew ? tRef('create') : tRef('save')}
      pending={create.isPending || update.isPending}
      onSubmit={(event) => {
        void form.handleSubmit(async (input) => {
          try {
            if (isNew) {
              await create.mutateAsync(input);
            } else {
              await update.mutateAsync({ id: brand.id, input });
            }
            toast.success(isNew ? tRef('created') : tRef('saved'));
            onClose();
          } catch (error) {
            if (!applyFieldIssues(error, form.setError, ['name'])) {
              toast.error(tRef('saveError'));
            }
          }
        })(event);
      }}
    >
      <Field id={`${id}-name`} label={t('name')} hint={hint} error={nameError}>
        <Input
          {...controlProps(`${id}-name`, { error: nameError, hint })}
          autoComplete="off"
          maxLength={VEHICLE_BRAND_MAX}
          {...form.register('name')}
        />
      </Field>
    </ReferentialFormDialog>
  );
}
