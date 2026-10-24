'use client';

import {
  agencyProfileSchema,
  AGENCY_EXTRA_PHONES_MAX,
  CANCELLATION_HOURS_MAX,
  type ChangePasswordInput,
  changePasswordSchema,
  DRIVER_AGE_MAX,
  DRIVER_AGE_MIN,
  emailSchema,
  type Governorate,
  LICENSE_YEARS_MAX,
  PAYMENT_METHODS,
  type PaymentMethod,
  pickLocalized,
  type RentalConditions,
  rentalConditionsSchema,
} from '@drivetn/types';
import { Button } from '@drivetn/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@drivetn/ui/card';
import { Checkbox } from '@drivetn/ui/checkbox';
import { Field } from '@drivetn/ui/field';
import { Input } from '@drivetn/ui/input';
import { cn } from '@drivetn/ui/lib/cn';
import { PAYMENT_METHOD_ICONS, PaymentMethodBadges } from '@drivetn/ui/payment-method-badges';
import { PhoneInput } from '@drivetn/ui/phone-input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@drivetn/ui/select';
import { Skeleton } from '@drivetn/ui/skeleton';
import { Switch } from '@drivetn/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@drivetn/ui/tabs';
import { Textarea } from '@drivetn/ui/textarea';
import { toast } from '@drivetn/ui/toaster';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { Building2, KeyRound, Mail, MapPin, Phone, Plus, ShieldCheck, X, Zap } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useId } from 'react';
import { Controller, type UseFormReturn, useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';

import { AgencyLogo } from '@/components/agencies/agency-logo';
import { controlProps } from '@/components/auth/control-props';
import { displayPhone } from '@/components/auth/otp-step';
import { PasswordInput } from '@/components/auth/password-input';
import { applyServerIssues, useAuthMessages } from '@/components/auth/use-auth-messages';
import { ApiError } from '@/lib/api/errors';
import { usersApi } from '@/lib/api/auth';
import { useAgencySettings, useUpdateConditions, useUpdateProfile } from '@/lib/agency/queries';
import type { AgencySettings } from '@/lib/agency/types';

import { PageHeader } from '../page-header';
import { QueryError } from '../query-states';
import { useAgencyFormat } from '../use-agency-format';
import { useUrlState } from '../use-url-state';
import { useValidationMessage } from '../use-validation-message';
import { LocationPicker } from './location-picker';
import { LogoField } from './logo-field';

const DESCRIPTION_MAX_LENGTH = 600;
const CANCELLATION_OPTIONS = [0, 12, 24, 48, 72, CANCELLATION_HOURS_MAX] as const;
const SETTINGS_TABS = ['profile', 'conditions', 'security'] as const;
const URL_DEFAULTS = { tab: 'profile' };

function isValidParam(_key: keyof typeof URL_DEFAULTS, value: string): boolean {
  return (SETTINGS_TABS as readonly string[]).includes(value);
}

function range(from: number, to: number): number[] {
  return Array.from({ length: to - from + 1 }, (_, index) => from + index);
}

/** Variante du schéma partagé dont l'erreur d'email reste un code traduisible. */
const profileFormSchema = agencyProfileSchema.extend({
  email: z
    .string()
    .trim()
    .refine((value) => value === '' || emailSchema.safeParse(value).success, {
      message: 'INVALID_EMAIL',
    }),
});
type ProfileFormValues = z.input<typeof profileFormSchema>;
type ProfileFormOutput = z.output<typeof profileFormSchema>;

function SaveBar({
  dirty,
  saving,
  onReset,
}: {
  dirty: boolean;
  saving: boolean;
  onReset: () => void;
}) {
  const t = useTranslations('agency.settings');
  return (
    <div
      className={cn(
        'sticky bottom-4 z-10 flex flex-wrap items-center justify-between gap-3 rounded-card border border-border bg-surface/95 px-4 py-3 shadow-elevated backdrop-blur transition-all',
        !dirty && 'pointer-events-none translate-y-2 opacity-0',
      )}
      inert={!dirty}
    >
      <p className="text-sm font-medium">{t('unsaved')}</p>
      <div className="flex gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onReset}>
          {t('discard')}
        </Button>
        <Button type="submit" size="sm" loading={saving}>
          {t('save')}
        </Button>
      </div>
    </div>
  );
}

function ProfileForm({
  governorates,
  logoUrl,
  form,
}: {
  governorates: Governorate[];
  logoUrl: string | null;
  form: UseFormReturn<ProfileFormValues, unknown, ProfileFormOutput>;
}) {
  const t = useTranslations('agency.settings.profile');
  const format = useAgencyFormat();
  const validationMessage = useValidationMessage();
  const id = useId();
  const mutation = useUpdateProfile();
  const { errors, isDirty } = form.formState;
  const description = useWatch({ control: form.control, name: 'description' });
  const phone = useWatch({ control: form.control, name: 'phone' });
  const extraPhones = useWatch({ control: form.control, name: 'extraPhones' }) ?? [];
  const setExtraPhones = (next: string[]) => {
    form.setValue('extraPhones', next, { shouldDirty: true, shouldValidate: true });
  };
  const name = useWatch({ control: form.control, name: 'name' });
  const latitude = useWatch({ control: form.control, name: 'latitude' });
  const longitude = useWatch({ control: form.control, name: 'longitude' });
  const governorateCode = useWatch({ control: form.control, name: 'governorateCode' });
  const mapPoint =
    typeof latitude === 'number' && typeof longitude === 'number' ? { latitude, longitude } : null;

  const textField = (
    name: 'name' | 'email' | 'address',
    label: string,
    options: { hint?: string; type?: string; autoComplete?: string; placeholder?: string } = {},
  ) => {
    const message = validationMessage(errors[name]?.message);
    return (
      <Field id={`${id}-${name}`} label={label} hint={options.hint} error={message}>
        <Input
          {...controlProps(`${id}-${name}`, { error: message, hint: options.hint })}
          type={options.type}
          autoComplete={options.autoComplete}
          placeholder={options.placeholder}
          dir={options.type === 'email' ? 'ltr' : undefined}
          {...form.register(name)}
        />
      </Field>
    );
  };

  const phoneField = (name: 'phone' | 'whatsappPhone', label: string, hint?: string) => {
    const message = validationMessage(errors[name]?.message);
    return (
      <Field id={`${id}-${name}`} label={label} hint={hint} error={message}>
        <Controller
          control={form.control}
          name={name}
          render={({ field }) => (
            <PhoneInput
              {...controlProps(`${id}-${name}`, { error: message, hint })}
              value={field.value}
              onValueChange={field.onChange}
              onBlur={field.onBlur}
              name={field.name}
            />
          )}
        />
      </Field>
    );
  };

  const descriptionError = validationMessage(errors.description?.message);
  const descriptionHint = t('descriptionHint', {
    count: format.integer(description.length),
    max: format.integer(DESCRIPTION_MAX_LENGTH),
  });
  const governorateError = validationMessage(errors.governorateCode?.message);
  const locationError = validationMessage(errors.latitude?.message);

  return (
    <form
      noValidate
      className="grid gap-6"
      onSubmit={(event) => {
        void form.handleSubmit(async (values) => {
          try {
            const saved = await mutation.mutateAsync(values);
            form.reset(toProfileValues(saved));
            toast.success(t('saved'));
          } catch {
            toast.error(t('saveError'));
          }
        })(event);
      }}
    >
      <Card>
        <CardHeader>
          <CardTitle>{t('identityTitle')}</CardTitle>
          <CardDescription>{t('identityText')}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <LogoField name={name} logoUrl={logoUrl} />
          {textField('name', t('name'), { autoComplete: 'organization' })}
          <Field
            id={`${id}-description`}
            label={t('description')}
            hint={descriptionHint}
            error={descriptionError}
          >
            <Textarea
              {...controlProps(`${id}-description`, {
                error: descriptionError,
                hint: descriptionHint,
              })}
              rows={5}
              maxLength={DESCRIPTION_MAX_LENGTH}
              placeholder={t('descriptionPlaceholder')}
              {...form.register('description')}
            />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('contactTitle')}</CardTitle>
          <CardDescription>{t('contactText')}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          {phoneField('phone', t('phone'))}
          <div className="grid content-start gap-1.5">
            {phoneField('whatsappPhone', t('whatsapp'))}
            <button
              type="button"
              className="justify-self-start text-xs font-medium text-primary hover:underline disabled:pointer-events-none disabled:opacity-50"
              disabled={phone.length === 0}
              onClick={() => {
                form.setValue('whatsappPhone', phone, { shouldDirty: true, shouldValidate: true });
              }}
            >
              {t('sameAsPhone')}
            </button>
          </div>
          <div className="grid gap-3 sm:col-span-2">
            <div className="grid gap-1">
              <p className="text-sm font-medium">{t('extraPhones')}</p>
              <p className="text-sm text-muted-foreground">{t('extraPhonesHint')}</p>
            </div>
            {extraPhones.map((extraPhone, index) => {
              const bucket: unknown = errors.extraPhones;
              const item =
                typeof bucket === 'object' && bucket !== null
                  ? (bucket as Record<string, unknown>)[String(index)]
                  : undefined;
              const raw =
                typeof item === 'object' &&
                item !== null &&
                'message' in item &&
                typeof item.message === 'string'
                  ? item.message
                  : undefined;
              const message = validationMessage(raw);
              return (
                <div key={index} className="flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <Field id={`${id}-extra-${index}`} label={t('phone')} error={message}>
                      <PhoneInput
                        {...controlProps(`${id}-extra-${index}`, { error: message })}
                        value={extraPhone}
                        onValueChange={(value) => {
                          const next = [...extraPhones];
                          next[index] = value;
                          setExtraPhones(next);
                        }}
                      />
                    </Field>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="mt-7"
                    aria-label={t('removePhone')}
                    onClick={() => {
                      setExtraPhones(extraPhones.filter((_, item) => item !== index));
                    }}
                  >
                    <X aria-hidden="true" />
                  </Button>
                </div>
              );
            })}
            {extraPhones.length < AGENCY_EXTRA_PHONES_MAX && (
              <Button
                type="button"
                variant="secondary"
                className="justify-self-start"
                onClick={() => {
                  setExtraPhones([...extraPhones, '']);
                }}
              >
                <Plus aria-hidden="true" />
                {t('addPhone')}
              </Button>
            )}
          </div>
          <div className="sm:col-span-2">
            {textField('email', t('email'), {
              type: 'email',
              autoComplete: 'email',
              hint: t('emailHint'),
            })}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('addressTitle')}</CardTitle>
          <CardDescription>{t('addressText')}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          {textField('address', t('address'), {
            autoComplete: 'street-address',
            hint: t('addressHint'),
            placeholder: t('addressPlaceholder'),
          })}
          <Field id={`${id}-governorate`} label={t('governorate')} error={governorateError}>
            <Controller
              control={form.control}
              name="governorateCode"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger
                    {...controlProps(`${id}-governorate`, { error: governorateError })}
                    onBlur={field.onBlur}
                  >
                    <SelectValue placeholder={t('governoratePlaceholder')} />
                  </SelectTrigger>
                  <SelectContent>
                    {governorates.length === 0 ? (
                      <SelectItem value={field.value}>{field.value}</SelectItem>
                    ) : (
                      governorates.map((governorate) => (
                        <SelectItem key={governorate.code} value={governorate.code}>
                          {pickLocalized(governorate.name, format.locale)}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              )}
            />
          </Field>
          <div className="grid gap-2">
            <LocationPicker
              value={mapPoint}
              governorateCode={governorateCode}
              onAddressSuggestion={(address) => {
                if (form.getValues('address').trim().length === 0) {
                  form.setValue('address', address, { shouldDirty: true, shouldValidate: true });
                }
              }}
              onChange={(point) => {
                form.setValue('latitude', point?.latitude ?? null, {
                  shouldDirty: true,
                  shouldValidate: true,
                });
                form.setValue('longitude', point?.longitude ?? null, {
                  shouldDirty: true,
                  shouldValidate: true,
                });
              }}
            />
            {locationError !== undefined && (
              <p className="text-sm text-destructive" role="alert">
                {locationError}
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      <SaveBar
        dirty={isDirty}
        saving={mutation.isPending}
        onReset={() => {
          form.reset();
        }}
      />
    </form>
  );
}

function ConditionSelect({
  id,
  label,
  hint,
  value,
  options,
  getLabel,
  onChange,
}: {
  id: string;
  label: string;
  hint?: string;
  value: number;
  options: readonly number[];
  getLabel: (value: number) => string;
  onChange: (value: number) => void;
}) {
  return (
    <Field id={id} label={label} hint={hint}>
      <Select
        value={String(value)}
        onValueChange={(next) => {
          onChange(Number(next));
        }}
      >
        <SelectTrigger {...controlProps(id, { hint })}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option} value={String(option)}>
              {getLabel(option)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  );
}

function ConditionsForm({
  form,
}: {
  form: UseFormReturn<RentalConditions, unknown, RentalConditions>;
}) {
  const t = useTranslations('agency.settings.conditions');
  const tMethod = useTranslations('status.paymentMethod');
  const validationMessage = useValidationMessage();
  const id = useId();
  const mutation = useUpdateConditions();
  const { errors, isDirty } = form.formState;
  const methodsError = validationMessage(errors.acceptedPaymentMethods?.message);

  return (
    <form
      noValidate
      className="grid gap-6"
      onSubmit={(event) => {
        void form.handleSubmit(async (values) => {
          try {
            const saved = await mutation.mutateAsync(values);
            form.reset(saved.conditions);
            toast.success(t('saved'));
          } catch {
            toast.error(t('saveError'));
          }
        })(event);
      }}
    >
      <Card>
        <CardHeader>
          <CardTitle>{t('driverTitle')}</CardTitle>
          <CardDescription>{t('driverText')}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Controller
            control={form.control}
            name="minDriverAge"
            render={({ field }) => (
              <ConditionSelect
                id={`${id}-age`}
                label={t('minDriverAge')}
                value={field.value}
                options={range(DRIVER_AGE_MIN, DRIVER_AGE_MAX)}
                getLabel={(value) => t('years', { count: value })}
                onChange={field.onChange}
              />
            )}
          />
          <Controller
            control={form.control}
            name="minLicenseYears"
            render={({ field }) => (
              <ConditionSelect
                id={`${id}-license`}
                label={t('minLicenseYears')}
                value={field.value}
                options={range(0, LICENSE_YEARS_MAX)}
                getLabel={(value) => (value === 0 ? t('noMinimum') : t('years', { count: value }))}
                onChange={field.onChange}
              />
            )}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('bookingTitle')}</CardTitle>
          <CardDescription>{t('bookingText')}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <Controller
            control={form.control}
            name="freeCancellationHours"
            render={({ field }) => (
              <ConditionSelect
                id={`${id}-cancellation`}
                label={t('freeCancellation')}
                hint={t('freeCancellationHint')}
                value={field.value}
                options={
                  (CANCELLATION_OPTIONS as readonly number[]).includes(field.value)
                    ? CANCELLATION_OPTIONS
                    : [...CANCELLATION_OPTIONS, field.value].sort((a, b) => a - b)
                }
                getLabel={(value) =>
                  value === 0 ? t('noFreeCancellation') : t('hoursBefore', { count: value })
                }
                onChange={field.onChange}
              />
            )}
          />
          <Controller
            control={form.control}
            name="instantConfirmation"
            render={({ field }) => (
              <label
                htmlFor={`${id}-instant`}
                className="flex cursor-pointer items-center justify-between gap-4 rounded-control border border-border p-4"
              >
                <span className="flex items-start gap-3">
                  <Zap className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden="true" />
                  <span className="grid gap-0.5">
                    <span className="text-sm font-medium">{t('instantConfirmation')}</span>
                    <span className="text-xs text-muted-foreground">
                      {t('instantConfirmationHint')}
                    </span>
                  </span>
                </span>
                <Switch
                  id={`${id}-instant`}
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              </label>
            )}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('paymentTitle')}</CardTitle>
          <CardDescription>{t('paymentText')}</CardDescription>
        </CardHeader>
        <CardContent>
          <fieldset
            aria-describedby={methodsError === undefined ? undefined : `${id}-methods-error`}
          >
            <legend className="sr-only">{t('paymentTitle')}</legend>
            <Controller
              control={form.control}
              name="acceptedPaymentMethods"
              render={({ field }) => (
                <div className="grid gap-2 sm:grid-cols-2">
                  {PAYMENT_METHODS.map((method: PaymentMethod) => {
                    const Icon = PAYMENT_METHOD_ICONS[method];
                    const checked = field.value.includes(method);
                    return (
                      <label
                        key={method}
                        htmlFor={`${id}-${method}`}
                        className={cn(
                          'flex cursor-pointer items-center gap-3 rounded-control border p-3 transition-colors',
                          checked
                            ? 'border-primary bg-primary/5'
                            : 'border-border hover:bg-surface-muted',
                        )}
                      >
                        <Checkbox
                          id={`${id}-${method}`}
                          checked={checked}
                          onCheckedChange={(next) => {
                            field.onChange(
                              next === true
                                ? PAYMENT_METHODS.filter(
                                    (candidate) =>
                                      candidate === method || field.value.includes(candidate),
                                  )
                                : field.value.filter((candidate) => candidate !== method),
                            );
                          }}
                        />
                        <Icon className="size-4 text-muted-foreground" aria-hidden="true" />
                        <span className="text-sm font-medium">{tMethod(method)}</span>
                      </label>
                    );
                  })}
                </div>
              )}
            />
          </fieldset>
          {methodsError !== undefined && (
            <p
              id={`${id}-methods-error`}
              className="mt-2 text-sm font-medium text-danger"
              role="alert"
            >
              {methodsError}
            </p>
          )}
        </CardContent>
      </Card>

      <SaveBar
        dirty={isDirty}
        saving={mutation.isPending}
        onReset={() => {
          form.reset();
        }}
      />
    </form>
  );
}

/** Aperçu de la fiche telle que les clients la voient, mis à jour pendant la saisie. */
function ClientPreview({
  profile,
  logoUrl,
  conditions,
  governorates,
}: {
  profile: ProfileFormValues;
  logoUrl: string | null;
  conditions: RentalConditions;
  governorates: Governorate[];
}) {
  const t = useTranslations('agency.settings.preview');
  const tConditions = useTranslations('agency.settings.conditions');
  const tMethod = useTranslations('status.paymentMethod');
  const format = useAgencyFormat();
  const governorate = governorates.find((item) => item.code === profile.governorateCode);

  return (
    <Card className="overflow-hidden p-0">
      <div className="bg-gradient-to-br from-primary to-primary/70 px-5 pb-10 pt-4 text-primary-foreground">
        <p className="text-xs font-medium uppercase tracking-wide opacity-80">{t('title')}</p>
      </div>
      <div className="-mt-7 grid gap-4 px-5 pb-5">
        {logoUrl === null && profile.name.trim().length === 0 ? (
          <span className="flex size-14 items-center justify-center rounded-card border-4 border-surface bg-surface-muted text-primary shadow-sm">
            <Building2 className="size-6" aria-hidden="true" />
          </span>
        ) : (
          <AgencyLogo
            name={profile.name}
            logoUrl={logoUrl}
            className="size-14 rounded-card ring-4 ring-surface dark:ring-surface"
          />
        )}
        <div>
          <p className="font-heading text-lg font-semibold">
            {profile.name.trim().length > 0 ? profile.name : t('namePlaceholder')}
          </p>
          <p className="flex items-center gap-1 text-sm text-muted-foreground">
            <MapPin className="size-3.5" aria-hidden="true" />
            {typeof profile.latitude === 'number' && typeof profile.longitude === 'number'
              ? t('exactLocation')
              : governorate === undefined
                ? profile.address
                : pickLocalized(governorate.name, format.locale)}
          </p>
        </div>
        {profile.description.trim().length > 0 && (
          <p className="line-clamp-4 text-sm text-muted-foreground">{profile.description}</p>
        )}
        <ul className="grid gap-2 text-sm">
          <li className="flex items-center gap-2" dir="ltr">
            <Phone className="size-4 text-muted-foreground" aria-hidden="true" />
            <span className="tabular-nums">{displayPhone(profile.phone)}</span>
          </li>
          {profile.extraPhones?.map((extraPhone) =>
            extraPhone.length > 0 ? (
              <li key={extraPhone} className="flex items-center gap-2" dir="ltr">
                <Phone className="size-4 text-muted-foreground" aria-hidden="true" />
                <span className="tabular-nums">{displayPhone(extraPhone)}</span>
              </li>
            ) : null,
          )}
          {profile.email.length > 0 && (
            <li className="flex items-center gap-2">
              <Mail className="size-4 text-muted-foreground" aria-hidden="true" />
              <span className="truncate" dir="ltr">
                {profile.email}
              </span>
            </li>
          )}
          <li className="flex items-center gap-2">
            <ShieldCheck className="size-4 text-muted-foreground" aria-hidden="true" />
            {conditions.freeCancellationHours === 0
              ? tConditions('noFreeCancellation')
              : t('freeCancellation', { count: conditions.freeCancellationHours })}
          </li>
          <li className="flex items-center gap-2">
            <Zap className="size-4 text-muted-foreground" aria-hidden="true" />
            {conditions.instantConfirmation ? t('instant') : t('onRequest')}
          </li>
        </ul>
        <div className="grid gap-2 border-t border-border pt-4">
          <p className="text-xs font-medium text-muted-foreground">{t('payOnSite')}</p>
          <PaymentMethodBadges
            methods={conditions.acceptedPaymentMethods}
            getLabel={(method) => tMethod(method)}
          />
        </div>
        <p className="text-xs text-muted-foreground">
          {t('driver', {
            age: conditions.minDriverAge,
            years: conditions.minLicenseYears,
          })}
        </p>
      </div>
    </Card>
  );
}

function PasswordForm() {
  const t = useTranslations('agency.settings.security');
  const tAuth = useTranslations('auth');
  const { validationMessage } = useAuthMessages();
  const id = useId();
  const form = useForm({
    resolver: zodResolver(changePasswordSchema, undefined, { raw: true }),
    defaultValues: { currentPassword: '', newPassword: '' },
  });
  const change = useMutation({
    mutationFn: (values: ChangePasswordInput) => usersApi.changePassword(values),
    onSuccess: () => {
      form.reset();
      toast.success(t('success'));
    },
    onError: (error) => {
      if (error instanceof ApiError && error.code === 'INVALID_CREDENTIALS') {
        form.setError('currentPassword', { type: 'server', message: 'INVALID_CREDENTIALS' });
        return;
      }
      if (!applyServerIssues(error, form.setError, ['currentPassword', 'newPassword'])) {
        toast.error(t('error'));
      }
    },
  });
  const { errors } = form.formState;
  const currentError = validationMessage(errors.currentPassword?.message);
  const newError = validationMessage(errors.newPassword?.message);

  return (
    <Card>
      <form
        noValidate
        onSubmit={(event) => {
          void form.handleSubmit((values) => {
            change.mutate(values);
          })(event);
        }}
      >
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <KeyRound className="size-4 text-primary" aria-hidden="true" />
            {t('title')}
          </CardTitle>
          <CardDescription>{t('description')}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:max-w-md">
          <Field id={`${id}-current`} label={t('current')} error={currentError}>
            <PasswordInput
              {...controlProps(`${id}-current`, { error: currentError })}
              autoComplete="current-password"
              {...form.register('currentPassword')}
            />
          </Field>
          <Field id={`${id}-new`} label={t('next')} hint={tAuth('passwordHint')} error={newError}>
            <PasswordInput
              {...controlProps(`${id}-new`, { error: newError, hint: tAuth('passwordHint') })}
              autoComplete="new-password"
              {...form.register('newPassword')}
            />
          </Field>
        </CardContent>
        <CardFooter className="justify-end">
          <Button type="submit" loading={change.isPending}>
            {t('submit')}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}

function toProfileValues(settings: AgencySettings): ProfileFormValues {
  return { ...settings.profile, email: settings.profile.email ?? '' };
}

function SettingsForms({
  settings,
  governorates,
}: {
  settings: AgencySettings;
  governorates: Governorate[];
}) {
  const t = useTranslations('agency.settings');
  const [params, setParams] = useUrlState(URL_DEFAULTS, isValidParam);
  const profileForm = useForm({
    resolver: zodResolver(profileFormSchema),
    defaultValues: toProfileValues(settings),
  });
  const conditionsForm = useForm({
    resolver: zodResolver(rentalConditionsSchema),
    defaultValues: settings.conditions,
  });
  const profile = useWatch({ control: profileForm.control }) as ProfileFormValues;
  const conditions = useWatch({ control: conditionsForm.control }) as RentalConditions;

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <Tabs
        value={params.tab}
        onValueChange={(tab) => {
          setParams({ tab });
        }}
      >
        <TabsList>
          <TabsTrigger value="profile">{t('tabs.profile')}</TabsTrigger>
          <TabsTrigger value="conditions">{t('tabs.conditions')}</TabsTrigger>
          <TabsTrigger value="security">{t('tabs.security')}</TabsTrigger>
        </TabsList>
        <TabsContent value="profile" forceMount className="data-[state=inactive]:hidden">
          <ProfileForm governorates={governorates} logoUrl={settings.logoUrl} form={profileForm} />
        </TabsContent>
        <TabsContent value="conditions" forceMount className="data-[state=inactive]:hidden">
          <ConditionsForm form={conditionsForm} />
        </TabsContent>
        <TabsContent value="security" className="mt-6">
          <PasswordForm />
        </TabsContent>
      </Tabs>
      <aside className="grid gap-3 lg:sticky lg:top-20">
        <ClientPreview
          profile={profile}
          logoUrl={settings.logoUrl}
          conditions={conditions}
          governorates={governorates}
        />
        <p className="px-1 text-xs text-muted-foreground">{t('previewHint')}</p>
      </aside>
    </div>
  );
}

export function SettingsView({ governorates }: { governorates: Governorate[] }) {
  const t = useTranslations('agency.settings');
  const { data, isPending, isError, error, refetch, isFetching } = useAgencySettings();

  return (
    <div className="grid gap-6">
      <PageHeader title={t('title')} description={t('subtitle')} />
      {isPending ? (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]" aria-hidden="true">
          <div className="grid gap-4">
            <Skeleton className="h-10 w-64" />
            <Skeleton className="h-64 rounded-card" />
            <Skeleton className="h-48 rounded-card" />
          </div>
          <Skeleton className="h-96 rounded-card" />
        </div>
      ) : isError ? (
        <QueryError error={error} onRetry={() => void refetch()} retrying={isFetching} />
      ) : (
        <SettingsForms settings={data} governorates={governorates} />
      )}
    </div>
  );
}
