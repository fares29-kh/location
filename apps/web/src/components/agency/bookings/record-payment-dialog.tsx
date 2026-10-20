'use client';

import {
  millimesToDinarInput,
  PAYMENT_KINDS,
  PAYMENT_METHODS,
  type PaymentKind,
  paymentKindSchema,
  type PaymentMethod,
  paymentMethodSchema,
  parseDinars,
} from '@drivetn/types';
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
import { cn } from '@drivetn/ui/lib/cn';
import { PAYMENT_METHOD_ICONS } from '@drivetn/ui/payment-method-badges';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@drivetn/ui/select';
import { Textarea } from '@drivetn/ui/textarea';
import { toast } from '@drivetn/ui/toaster';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';
import { useId } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';

import { controlProps } from '@/components/auth/control-props';
import { useRecordPayment } from '@/lib/agency/queries';
import type { BookingView } from '@/lib/agency/types';

import { useAgencyFormat } from '../use-agency-format';
import { useValidationMessage } from '../use-validation-message';

const paymentFormSchema = z.object({
  kind: paymentKindSchema,
  method: paymentMethodSchema,
  amount: z
    .string()
    .trim()
    .min(1, { message: 'REQUIRED' })
    .refine((value) => (parseDinars(value) ?? 0) > 0, { message: 'INVALID_AMOUNT' }),
  note: z.string().trim().max(200, { message: 'TOO_LONG' }),
});

type PaymentFormValues = z.input<typeof paymentFormSchema>;

/** Montant proposé selon la nature du mouvement : reste à payer, caution prévue ou détenue. */
function suggestedAmount(booking: BookingView, kind: PaymentKind): number {
  switch (kind) {
    case 'RENTAL':
      return booking.payment.balanceMillimes;
    case 'DEPOSIT_HELD':
      return booking.depositMillimes;
    case 'DEPOSIT_RETURNED':
      return booking.payment.depositHeldMillimes;
    case 'REFUND':
      return booking.payment.paidMillimes;
  }
}

function defaultKind(booking: BookingView): PaymentKind {
  if (booking.payment.balanceMillimes > 0) {
    return 'RENTAL';
  }
  if (booking.status === 'PICKED_UP' && booking.payment.depositHeldMillimes === 0) {
    return 'DEPOSIT_HELD';
  }
  return booking.payment.depositHeldMillimes > 0 ? 'DEPOSIT_RETURNED' : 'RENTAL';
}

function defaults(booking: BookingView): PaymentFormValues {
  const kind = defaultKind(booking);
  const amount = suggestedAmount(booking, kind);
  return {
    kind,
    method: 'CASH',
    amount: amount > 0 ? millimesToDinarInput(amount) : '',
    note: '',
  };
}

/**
 * Déclaration d'un encaissement reçu hors plateforme (aucun paiement en ligne).
 * À monter à l'ouverture : le formulaire repart des montants suggérés à chaque fois.
 */
