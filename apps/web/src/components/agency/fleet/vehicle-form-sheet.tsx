'use client';

import {
  FUEL_TYPES,
  fuelTypeSchema,
  isValidTunisianPlate,
  millimesToDinarInput,
  parseDinars,
  TRANSMISSIONS,
  transmissionSchema,
  VEHICLE_SEATS_MAX,
  VEHICLE_SEATS_MIN,
  VEHICLE_YEAR_MIN,
  type VehicleCategoryInfo,
  type VehicleInput,
  vehicleYearMax,
} from '@drivetn/types';
import { Button } from '@drivetn/ui/button';
import { Combobox } from '@drivetn/ui/combobox';
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
import { type ReactNode, useId, useMemo, useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';

import { controlProps } from '@/components/auth/control-props';
import { useCategoryLabel, useVehicleCategories } from '@/components/vehicle-categories';
import { useSaveVehicle } from '@/lib/agency/queries';
import type { Vehicle } from '@/lib/agency/types';
import { type PhotoDraft, savedPhotoDrafts } from '@/lib/agency/vehicle-photos';
import { useVehicleBrands } from '@/lib/vehicle-brands';

import { applyFieldIssues, useValidationMessage } from '../use-validation-message';
import { VehiclePhotosField } from './vehicle-photos-field';

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
    brand: z.string().min(1, { message: 'REQUIRED' }),
    model: z.string().min(1, { message: 'REQUIRED' }),
    year: integerString(VEHICLE_YEAR_MIN, () => vehicleYearMax()),
    plateNumber: z
      .string()
      .trim()
      .refine((plate) => plate === '' || isValidTunisianPlate(plate), {
        message: 'INVALID_PLATE',
      }),
    category: z.string().min(1, { message: 'REQUIRED' }),
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

const SERVER_FIELDS = ['brand', 'model', 'year', 'plateNumber', 'category'] as const;
const SEAT_OPTIONS = Array.from({ length: VEHICLE_SEATS_MAX - VEHICLE_SEATS_MIN + 1 }, (_, index) =>
  String(VEHICLE_SEATS_MIN + index),
);

function toFormValues(
  vehicle: Vehicle | null,
  categories: readonly VehicleCategoryInfo[],
): VehicleFormValues {
  const mileageLimit = vehicle?.mileageLimitKm ?? null;
  return {
    brand: vehicle?.brand ?? '',
    model: vehicle?.model ?? '',
    year: String(vehicle?.year ?? new Date().getFullYear()),
    plateNumber: vehicle?.plateNumber ?? '',
    category: vehicle?.category ?? categories[0]?.slug ?? '',
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
    brand: values.brand,
    model: values.model,
    year: Number(values.year),
    plateNumber: values.plateNumber.trim() || null,
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
  const categories = useVehicleCategories();
  const categoryLabel = useCategoryLabel();
  const brands = useVehicleBrands();
  const form = useForm({
    resolver: zodResolver(vehicleFormSchema),
    defaultValues: toFormValues(vehicle, categories),
  });
  const brandOptions = useMemo(() => {
    const names = (brands.data ?? []).map((brand) => brand.name);
    // Une marque retirée du référentiel reste affichée pour le véhicule qui la porte.
    if (vehicle !== null && !names.includes(vehicle.brand)) {
      names.push(vehicle.brand);
    }
    return names.map((name) => ({ value: name, label: name }));
  }, [brands.data, vehicle]);
  const brand = useWatch({ control: form.control, name: 'brand' });
  const modelOptions = useMemo(() => {
    const names = [...(brands.data?.find((item) => item.name === brand)?.models ?? [])];
    // Comme pour la marque : un modèle retiré du référentiel reste affiché pour son véhicule.
    if (vehicle?.brand === brand && !names.includes(vehicle.model)) {
      names.push(vehicle.model);
    }
    return names.map((name) => ({ value: name, label: name }));
  }, [brands.data, brand, vehicle]);
  const categoryOptions = useMemo(() => {
    const slugs = categories.map((category) => category.slug);
    if (vehicle !== null && !slugs.includes(vehicle.category)) {
      slugs.push(vehicle.category);
    }
    return slugs;
  }, [categories, vehicle]);
  const [photos, setPhotos] = useState<PhotoDraft[]>(() => savedPhotoDrafts(vehicle?.photos ?? []));
  const [photoProgress, setPhotoProgress] = useState<{ done: number; total: number } | null>(null);
  const { errors } = form.formState;
  const unlimited = useWatch({ control: form.control, name: 'unlimitedMileage' });
  const error = (name: keyof VehicleFormValues) => validationMessage(errors[name]?.message);
  const brandError = error('brand');
  const modelError = error('model');
  const modelHint =
    brand === ''
      ? tForm('modelSelectBrand')
      : brands.data !== undefined && modelOptions.length === 0
        ? tForm('modelNone')
        : undefined;
  const categoryError = error('category');

  const text = (
    name: 'year' | 'plateNumber' | 'dailyRate' | 'deposit' | 'mileageLimitKm',
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
                const { photoFailures } = await save.mutateAsync({
                  id: vehicle?.id ?? null,
                  input: toInput(values),
                  photos,
                  initialPhotos: vehicle?.photos ?? [],
                  onPhotoProgress: (done, total) => {
                    setPhotoProgress(total > 0 && done < total ? { done, total } : null);
                  },
                });
                if (photoFailures > 0) {
                  toast.warning(tForm('photos.partialError', { count: photoFailures }));
                } else {
                  toast.success(vehicle === null ? tForm('created') : tForm('updated'));
                }
                onOpenChange(false);
              } catch (cause) {
                if (!applyFieldIssues(cause, form.setError, SERVER_FIELDS)) {
                  toast.error(tForm('saveError'));
                }
              } finally {
                setPhotoProgress(null);
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
                <Field id={`${id}-brand`} label={tForm('brand')} error={brandError}>
                  <Controller
                    control={form.control}
                    name="brand"
                    render={({ field }) => (
                      <Combobox
                        {...controlProps(`${id}-brand`, { error: brandError })}
                        ref={field.ref}
                        value={field.value}
                        onValueChange={(value) => {
                          if (value !== field.value) {
                            form.setValue(
                              'model',
                              vehicle !== null && value === vehicle.brand ? vehicle.model : '',
                            );
                          }
                          field.onChange(value);
                        }}
                        onBlur={field.onBlur}
                        options={brandOptions}
                        placeholder={tForm('brandPlaceholder')}
                        searchPlaceholder={tForm('brandSearch')}
                        emptyText={tForm('brandEmpty')}
                      />
                    )}
                  />
                </Field>
                <Field
                  id={`${id}-model`}
                  label={tForm('model')}
                  hint={modelHint}
                  error={modelError}
                >
                  <Controller
                    control={form.control}
                    name="model"
                    render={({ field }) => (
                      <Combobox
                        {...controlProps(`${id}-model`, { error: modelError, hint: modelHint })}
                        ref={field.ref}
                        value={field.value}
                        onValueChange={field.onChange}
                        onBlur={field.onBlur}
                        disabled={brand === ''}
                        options={modelOptions}
                        placeholder={tForm('modelPlaceholder')}
                        searchPlaceholder={tForm('modelSearch')}
                        emptyText={tForm('modelEmpty')}
                      />
                    )}
                  />
                </Field>
                {text('year', { label: tForm('year'), inputMode: 'numeric' })}
                {text('plateNumber', {
                  label: tForm('plate'),
                  hint: tForm('plateHint'),
                  placeholder: '245 TU 1234',
                })}
              </div>
            </FormSection>

            <FormSection title={tForm('sections.photos')}>
              <VehiclePhotosField value={photos} onChange={setPhotos} disabled={save.isPending} />
            </FormSection>

            <FormSection title={tForm('sections.specs')}>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field id={`${id}-category`} label={tForm('category')} error={categoryError}>
                  <Controller
                    control={form.control}
                    name="category"
                    render={({ field }) => (
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger
                          {...controlProps(`${id}-category`, { error: categoryError })}
                          onBlur={field.onBlur}
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {categoryOptions.map((category) => (
                            <SelectItem key={category} value={category}>
                              {categoryLabel(category)}
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

          <div className="flex flex-col-reverse gap-2 border-t border-border bg-surface p-4 sm:flex-row sm:items-center sm:justify-end sm:px-6">
            {photoProgress !== null && (
              <p
                role="status"
                className="text-center text-sm tabular-nums text-muted-foreground sm:me-auto sm:text-start"
              >
                {tForm('photos.uploading', {
                  current: photoProgress.done + 1,
                  total: photoProgress.total,
                })}
              </p>
            )}
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
