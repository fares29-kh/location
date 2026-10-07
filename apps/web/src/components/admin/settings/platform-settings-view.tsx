'use client';

import {
  bpsToPercentInput,
  COMMISSION_MAX_BPS,
  computeInvoiceTotals,
  emailSchema,
  FISCAL_STAMP_MAX_MILLIMES,
  millimesToDinarInput,
  parseDinars,
  parsePercentToBps,
  type PlatformSettings,
  SUBSCRIPTION_PLAN_DEFINITIONS,
  tunisianPhoneSchema,
  VAT_RATE_MAX_BPS,
} from '@drivetn/types';
import { Alert } from '@drivetn/ui/alert';
import { Button } from '@drivetn/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@drivetn/ui/card';
import { Field } from '@drivetn/ui/field';
import { Input } from '@drivetn/ui/input';
import { cn } from '@drivetn/ui/lib/cn';
import { PhoneInput } from '@drivetn/ui/phone-input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@drivetn/ui/select';
import { Skeleton } from '@drivetn/ui/skeleton';
import { toast } from '@drivetn/ui/toaster';
import { zodResolver } from '@hookform/resolvers/zod';
import { useLocale, useTranslations } from 'next-intl';
import { useId, useMemo } from 'react';
import { Controller, type UseFormReturn, useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';

import { PageHeader } from '@/components/agency/page-header';
import { QueryError } from '@/components/agency/query-states';
import { useAgencyFormat } from '@/components/agency/use-agency-format';
import { useValidationMessage } from '@/components/agency/use-validation-message';
import { controlProps } from '@/components/auth/control-props';
import { usePlatformSettings, useUpdatePlatformSettings } from '@/lib/admin/queries';

import { useAdminPermission } from '../admin-session';
import { PlanTag } from '../status-tags';

const EXPIRY_OPTIONS = [6, 12, 24, 48, 72] as const;
const PREVIEW_PLAN = 'PRO';

function percentField(maxBps: number) {
  return z.string().refine(
    (value) => {
      const bps = parsePercentToBps(value);
      return bps !== null && bps <= maxBps;
    },
    { message: 'OUT_OF_RANGE' },
  );
}

const settingsFormSchema = z.object({
  vatRate: percentField(VAT_RATE_MAX_BPS),
  fiscalStamp: z.string().refine(
    (value) => {
      const millimes = parseDinars(value);
      return millimes !== null && millimes <= FISCAL_STAMP_MAX_MILLIMES;
    },
    { message: 'INVALID_AMOUNT' },
  ),
  defaultCommission: percentField(COMMISSION_MAX_BPS),
  bookingExpiryHours: z.number().int(),
  supportPhone: tunisianPhoneSchema,
  supportEmail: z
    .string()
    .trim()
    .refine((value) => emailSchema.safeParse(value).success, { message: 'INVALID_EMAIL' }),
});
type SettingsFormValues = z.input<typeof settingsFormSchema>;
type SettingsFormOutput = z.output<typeof settingsFormSchema>;
type SettingsForm = UseFormReturn<SettingsFormValues, unknown, SettingsFormOutput>;

function useDecimalSeparator(): string {
  const locale = useLocale();
  return useMemo(
    () =>
      new Intl.NumberFormat(`${locale}-TN-u-nu-latn`)
        .formatToParts(1.5)
        .find((part) => part.type === 'decimal')?.value ?? '.',
    [locale],
  );
}

function toFormValues(settings: PlatformSettings, decimalSeparator: string): SettingsFormValues {
  const localize = (value: string) => value.replace('.', decimalSeparator);
  return {
    vatRate: localize(bpsToPercentInput(settings.vatRateBps)),
    fiscalStamp: localize(millimesToDinarInput(settings.fiscalStampMillimes)),
    defaultCommission: localize(bpsToPercentInput(settings.defaultCommissionBps)),
    bookingExpiryHours: settings.bookingExpiryHours,
    supportPhone: settings.supportPhone,
    supportEmail: settings.supportEmail,
  };
}

function toSettings(values: SettingsFormOutput): PlatformSettings {
  return {
    vatRateBps: parsePercentToBps(values.vatRate) ?? 0,
    fiscalStampMillimes: parseDinars(values.fiscalStamp) ?? 0,
    defaultCommissionBps: parsePercentToBps(values.defaultCommission) ?? 0,
    bookingExpiryHours: values.bookingExpiryHours,
    supportPhone: values.supportPhone,
    supportEmail: values.supportEmail,
  };
}

function UnitInput({
  form,
  name,
  label,
  hint,
  unit,
}: {
  form: SettingsForm;
  name: 'vatRate' | 'fiscalStamp' | 'defaultCommission';
  label: string;
  hint: string;
  unit: string;
}) {
  const id = useId();
  const validationMessage = useValidationMessage();
  const message = validationMessage(form.formState.errors[name]?.message);
  return (
    <Field id={id} label={label} hint={hint} error={message}>
      <div className="relative">
        <Input
          {...controlProps(id, { error: message, hint })}
          inputMode="decimal"
          dir="ltr"
          className="pe-12 text-end tabular-nums rtl:text-start"
          {...form.register(name)}
        />
        <span className="pointer-events-none absolute inset-y-0 end-3 flex items-center text-sm text-muted-foreground">
          {unit}
        </span>
      </div>
    </Field>
  );
}

function InvoicePreview({ form }: { form: SettingsForm }) {
  const t = useTranslations('admin.settings.preview');
  const format = useAgencyFormat();
  const [vatRate, fiscalStamp] = useWatch({
    control: form.control,
    name: ['vatRate', 'fiscalStamp'],
  });
  const vatRateBps = parsePercentToBps(vatRate);
  const stamp = parseDinars(fiscalStamp);
  const subtotal = SUBSCRIPTION_PLAN_DEFINITIONS[PREVIEW_PLAN].monthlyPriceMillimes;

  return (
    <Card className="lg:sticky lg:top-24">
      <CardHeader className="pb-4">
        <CardTitle className="text-base">{t('title')}</CardTitle>
        <CardDescription className="flex items-center gap-2">
          {t('subtitle')} <PlanTag plan={PREVIEW_PLAN} />
        </CardDescription>
      </CardHeader>
      <CardContent>
        {vatRateBps === null || stamp === null ? (
          <p className="text-sm text-muted-foreground">{t('invalid')}</p>
        ) : (
          <InvoiceLines
            totals={computeInvoiceTotals({
              subtotalMillimes: subtotal,
              vatRateBps,
              fiscalStampMillimes: stamp,
            })}
            vatLabel={t('vat', { rate: format.percent(vatRateBps / 10_000) })}
          />
        )}
      </CardContent>
    </Card>
  );
}

function InvoiceLines({
  totals,
  vatLabel,
}: {
  totals: ReturnType<typeof computeInvoiceTotals>;
  vatLabel: string;
}) {
  const t = useTranslations('admin.settings.preview');
  const format = useAgencyFormat();
  const rows = [
    [t('subtotal'), totals.subtotalMillimes],
    [vatLabel, totals.vatMillimes],
    [t('fiscalStamp'), totals.fiscalStampMillimes],
  ] as const;
  return (
    <dl className="grid gap-2 text-sm">
      {rows.map(([label, value]) => (
        <div key={label} className="flex justify-between gap-4">
          <dt className="text-muted-foreground">{label}</dt>
          <dd className="tabular-nums">{format.money(value)}</dd>
        </div>
      ))}
      <div className="flex justify-between gap-4 border-t border-border pt-2 text-base font-bold">
        <dt>{t('total')}</dt>
        <dd className="tabular-nums">{format.money(totals.totalMillimes)}</dd>
      </div>
    </dl>
  );
}

function SettingsFormView({ settings }: { settings: PlatformSettings }) {
  const t = useTranslations('admin.settings');
  const id = useId();
  const canEdit = useAdminPermission('settings.manage');
  const validationMessage = useValidationMessage();
  const mutation = useUpdatePlatformSettings();
  const decimalSeparator = useDecimalSeparator();
  const form: SettingsForm = useForm<SettingsFormValues, unknown, SettingsFormOutput>({
    resolver: zodResolver(settingsFormSchema),
    defaultValues: toFormValues(settings, decimalSeparator),
  });
  const { errors, isDirty } = form.formState;
  const phoneError = validationMessage(errors.supportPhone?.message);
  const emailError = validationMessage(errors.supportEmail?.message);

  return (
    <form
      noValidate
      className="grid gap-6"
      onSubmit={(event) => {
        void form.handleSubmit(async (values) => {
          try {
            const saved = await mutation.mutateAsync(toSettings(values));
            form.reset(toFormValues(saved, decimalSeparator));
            toast.success(t('saved'));
          } catch {
            toast.error(t('saveError'));
          }
        })(event);
      }}
    >
      {!canEdit && (
        <Alert tone="info" title={t('readOnlyTitle')}>
          {t('readOnlyText')}
        </Alert>
      )}
      <div className="grid items-start gap-6 lg:grid-cols-3">
        <fieldset disabled={!canEdit} className="grid min-w-0 gap-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>{t('tax.title')}</CardTitle>
              <CardDescription>{t('tax.text')}</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <UnitInput
                form={form}
                name="vatRate"
                label={t('tax.vat')}
                hint={t('tax.vatHint')}
                unit="%"
              />
              <UnitInput
                form={form}
                name="fiscalStamp"
                label={t('tax.stamp')}
                hint={t('tax.stampHint')}
                unit={t('currency')}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t('business.title')}</CardTitle>
              <CardDescription>{t('business.text')}</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <UnitInput
                form={form}
                name="defaultCommission"
                label={t('business.commission')}
                hint={t('business.commissionHint')}
                unit="%"
              />
              <Field
                id={`${id}-expiry`}
                label={t('business.expiry')}
                hint={t('business.expiryHint')}
              >
                <Controller
                  control={form.control}
                  name="bookingExpiryHours"
                  render={({ field }) => (
                    <Select
                      value={String(field.value)}
                      onValueChange={(value) => {
                        field.onChange(Number(value));
                      }}
                      disabled={!canEdit}
                    >
                      <SelectTrigger
                        {...controlProps(`${id}-expiry`, { hint: t('business.expiryHint') })}
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {EXPIRY_OPTIONS.map((hours) => (
                          <SelectItem key={hours} value={String(hours)}>
                            {t('business.hours', { count: hours })}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </Field>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t('support.title')}</CardTitle>
              <CardDescription>{t('support.text')}</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <Field id={`${id}-phone`} label={t('support.phone')} error={phoneError}>
                <Controller
                  control={form.control}
                  name="supportPhone"
                  render={({ field }) => (
                    <PhoneInput
                      {...controlProps(`${id}-phone`, { error: phoneError })}
                      value={field.value}
                      onValueChange={field.onChange}
                      onBlur={field.onBlur}
                      name={field.name}
                    />
                  )}
                />
              </Field>
              <Field id={`${id}-email`} label={t('support.email')} error={emailError}>
                <Input
                  {...controlProps(`${id}-email`, { error: emailError })}
                  type="email"
                  dir="ltr"
                  autoComplete="email"
                  {...form.register('supportEmail')}
                />
              </Field>
            </CardContent>
          </Card>
        </fieldset>

        <InvoicePreview form={form} />
      </div>

      <div
        className={cn(
          'sticky bottom-4 z-10 flex flex-wrap items-center justify-between gap-3 rounded-card border border-border bg-surface/95 px-4 py-3 shadow-elevated backdrop-blur transition-all',
          !isDirty && 'pointer-events-none translate-y-2 opacity-0',
        )}
        inert={!isDirty}
      >
        <p className="text-sm font-medium">{t('unsaved')}</p>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              form.reset(toFormValues(settings, decimalSeparator));
            }}
          >
            {t('discard')}
          </Button>
          <Button type="submit" size="sm" loading={mutation.isPending}>
            {t('save')}
          </Button>
        </div>
      </div>
    </form>
  );
}

export function PlatformSettingsView() {
  const t = useTranslations('admin.settings');
  const { data, isPending, isError, error, refetch, isFetching } = usePlatformSettings();

  return (
    <div className="grid gap-6">
      <PageHeader title={t('title')} description={t('subtitle')} />
      {isPending ? (
        <div className="grid gap-6 lg:grid-cols-3" aria-hidden="true">
          <div className="grid gap-6 lg:col-span-2">
            <Skeleton className="h-48 rounded-card" />
            <Skeleton className="h-48 rounded-card" />
          </div>
          <Skeleton className="h-64 rounded-card" />
        </div>
      ) : isError ? (
        <QueryError error={error} onRetry={() => void refetch()} retrying={isFetching} />
      ) : (
        <SettingsFormView settings={data} />
      )}
    </div>
  );
}