export function RecordPaymentDialog({
  booking,
  open,
  onOpenChange,
  acceptedMethods = PAYMENT_METHODS,
}: {
  booking: BookingView;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  acceptedMethods?: readonly PaymentMethod[];
}) {
  const t = useTranslations('agency.payments');
  const tMethod = useTranslations('status.paymentMethod');
  const tCommon = useTranslations('common');
  const format = useAgencyFormat();
  const validationMessage = useValidationMessage();
  const id = useId();
  const record = useRecordPayment();
  const form = useForm({
    resolver: zodResolver(paymentFormSchema),
    defaultValues: defaults(booking),
  });
  const { errors } = form.formState;
  const amountError = validationMessage(errors.amount?.message);
  const noteError = validationMessage(errors.note?.message);
  const amountHint = t('amountHint', { balance: format.money(booking.payment.balanceMillimes) });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent closeLabel={tCommon('close')} className="max-w-xl">
        <form
          noValidate
          className="grid gap-5"
          onSubmit={(event) => {
            void form.handleSubmit(async (values) => {
              try {
                await record.mutateAsync({
                  bookingId: booking.id,
                  input: {
                    kind: values.kind,
                    method: values.method,
                    amountMillimes: parseDinars(values.amount) ?? 0,
                    note: values.note.length > 0 ? values.note : undefined,
                  },
                });
                toast.success(t('recorded'));
                onOpenChange(false);
              } catch {
                toast.error(t('recordError'));
              }
            })(event);
          }}
        >
          <DialogHeader>
            <DialogTitle>{t('recordTitle')}</DialogTitle>
            <DialogDescription>
              {t('recordDescription', { reference: booking.reference })}
            </DialogDescription>
          </DialogHeader>

          <fieldset className="grid gap-2">
            <legend className="mb-2 text-sm font-medium">{t('fields.kind')}</legend>
            <Controller
              control={form.control}
              name="kind"
              render={({ field }) => (
                <div className="grid grid-cols-2 gap-2">
                  {PAYMENT_KINDS.map((kind) => {
                    const checked = field.value === kind;
                    return (
                      <label
                        key={kind}
                        className={cn(
                          'grid cursor-pointer gap-0.5 rounded-control border p-3 text-sm transition-colors',
                          'has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring',
                          checked
                            ? 'border-primary bg-primary-soft text-primary-soft-foreground'
                            : 'border-border hover:bg-surface-muted',
                        )}
                      >
                        <input
                          type="radio"
                          name={field.name}
                          value={kind}
                          checked={checked}
                          className="sr-only"
                          onChange={() => {
                            field.onChange(kind);
                            const amount = suggestedAmount(booking, kind);
                            form.setValue('amount', amount > 0 ? millimesToDinarInput(amount) : '');
                          }}
                        />
                        <span className="font-medium">{t(`kinds.${kind}`)}</span>
                        <span className="text-xs opacity-80">{t(`kindHints.${kind}`)}</span>
                      </label>
                    );
                  })}
                </div>
              )}
            />
          </fieldset>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              id={`${id}-amount`}
              label={t('fields.amount')}
              hint={amountHint}
              error={amountError}
            >
              <div className="relative" dir="ltr">
                <Input
                  {...controlProps(`${id}-amount`, { error: amountError, hint: amountHint })}
                  inputMode="decimal"
                  autoComplete="off"
                  className="pe-12 tabular-nums"
                  {...form.register('amount')}
                />
                <span className="pointer-events-none absolute end-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                  {t('currency')}
                </span>
              </div>
            </Field>
            <Field id={`${id}-method`} label={t('fields.method')}>
              <Controller
                control={form.control}
                name="method"
                render={({ field }) => (
                  <Select
                    value={field.value}
                    onValueChange={(value) => {
                      const parsed = paymentMethodSchema.safeParse(value);
                      if (parsed.success) {
                        field.onChange(parsed.data);
                      }
                    }}
                  >
                    <SelectTrigger id={`${id}-method`} onBlur={field.onBlur}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {acceptedMethods.map((method) => {
                        const Icon = PAYMENT_METHOD_ICONS[method];
                        return (
                          <SelectItem key={method} value={method}>
                            <span className="flex items-center gap-2">
                              <Icon className="size-4 text-muted-foreground" aria-hidden="true" />
                              {tMethod(method)}
                            </span>
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>
          </div>

          <Field id={`${id}-note`} label={t('fields.note')} error={noteError}>
            <Textarea
              {...controlProps(`${id}-note`, { error: noteError })}
              rows={2}
              maxLength={200}
              placeholder={t('notePlaceholder')}
              {...form.register('note')}
            />
          </Field>

          <DialogFooter>
            <DialogClose asChild>
              <Button variant="secondary">{tCommon('close')}</Button>
            </DialogClose>
            <Button type="submit" loading={record.isPending}>
              {t('recordSubmit')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
