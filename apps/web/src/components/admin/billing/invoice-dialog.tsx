'use client';

import type { PaymentMethod } from '@drivetn/types';
import { Button } from '@drivetn/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@drivetn/ui/dialog';
import { Field } from '@drivetn/ui/field';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@drivetn/ui/select';
import { toast } from '@drivetn/ui/toaster';
import { BellRing, CircleCheck, Printer } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useId, useState } from 'react';

import { useAgencyFormat } from '@/components/agency/use-agency-format';
import { useInvoiceReminder, useMarkInvoicePaid } from '@/lib/admin/queries';
import type { Invoice } from '@/lib/admin/types';

import { useAdminPermission } from '../admin-session';
import { InvoiceStatusTag, PlanTag } from '../status-tags';

const INVOICE_PAYMENT_METHODS = ['BANK_TRANSFER', 'CHECK', 'CASH', 'CARD_TPE'] as const;

function Line({
  label,
  value,
  strong = false,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div
      className={
        strong
          ? 'flex justify-between gap-4 pt-2 text-base font-bold'
          : 'flex justify-between gap-4'
      }
    >
      <dt className={strong ? undefined : 'text-muted-foreground'}>{label}</dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
  );
}

function PaymentForm({ invoice, onDone }: { invoice: Invoice; onDone: () => void }) {
  const t = useTranslations('admin.billing.invoice');
  const tMethod = useTranslations('status.paymentMethod');
  const id = useId();
  const [method, setMethod] = useState<PaymentMethod>('BANK_TRANSFER');
  const markPaid = useMarkInvoicePaid();
  const reminder = useInvoiceReminder();
  const format = useAgencyFormat();

  return (
    <div className="grid gap-4 rounded-control border border-border p-4">
      <div className="flex flex-wrap items-end gap-3">
        <Field id={`${id}-method`} label={t('method')} className="min-w-48 flex-1">
          <Select
            value={method}
            onValueChange={(value) => {
              setMethod(value as PaymentMethod);
            }}
          >
            <SelectTrigger id={`${id}-method`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {INVOICE_PAYMENT_METHODS.map((value) => (
                <SelectItem key={value} value={value}>
                  {tMethod(value)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Button
          loading={markPaid.isPending}
          disabled={reminder.isPending}
          onClick={() => {
            markPaid.mutate(
              { id: invoice.id, method },
              {
                onSuccess: () => {
                  toast.success(t('paidSuccess', { number: invoice.number }));
                  onDone();
                },
                onError: () => {
                  toast.error(t('error'));
                },
              },
            );
          }}
        >
          <CircleCheck aria-hidden="true" />
          {t('markPaid')}
        </Button>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3 text-sm">
        <span className="text-muted-foreground">
          {invoice.remindedAt === null
            ? t('noReminder')
            : t('remindedAt', { date: format.relative(invoice.remindedAt) })}
        </span>
        <Button
          variant="ghost"
          size="sm"
          loading={reminder.isPending}
          disabled={markPaid.isPending}
          onClick={() => {
            reminder.mutate(invoice.id, {
              onSuccess: () => {
                toast.success(t('reminderSuccess', { name: invoice.agency.name }));
              },
              onError: () => {
                toast.error(t('error'));
              },
            });
          }}
        >
          <BellRing aria-hidden="true" />
          {t('sendReminder')}
        </Button>
      </div>
    </div>
  );
}

/** Détail d'une facture d'abonnement : HT, TVA, timbre fiscal, TTC et encaissement. */
export function InvoiceDialog({
  invoice,
  onClose,
}: {
  invoice: Invoice | null;
  onClose: () => void;
}) {
  const t = useTranslations('admin.billing.invoice');
  const tCommon = useTranslations('common');
  const tMethod = useTranslations('status.paymentMethod');
  const format = useAgencyFormat();
  const canManage = useAdminPermission('billing.manage');
  // Garde la dernière facture affichée pendant l'animation de fermeture.
  const [shown, setShown] = useState(invoice);
  if (invoice !== null && invoice !== shown) {
    setShown(invoice);
  }

  return (
    <Dialog
      open={invoice !== null}
      onOpenChange={(open) => {
        if (!open) {
          onClose();
        }
      }}
    >
      <DialogContent closeLabel={tCommon('close')} className="max-w-lg">
        {shown !== null && (
          <>
            <DialogHeader>
              <DialogTitle className="flex flex-wrap items-center gap-2">
                <span className="font-mono">{shown.number}</span>
                <InvoiceStatusTag status={shown.status} />
              </DialogTitle>
              <DialogDescription>
                {t('description', {
                  agency: shown.agency.name,
                  period: format.monthLong(`${shown.period}-15T12:00:00Z`),
                })}
              </DialogDescription>
            </DialogHeader>

            <dl className="grid grid-cols-2 gap-3 rounded-control bg-surface-muted p-4 text-sm">
              <div className="grid gap-0.5">
                <dt className="text-xs text-muted-foreground">{t('issuedAt')}</dt>
                <dd className="tabular-nums">{format.date(shown.issuedAt)}</dd>
              </div>
              <div className="grid gap-0.5">
                <dt className="text-xs text-muted-foreground">{t('dueAt')}</dt>
                <dd
                  className={
                    shown.status === 'OVERDUE'
                      ? 'font-medium text-danger tabular-nums'
                      : 'tabular-nums'
                  }
                >
                  {format.date(shown.dueAt)}
                </dd>
              </div>
              {shown.paidAt !== null && (
                <div className="col-span-2 grid gap-0.5">
                  <dt className="text-xs text-muted-foreground">{t('paidAt')}</dt>
                  <dd>
                    {format.date(shown.paidAt)}
                    {shown.paymentMethod !== null && ` · ${tMethod(shown.paymentMethod)}`}
                  </dd>
                </div>
              )}
            </dl>

            <dl className="grid gap-2 text-sm">
              <div className="flex items-center justify-between gap-4">
                <dt className="flex items-center gap-2 text-muted-foreground">
                  {t('subscription')}
                  <PlanTag plan={shown.plan} />
                </dt>
                <dd className="tabular-nums">{format.money(shown.subscriptionMillimes)}</dd>
              </div>
              {shown.commissionMillimes > 0 && (
                <Line label={t('commission')} value={format.money(shown.commissionMillimes)} />
              )}
              <div className="my-1 border-t border-dashed border-border" />
              <Line label={t('subtotal')} value={format.money(shown.subtotalMillimes)} />
              <Line
                label={t('vat', { rate: format.percent(shown.vatRateBps / 10_000) })}
                value={format.money(shown.vatMillimes)}
              />
              <Line label={t('fiscalStamp')} value={format.money(shown.fiscalStampMillimes)} />
              <div className="border-t border-border" />
              <Line label={t('total')} value={format.money(shown.totalMillimes)} strong />
            </dl>

            {shown.status !== 'PAID' && canManage && (
              <PaymentForm invoice={shown} onDone={onClose} />
            )}

            <DialogFooter>
              <Button
                variant="secondary"
                onClick={() => {
                  window.print();
                }}
              >
                <Printer aria-hidden="true" />
                {t('print')}
              </Button>
              <Button variant="ghost" onClick={onClose}>
                {tCommon('close')}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
