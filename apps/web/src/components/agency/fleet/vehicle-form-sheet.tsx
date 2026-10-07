'use client';

import {
  FUEL_TYPES,
  fuelTypeSchema,
  isValidTunisianPlate,
  millimesToDinarInput,
  parseDinars,
  TRANSMISSIONS,
  transmissionSchema,
  VEHICLE_CATEGORIES,
  VEHICLE_SEATS_MAX,
  VEHICLE_SEATS_MIN,
  VEHICLE_YEAR_MIN,
  vehicleCategorySchema,
  type VehicleInput,
  vehicleYearMax,
} from '@drivetn/types';
import { Button } from '@drivetn/ui/button';
import { Field } from '@drivetn/ui/field';
import { Input } from '@drivetn/ui/input';
import { cn } from '@drivetn/ui/lib/cn';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@drivetn/ui/select';
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@drivetn/ui/sheet';
import { Switch } from '@drivetn/ui/switch';
import { toast } from '@drivetn/ui/toaster';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';
import { type ReactNode, useId } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';

import { controlProps } from '@/components/auth/control-props';
import { useSaveVehicle } from '@/lib/agency/queries';
import type { Vehicle } from '@/lib/agency/types';

import { applyFieldIssues, useValidationMessage } from '../use-validation-message';

const integerString = (min: number, max: () => number) =>
  z
    .string()
    .trim()
    .min(1, { message: 'REQUIRED' })
    .refine((value) => /^\d+$/.test(value) && Number(value) >= min && Number(value) <= max(), {
      message: 'OUT_OF_RANGE',
    });

const amountString = (allowZero: boolean) =>
  z
    .string()
    .trim()
    .min(1, { message: 'REQUIRED' })
    .refine(
      (value) => {
        const millimes = parseDinars(value);
        return millimes !== null && (allowZero ? millimes >= 0 : millimes > 0);
      },
      { message: 'INVALID_AMOUNT' },
    );

const vehicleFormSchema = z
  .object({
    brand: z.string().trim().min(1, { message: 'REQUIRED' }).max(40, { message: 'TOO_LONG' }),
    model: z.string().trim().min(1, { message: 'REQUIRED' }).max(40, { message: 'TOO_LONG' }),
    year: integerString(VEHICLE_YEAR_MIN, () => vehicleYearMax()),
    plateNumber: z
      .string()
      .trim()
      .min(1, { message: 'REQUIRED' })
      .refine(isValidTunisianPlate, { message: 'INVALID_PLATE' }),
    category: vehicleCategorySchema,
    transmission: transmissionSchema,
    fuel: fuelTypeSchema,
    seats: z.string(),
    airConditioning: z.boolean(),
    dailyRate: amountString(false),
    deposit: amountString(true),
    unlimitedMileage: z.boolean(),
    mileageLimitKm: z.string().trim(),
  })
  .refine(
    (value) =>
      value.unlimitedMileage ||
      (/^\d+$/.test(value.mileageLimitKm) && Number(value.mileageLimitKm) > 0),
    { message: 'OUT_OF_RANGE', path: ['mileageLimitKm'] },
  );

type VehicleFormValues = z.input<typeof vehicleFormSchema>;

const SERVER_FIELDS = ['brand', 'model', 'year', 'plateNumber'] as const;
const SEAT_OPTIONS = Array.from({ length: VEHICLE_SEATS_MAX - VEHICLE_SEATS_MIN + 1 }, (_, index) =>
  String(VEHICLE_SEATS_MIN + index),
);

function toFormValues(vehicle: Vehicle | null): VehicleFormValues {
  const mileageLimit = vehicle?.mileageLimitKm ?? null;
  return {
    brand: vehicle?.brand ?? '',
    model: vehicle?.model ?? '',
    year: String(vehicle?.year ?? new Date().getFullYear()),
    plateNumber: vehicle?.plateNumber ?? '',
    category: vehicle?.category ?? 'COMPACT',
    transmission: vehicle?.transmission ?? 'MANUAL',
    fuel: vehicle?.fuel ?? 'PETROL',
    seats: String(vehicle?.seats ?? 5),
    airConditioning: vehicle?.airConditioning ?? true,
    dailyRate: vehicle === null ? '' : millimesToDinarInput(vehicle.dailyRateMillimes),
    deposit: vehicle === null ? '' : millimesToDinarInput(vehicle.depositMillimes),
    unlimitedMileage: mileageLimit === null,
    mileageLimitKm: mileageLimit === null ? '' : String(mileageLimit),
  };
}

