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
import { Field } from '@drivetn/ui/field';
import { Input } from '@drivetn/ui/input';
import { toast } from '@drivetn/ui/toaster';
import { Tooltip, TooltipContent, TooltipTrigger } from '@drivetn/ui/tooltip';
import { Pencil, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { type ReactNode, type SubmitEventHandler, useId } from 'react';
import type { UseFormRegisterReturn } from 'react-hook-form';

import { useValidationMessage } from '@/components/agency/use-validation-message';
import { controlProps } from '@/components/auth/control-props';
import { ApiError } from '@/lib/api/errors';

import { DecisionDialog } from '../decision-dialog';

const LANGUAGES = ['fr', 'ar', 'en'] as const;
type Language = (typeof LANGUAGES)[number];

/** Texte saisi en français, arabe et anglais (nom par défaut, ou description via `labels`). */
export function LocalizedTextFields({
  register,
  errors,
  labels,
}: {
  register: (language: Language) => UseFormRegisterReturn;
  errors: Partial<Record<Language, { message?: string }>> | undefined;
  /** Libellés propres à l'écran ; par défaut « Nom (français) »… */
  labels?: Record<Language, string>;
}) {
  const t = useTranslations('admin.referentials');
  const id = useId();
  const validationMessage = useValidationMessage();
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {LANGUAGES.map((language) => {
        const fieldId = `${id}-${language}`;
        const error = validationMessage(errors?.[language]?.message);
        return (
          <Field
            key={language}
            id={fieldId}
            label={labels?.[language] ?? t(`name.${language}`)}
            error={error}
          >
            <Input
              {...controlProps(fieldId, { error })}
              lang={language}
              dir={language === 'ar' ? 'rtl' : 'ltr'}
              autoComplete="off"
              {...register(language)}
            />
          </Field>
        );
      })}
    </div>
  );
}

/** Fenêtre d'ajout ou de modification d'un élément de référentiel. */
export function ReferentialFormDialog({
  open,
  onOpenChange,
  title,
  description,
  submitLabel,
  pending,
  onSubmit,
  wide = false,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  submitLabel: string;
  pending: boolean;
  onSubmit: SubmitEventHandler<HTMLFormElement>;
  /** Fenêtre élargie pour les saisies en trois langues côte à côte. */
  wide?: boolean;
  children: ReactNode;
}) {
  const t = useTranslations('admin.common');
  const tCommon = useTranslations('common');
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent closeLabel={tCommon('close')} className={wide ? 'max-w-2xl' : undefined}>
        <form className="grid gap-5" noValidate onSubmit={onSubmit}>
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            {description !== undefined && <DialogDescription>{description}</DialogDescription>}
          </DialogHeader>
          {children}
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="secondary">{t('cancel')}</Button>
            </DialogClose>
            <Button type="submit" loading={pending}>
              {submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Boutons « Modifier » et « Supprimer » d'une ligne ; la suppression est bloquée si l'élément sert encore. */
export function RowActions({
  name,
  onEdit,
  onDelete,
  inUse,
}: {
  name: string;
  onEdit: () => void;
  onDelete: () => void;
  inUse: boolean;
}) {
  const t = useTranslations('admin.referentials');
  const deleteButton = (
    <Button
      variant="ghost"
      size="icon-sm"
      // Le bouton reste survolable et focalisable pour expliquer pourquoi il est inactif.
      className="text-danger hover:bg-danger-soft hover:text-danger aria-disabled:pointer-events-auto aria-disabled:cursor-not-allowed"
      aria-label={t('deleteLabel', { name })}
      aria-disabled={inUse || undefined}
      onClick={inUse ? undefined : onDelete}
    >
      <Trash2 aria-hidden="true" />
    </Button>
  );
  return (
    <div className="flex shrink-0 items-center justify-end gap-1">
      <Button variant="ghost" size="icon-sm" aria-label={t('editLabel', { name })} onClick={onEdit}>
        <Pencil aria-hidden="true" />
      </Button>
      {inUse ? (
        <Tooltip>
          <TooltipTrigger asChild>{deleteButton}</TooltipTrigger>
          <TooltipContent>{t('inUseHint')}</TooltipContent>
        </Tooltip>
      ) : (
        deleteButton
      )}
    </div>
  );
}

/** Confirmation de suppression ; un refus « encore utilisé » de l'API est expliqué à l'administrateur. */
export function DeleteReferentialDialog({
  name,
  onClose,
  pending,
  onConfirm,
}: {
  /** Nom de l'élément à supprimer, `null` quand la fenêtre est fermée. */
  name: string | null;
  onClose: () => void;
  pending: boolean;
  onConfirm: () => Promise<unknown>;
}) {
  const t = useTranslations('admin.referentials');
  return (
    <DecisionDialog
      open={name !== null}
      onOpenChange={(open) => {
        if (!open) {
          onClose();
        }
      }}
      title={t('deleteTitle', { name: name ?? '' })}
      description={t('deleteText')}
      confirmLabel={t('delete')}
      destructive
      pending={pending}
      onConfirm={() => {
        void onConfirm().then(
          () => {
            toast.success(t('deleted'));
            onClose();
          },
          (error: unknown) => {
            const inUse = error instanceof ApiError && error.detailString('reason') === 'IN_USE';
            toast.error(inUse ? t('inUseError') : t('deleteError'));
            if (inUse) {
              onClose();
            }
          },
        );
      }}
    />
  );
}
