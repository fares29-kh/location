'use client';

import {
  type AdminVehicleBrand,
  type AdminVehicleModel,
  VEHICLE_MODEL_MAX,
  type VehicleModelUpdate,
  vehicleModelUpdateSchema,
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
import { useCreateVehicleModel, useUpdateVehicleModel } from '@/lib/admin/queries';

import { ReferentialFormDialog } from '../referentials/referential-ui';

/** Ajout (`model` = `null`) ou renommage d'un modèle de la marque `brand`. */
export function ModelDialog({
  brand,
  model,
  onClose,
}: {
  brand: AdminVehicleBrand;
  model: AdminVehicleModel | null;
  onClose: () => void;
}) {
  const t = useTranslations('admin.catalog.models');
  const tRef = useTranslations('admin.referentials');
  const id = useId();
  const validationMessage = useValidationMessage();
  const create = useCreateVehicleModel();
  const update = useUpdateVehicleModel();
  const isNew = model === null;
  const form = useForm<VehicleModelUpdate, unknown, VehicleModelUpdate>({
    resolver: zodResolver(vehicleModelUpdateSchema),
    defaultValues: { name: model?.name ?? '' },
  });
  const nameError = validationMessage(form.formState.errors.name?.message);
  const hint =
    !isNew && model.vehiclesCount > 0 ? t('renameHint', { count: model.vehiclesCount }) : undefined;

  return (
    <ReferentialFormDialog
      open
      onOpenChange={(open) => {
        if (!open) {
          onClose();
        }
      }}
      title={isNew ? t('createTitle') : t('editTitle')}
      description={t('context', { brand: brand.name })}
      submitLabel={isNew ? tRef('create') : tRef('save')}
      pending={create.isPending || update.isPending}
      onSubmit={(event) => {
        void form.handleSubmit(async (input) => {
          try {
            if (isNew) {
              await create.mutateAsync({ brandId: brand.id, ...input });
            } else {
              await update.mutateAsync({ id: model.id, input });
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
          placeholder={t('namePlaceholder')}
          maxLength={VEHICLE_MODEL_MAX}
          {...form.register('name')}
        />
      </Field>
    </ReferentialFormDialog>
  );
}