function toInput(values: VehicleFormValues): VehicleInput {
  return {
    brand: values.brand.trim(),
    model: values.model.trim(),
    year: Number(values.year),
    plateNumber: values.plateNumber,
    category: values.category,
    transmission: values.transmission,
    fuel: values.fuel,
    seats: Number(values.seats),
    airConditioning: values.airConditioning,
    dailyRateMillimes: parseDinars(values.dailyRate) ?? 0,
    depositMillimes: parseDinars(values.deposit) ?? 0,
    mileageLimitKm: values.unlimitedMileage ? null : Number(values.mileageLimitKm),
  };
}

function FormSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset className="grid gap-4">
      <legend className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </legend>
      {children}
    </fieldset>
  );
}

/**
 * Ajout ou modification d'un véhicule dans un panneau latéral.
 * Les valeurs initiales sont lues au montage : changer la `key` à chaque ouverture.
 */
export function VehicleFormSheet({
  vehicle,
  open,
  onOpenChange,
}: {
  vehicle: Vehicle | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations('agency.fleet');
  const tForm = useTranslations('agency.fleet.form');
  const tCommon = useTranslations('common');
  const validationMessage = useValidationMessage();
  const id = useId();
  const save = useSaveVehicle();
  const form = useForm({
    resolver: zodResolver(vehicleFormSchema),
    defaultValues: toFormValues(vehicle),
  });
  const { errors } = form.formState;
  const unlimited = useWatch({ control: form.control, name: 'unlimitedMileage' });
  const error = (name: keyof VehicleFormValues) => validationMessage(errors[name]?.message);

  const text = (
    name: 'brand' | 'model' | 'year' | 'plateNumber' | 'dailyRate' | 'deposit' | 'mileageLimitKm',
    options: {
      label: string;
      hint?: string;
      suffix?: string;
      inputMode?: 'numeric' | 'decimal';
      placeholder?: string;
      className?: string;
    },
  ) => {
    const message = error(name);
    return (
      <Field
        id={`${id}-${name}`}
        label={options.label}
        hint={options.hint}
        error={message}
        className={options.className}
      >
        <div className="relative">
          <Input
            {...controlProps(`${id}-${name}`, { error: message, hint: options.hint })}
            inputMode={options.inputMode}
            placeholder={options.placeholder}
            autoComplete="off"
            dir={options.inputMode === undefined ? undefined : 'ltr'}
            className={cn(
              options.suffix !== undefined && 'pe-14',
              options.inputMode !== undefined && 'tabular-nums',
            )}
            {...form.register(name)}
          />
          {options.suffix !== undefined && (
            <span className="pointer-events-none absolute end-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
              {options.suffix}
            </span>
          )}
        </div>
      </Field>
    );
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="end"
        closeLabel={tCommon('close')}
        className="w-full max-w-full gap-0 p-0 sm:max-w-xl"
      >
        <form
          noValidate
          className="flex h-full flex-col"
          onSubmit={(event) => {
            void form.handleSubmit(async (values) => {
              try {
                await save.mutateAsync({ id: vehicle?.id ?? null, input: toInput(values) });
                toast.success(vehicle === null ? tForm('created') : tForm('updated'));
                onOpenChange(false);
              } catch (cause) {
                if (!applyFieldIssues(cause, form.setError, SERVER_FIELDS)) {
                  toast.error(tForm('saveError'));
                }
              }
            })(event);
          }}
        >
          <SheetHeader className="border-b border-border p-6">
            <SheetTitle>{vehicle === null ? tForm('createTitle') : tForm('editTitle')}</SheetTitle>
            <SheetDescription>{tForm('description')}</SheetDescription>
          </SheetHeader>

          <div className="grid flex-1 content-start gap-8 overflow-y-auto p-6">
            <FormSection title={tForm('sections.identity')}>
              <div className="grid gap-4 sm:grid-cols-2">
                {text('brand', { label: tForm('brand'), placeholder: 'Peugeot' })}
                {text('model', { label: tForm('model'), placeholder: '208' })}
                {text('year', { label: tForm('year'), inputMode: 'numeric' })}
                {text('plateNumber', {
                  label: tForm('plate'),
                  hint: tForm('plateHint'),
                  placeholder: '245 TU 1234',
                })}
              </div>
            </FormSection>

            <FormSection title={tForm('sections.specs')}>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field id={`${id}-category`} label={tForm('category')}>
                  <Controller
                    control={form.control}
                    name="category"
                    render={({ field }) => (
                      <Select
                        value={field.value}
                        onValueChange={(value) => {
                          const parsed = vehicleCategorySchema.safeParse(value);
                          if (parsed.success) {
                            field.onChange(parsed.data);
                          }
                        }}
                      >
                        <SelectTrigger id={`${id}-category`} onBlur={field.onBlur}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {VEHICLE_CATEGORIES.map((category) => (
                            <SelectItem key={category} value={category}>
                              {t(`categories.${category}`)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                </Field>
                <Field id={`${id}-fuel`} label={tForm('fuel')}>
                  <Controller
                    control={form.control}
                    name="fuel"
                    render={({ field }) => (
                      <Select
                        value={field.value}
                        onValueChange={(value) => {
                          const parsed = fuelTypeSchema.safeParse(value);
                          if (parsed.success) {
                            field.onChange(parsed.data);
                          }
                        }}
                      >
                        <SelectTrigger id={`${id}-fuel`} onBlur={field.onBlur}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {FUEL_TYPES.map((fuel) => (
                            <SelectItem key={fuel} value={fuel}>
                              {t(`fuels.${fuel}`)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                </Field>
                <fieldset className="grid gap-2">
                  <legend className="mb-2 text-sm font-medium">{tForm('transmission')}</legend>
                  <Controller
                    control={form.control}
                    name="transmission"
                    render={({ field }) => (
                      <div className="grid grid-cols-2 gap-1 rounded-control bg-surface-muted p-1">
                        {TRANSMISSIONS.map((transmission) => (
                          <label
                            key={transmission}
                            className={cn(
                              'flex h-9 cursor-pointer items-center justify-center rounded-[0.375rem] text-sm font-medium transition-colors',
                              'has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring',
                              field.value === transmission
                                ? 'bg-surface text-foreground shadow-sm'
                                : 'text-muted-foreground hover:text-foreground',
                            )}
                          >
                            <input
                              type="radio"
                              className="sr-only"
                              name={field.name}
                              value={transmission}
                              checked={field.value === transmission}
                              onChange={() => {
                                const parsed = transmissionSchema.safeParse(transmission);
                                if (parsed.success) {
                                  field.onChange(parsed.data);
                                }
                              }}
                            />
                            {t(`transmissions.${transmission}`)}
                          </label>
                        ))}
                      </div>
                    )}
                  />
                </fieldset>
                <Field id={`${id}-seats`} label={tForm('seats')}>
                  <Controller
                    control={form.control}
                    name="seats"
                    render={({ field }) => (
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger id={`${id}-seats`} onBlur={field.onBlur}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {SEAT_OPTIONS.map((seats) => (
                            <SelectItem key={seats} value={seats}>
                              {t('seats', { count: Number(seats) })}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                </Field>
              </div>
              <Controller
                control={form.control}
                name="airConditioning"
                render={({ field }) => (
                  <label
                    htmlFor={`${id}-ac`}
                    className="flex cursor-pointer items-center justify-between gap-4 rounded-control border border-border p-4"
                  >
                    <span className="grid gap-0.5">
                      <span className="text-sm font-medium">{tForm('airConditioning')}</span>
                      <span className="text-xs text-muted-foreground">
                        {tForm('airConditioningHint')}
                      </span>
                    </span>
                    <Switch
                      id={`${id}-ac`}
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </label>
                )}
              />
            </FormSection>

            <FormSection title={tForm('sections.pricing')}>
              <div className="grid gap-4 sm:grid-cols-2">
                {text('dailyRate', {
                  label: tForm('dailyRate'),
                  inputMode: 'decimal',
                  suffix: tForm('perDaySuffix'),
                })}
                {text('deposit', {
                  label: tForm('deposit'),
                  hint: tForm('depositHint'),
                  inputMode: 'decimal',
                  suffix: tForm('currency'),
                })}
              </div>
              <Controller
                control={form.control}
                name="unlimitedMileage"
                render={({ field }) => (
                  <label
                    htmlFor={`${id}-unlimited`}
                    className="flex cursor-pointer items-center justify-between gap-4 rounded-control border border-border p-4"
                  >
                    <span className="grid gap-0.5">
                      <span className="text-sm font-medium">{tForm('unlimitedMileage')}</span>
                      <span className="text-xs text-muted-foreground">
                        {tForm('unlimitedMileageHint')}
                      </span>
                    </span>
                    <Switch
                      id={`${id}-unlimited`}
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </label>
                )}
              />
              {!unlimited &&
                text('mileageLimitKm', {
                  label: tForm('mileageLimit'),
                  inputMode: 'numeric',
                  suffix: tForm('kmPerDaySuffix'),
                  className: 'sm:max-w-[calc(50%-0.5rem)]',
                })}
            </FormSection>
          </div>

          <div className="flex flex-col-reverse gap-2 border-t border-border bg-surface p-4 sm:flex-row sm:justify-end sm:px-6">
            <SheetClose asChild>
              <Button variant="secondary">{tForm('cancel')}</Button>
            </SheetClose>
            <Button type="submit" loading={save.isPending}>
              {vehicle === null ? tForm('submitCreate') : tForm('submitEdit')}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
