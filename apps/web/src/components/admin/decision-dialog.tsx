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
import { Textarea } from '@drivetn/ui/textarea';
import { useTranslations } from 'next-intl';
import { type ReactNode, useId, useState } from 'react';

const REASON_MAX_LENGTH = 300;

export interface DecisionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description: ReactNode;
  confirmLabel: string;
  destructive?: boolean;
  /** Motif obligatoire, conservé dans le journal d'audit. */
  requireReason?: boolean;
  /** Motifs fréquents proposés en un clic. */
  quickReasons?: readonly string[];
  pending: boolean;
  onConfirm: (reason?: string) => void;
}

/** Confirmation d'une décision d'administration, avec motif lorsqu'il est exigé. */
export function DecisionDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  destructive = false,
  requireReason = false,
  quickReasons = [],
  pending,
  onConfirm,
}: DecisionDialogProps) {
  const t = useTranslations('admin.common');
  const tCommon = useTranslations('common');
  const id = useId();
  const [reason, setReason] = useState('');
  const [touched, setTouched] = useState(false);
  const reasonError = requireReason && touched && reason.trim().length === 0;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          setReason('');
          setTouched(false);
        }
        onOpenChange(next);
      }}
    >
      <DialogContent closeLabel={tCommon('close')}>
        <form
          className="grid gap-4"
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            setTouched(true);
            if (requireReason && reason.trim().length === 0) {
              return;
            }
            onConfirm(requireReason ? reason.trim() : undefined);
          }}
        >
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>
          {requireReason && (
            <div className="grid gap-3">
              {quickReasons.length > 0 && (
                <div className="flex flex-wrap gap-2" role="group" aria-label={t('quickReasons')}>
                  {quickReasons.map((quickReason) => (
                    <Button
                      key={quickReason}
                      type="button"
                      size="sm"
                      variant="secondary"
                      className="h-auto min-h-8 whitespace-normal rounded-full py-1 text-start"
                      onClick={() => {
                        setReason(quickReason);
                      }}
                    >
                      {quickReason}
                    </Button>
                  ))}
                </div>
              )}
              <Field
                id={`${id}-reason`}
                label={t('reasonLabel')}
                hint={t('reasonHint')}
                error={reasonError ? t('reasonRequired') : undefined}
              >
                <Textarea
                  id={`${id}-reason`}
                  rows={3}
                  maxLength={REASON_MAX_LENGTH}
                  value={reason}
                  aria-invalid={reasonError || undefined}
                  aria-describedby={`${id}-reason-hint${reasonError ? ` ${id}-reason-error` : ''}`}
                  onChange={(event) => {
                    setReason(event.target.value);
                  }}
                />
              </Field>
            </div>
          )}
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="secondary">{t('cancel')}</Button>
            </DialogClose>
            <Button type="submit" variant={destructive ? 'danger' : 'primary'} loading={pending}>
              {confirmLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
