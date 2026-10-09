'use client';

import {
  type AdminGovernorate,
  delegationUpdateSchema,
  type GovernorateInput,
  governorateInputSchema,
  type LocalizedText,
  slugify,
} from '@drivetn/types';
import { Field } from '@drivetn/ui/field';
import { Input } from '@drivetn/ui/input';
import { toast } from '@drivetn/ui/toaster';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';
import { type ReactNode, useId } from 'react';
import { type Path, useForm } from 'react-hook-form';

import { applyFieldIssues, useValidationMessage } from '@/components/agency/use-validation-message';
import { controlProps } from '@/components/auth/control-props';
import { useCreateGovernorate, useUpdateGovernorate } from '@/lib/admin/queries';

import { LocalizedTextFields, ReferentialFormDialog } from '../referentials/referential-ui';

const EMPTY_NAME: LocalizedText = { fr: '', ar: '', en: '' };

const GOVERNORATE_FIELDS: readonly Path<GovernorateInput>[] = [
  'code',
  'slug',
  'name.fr',
  'name.ar',
  'name.en',
];

/** Ajout (`governorate` = `null`) ou modification d'un gouvernorat ; le code est figé après la création. */
export function GovernorateDialog({
  governorate,
  onClose,
}: {
  governorate: AdminGovernorate | null;
  onClose: () => void;
}) {
  const t = useTranslations('admin.geography.governorates');
  const tRef = useTranslations('admin.referentials');
  const id = useId();
  const validationMessage = useValidationMessage();
  const create = useCreateGovernorate();
  const update = useUpdateGovernorate();
  const isNew = governorate === null;
  const form = useForm<GovernorateInput, unknown, GovernorateInput>({
    resolver: zodResolver(governorateInputSchema),
    defaultValues: {
      code: governorate?.code ?? '',
      slug: governorate?.slug ?? '',
      name: governorate?.name ?? EMPTY_NAME,
    },
  });
  const { errors } = form.formState;
  const codeError = validationMessage(errors.code?.message);
  const slugError = validationMessage(errors.slug?.message);

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
        void form.handleSubmit(async ({ code, ...input }) => {
          try {
            if (isNew) {
              await create.mutateAsync({ code, ...input });
            } else {
              await update.mutateAsync({ code: governorate.code, input });
            }
            toast.success(isNew ? tRef('created') : tRef('saved'));
            onClose();
          } catch (error) {
            if (!applyFieldIssues(error, form.setError, GOVERNORATE_FIELDS)) {
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
          id={`${id}-code`}
          label={t('code')}
          hint={isNew ? t('codeHint') : t('codeLocked')}
          error={codeError}
        >
          <Input
            {...controlProps(`${id}-code`, { error: codeError, hint: t('codeHint') })}
            inputMode="numeric"
            maxLength={2}
            dir="ltr"
            autoComplete="off"
            readOnly={!isNew}
            className={isNew ? undefined : 'bg-surface-muted text-muted-foreground'}
            {...form.register('code')}
          />
        </Field>
        <Field id={`${id}-slug`} label={t('slug')} hint={t('slugHint')} error={slugError}>
          <Input
            {...controlProps(`${id}-slug`, { error: slugError, hint: t('slugHint') })}
            dir="ltr"
            autoComplete="off"
            {...form.register('slug')}
          />
        </Field>
      </div>
    </ReferentialFormDialog>
  );
}

interface NameForm {
  name: LocalizedText;
}
const NAME_FIELDS: readonly Path<NameForm>[] = ['name.fr', 'name.ar', 'name.en'];

/** Ajout ou renommage d'une délégation ou d'une municipalité (seul le nom est saisi). */
export function PlaceNameDialog({
  title,
  description,
  isNew,
  defaultName,
  pending,
  onSave,
  onClose,
}: {
  title: string;
  description: ReactNode;
  isNew: boolean;
  defaultName: LocalizedText | null;
  pending: boolean;
  onSave: (name: LocalizedText) => Promise<unknown>;
  onClose: () => void;
}) {
  const tRef = useTranslations('admin.referentials');
  const form = useForm<NameForm, unknown, NameForm>({
    resolver: zodResolver(delegationUpdateSchema),
    defaultValues: { name: defaultName ?? EMPTY_NAME },
  });

  return (
    <ReferentialFormDialog
      open
      wide
      onOpenChange={(open) => {
        if (!open) {
          onClose();
        }
      }}
      title={title}
      description={description}
      submitLabel={isNew ? tRef('create') : tRef('save')}
      pending={pending}
      onSubmit={(event) => {
        void form.handleSubmit(async ({ name }) => {
          try {
            await onSave(name);
            toast.success(isNew ? tRef('created') : tRef('saved'));
            onClose();
          } catch (error) {
            if (!applyFieldIssues(error, form.setError, NAME_FIELDS)) {
              toast.error(tRef('saveError'));
            }
          }
        })(event);
      }}
    >
      <LocalizedTextFields
        register={(language) => form.register(`name.${language}`)}
        errors={form.formState.errors.name}
      />
    </ReferentialFormDialog>
  );
}
