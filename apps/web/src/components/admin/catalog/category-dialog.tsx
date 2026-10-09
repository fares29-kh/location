'use client';

import {
  type AdminVehicleCategory,
  CATEGORY_POSITION_MAX,
  slugify,
  type VehicleCategoryInput,
  vehicleCategoryInputSchema,
} from '@drivetn/types';
import { Field } from '@drivetn/ui/field';
import { Input } from '@drivetn/ui/input';
import { toast } from '@drivetn/ui/toaster';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';
import { useId } from 'react';
import { type Path, useForm } from 'react-hook-form';

import { applyFieldIssues, useValidationMessage } from '@/components/agency/use-validation-message';
import { controlProps } from '@/components/auth/control-props';
import { useCreateVehicleCategory, useUpdateVehicleCategory } from '@/lib/admin/queries';

import { LocalizedTextFields, ReferentialFormDialog } from '../referentials/referential-ui';

const SERVER_FIELDS: readonly Path<VehicleCategoryInput>[] = [
  'slug',
  'name.fr',
  'name.ar',
  'name.en',
  'description.fr',
  'description.ar',
  'description.en',
  'position',
];

function toFormValues(
  category: AdminVehicleCategory | null,
  nextPosition: number,
): VehicleCategoryInput {
  if (category === null) {
    return {
      slug: '',
      name: { fr: '', ar: '', en: '' },
      description: { fr: '', ar: '', en: '' },
      position: nextPosition,
    };
  }
  return {
    slug: category.slug,
    name: category.name,
    description: category.description,
    position: category.position,
  };
}

/** Ajout (`category` = `null`) ou modification d'une catégorie de véhicules. */
export function CategoryDialog({
  category,
  nextPosition,
  onClose,
}: {
  category: AdminVehicleCategory | null;
  nextPosition: number;
  onClose: () => void;
}) {
  const t = useTranslations('admin.catalog.categories');
  const tRef = useTranslations('admin.referentials');
  const id = useId();
  const validationMessage = useValidationMessage();
  const create = useCreateVehicleCategory();
  const update = useUpdateVehicleCategory();
  const isNew = category === null;
  const form = useForm<VehicleCategoryInput, unknown, VehicleCategoryInput>({
    resolver: zodResolver(vehicleCategoryInputSchema),
    defaultValues: toFormValues(category, nextPosition),
  });
  const { errors } = form.formState;
  const slugError = validationMessage(errors.slug?.message);
  const positionError = validationMessage(errors.position?.message);

  return (
    <ReferentialFormDialog
      open
      wide
      onOpenChange={(open) => {
        if (!open) {
          onClose();
        }
      }}
      title={isNew ? t('createTitle') : t('editTitle')}
      submitLabel={isNew ? tRef('create') : tRef('save')}
      pending={create.isPending || update.isPending}
      onSubmit={(event) => {
        void form.handleSubmit(async ({ slug, ...input }) => {
          try {
            if (isNew) {
              await create.mutateAsync({ slug, ...input });
            } else {
              await update.mutateAsync({ id: category.id, input });
            }
            toast.success(isNew ? tRef('created') : tRef('saved'));
            onClose();
          } catch (error) {
            if (!applyFieldIssues(error, form.setError, SERVER_FIELDS)) {
              toast.error(tRef('saveError'));
            }
          }
        })(event);
      }}
    >
      <LocalizedTextFields
        register={(language) =>
          form.register(`name.${language}`, {
            onChange: (event: { target: { value: string } }) => {
              if (isNew && language === 'fr' && !form.getFieldState('slug').isDirty) {
                form.setValue('slug', slugify(event.target.value));
              }
            },
          })
        }
        errors={errors.name}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          id={`${id}-slug`}
          label={t('slug')}
          hint={isNew ? t('slugHint') : t('slugLocked')}
          error={slugError}
        >
          <Input
            {...controlProps(`${id}-slug`, { error: slugError, hint: t('slugHint') })}
            dir="ltr"
            autoComplete="off"
            readOnly={!isNew}
            className={isNew ? undefined : 'bg-surface-muted text-muted-foreground'}
            {...form.register('slug')}
          />
        </Field>
        <Field
          id={`${id}-position`}
          label={t('position')}
          hint={t('positionHint')}
          error={positionError}
        >
          <Input
            {...controlProps(`${id}-position`, { error: positionError, hint: t('positionHint') })}
            type="number"
            inputMode="numeric"
            min={0}
            max={CATEGORY_POSITION_MAX}
            dir="ltr"
            {...form.register('position', { valueAsNumber: true })}
          />
        </Field>
      </div>
      <LocalizedTextFields
        register={(language) => form.register(`description.${language}`)}
        errors={errors.description}
        labels={{ fr: t('description.fr'), ar: t('description.ar'), en: t('description.en') }}
      />
    </ReferentialFormDialog>
  );
}
