'use client';

import { Button } from '@drivetn/ui/button';
import { Card } from '@drivetn/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@drivetn/ui/dropdown-menu';
import { EmptyState } from '@drivetn/ui/empty-state';
import { Skeleton } from '@drivetn/ui/skeleton';
import {
  CalendarRange,
  Camera,
  CarFront,
  Cog,
  Fuel,
  MoreHorizontal,
  Pencil,
  Plus,
  Snowflake,
  Users,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useCallback, useState } from 'react';

import { useCategoryLabel } from '@/components/vehicle-categories';
import { Link } from '@/i18n/navigation';
import { useVehicles } from '@/lib/agency/queries';
import type { Vehicle, VehicleView } from '@/lib/agency/types';
import { vehicleCoverUrl } from '@/lib/agency/vehicle-photos';

import { FilterTabs } from '../filter-tabs';
import { PageHeader } from '../page-header';
import { QueryError } from '../query-states';
import { SearchField } from '../search-field';
import { type VehicleAvailability, VehicleAvailabilityTag } from '../status-tags';
import { useAgencyFormat } from '../use-agency-format';
import { useUrlState } from '../use-url-state';
import { matchesVehicleSearch } from '../vehicle-search';
import { VehicleGuards } from '../vehicle-status-items';
import { VehicleThumb } from '../vehicle-thumb';
import { VehicleFormSheet } from './vehicle-form-sheet';

const FLEET_FILTERS = ['all', 'ACTIVE', 'ON_RENT', 'MAINTENANCE', 'INACTIVE'] as const;
type FleetFilter = (typeof FLEET_FILTERS)[number];

const URL_DEFAULTS = { filter: 'all', q: '' };

function isValidParam(key: keyof typeof URL_DEFAULTS, value: string): boolean {
  return key === 'q' || (FLEET_FILTERS as readonly string[]).includes(value);
}

function availabilityOf(vehicle: VehicleView): VehicleAvailability {
  return vehicle.currentBooking === null ? vehicle.status : 'ON_RENT';
}

function OccupancyMeter({ rate }: { rate: number }) {
  const t = useTranslations('agency.fleet');
  const format = useAgencyFormat();
  return (
    <div className="grid gap-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{t('occupancy30d')}</span>
        <span className="font-semibold tabular-nums">{format.percent(rate)}</span>
      </div>
      <div
        className="h-1.5 overflow-hidden rounded-full bg-surface-muted"
        role="meter"
        aria-label={t('occupancy30d')}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(rate * 100)}
      >
        <div
          className="h-full rounded-full bg-primary transition-[width] duration-500"
          style={{ width: `${Math.min(100, Math.round(rate * 100))}%` }}
        />
      </div>
    </div>
  );
}

function VehicleStatusMenu({ vehicle }: { vehicle: VehicleView }) {
  const t = useTranslations('agency.fleet');
  const name = `${vehicle.brand} ${vehicle.model}`;

  return (
    <VehicleGuards
      vehicleId={vehicle.id}
      name={name}
      status={vehicle.status}
      onRent={vehicle.currentBooking !== null}
    >
      {({ statusItems, deleteItem }) => (
        <DropdownMenu modal={false}>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm" aria-label={t('moreActions', { name })}>
              <MoreHorizontal aria-hidden="true" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-60">
            {statusItems}
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/calendar">
                <CalendarRange aria-hidden="true" />
                {t('viewPlanning')}
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            {deleteItem}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </VehicleGuards>
  );
}

function VehicleCard({
  vehicle,
  onEdit,
}: {
  vehicle: VehicleView;
  onEdit: (vehicle: Vehicle) => void;
}) {
  const t = useTranslations('agency.fleet');
  const format = useAgencyFormat();
  const categoryLabel = useCategoryLabel();
  const availability = availabilityOf(vehicle);
  const booking = vehicle.currentBooking ?? vehicle.nextBooking;
  const specs = [
    { icon: Cog, label: t(`transmissions.${vehicle.transmission}`) },
    { icon: Fuel, label: t(`fuels.${vehicle.fuel}`) },
    { icon: Users, label: t('seats', { count: vehicle.seats }) },
    ...(vehicle.airConditioning ? [{ icon: Snowflake, label: t('airConditioning') }] : []),
  ];

  return (
    <Card className="group flex flex-col overflow-hidden p-0 transition-shadow hover:shadow-elevated">
      <div className="relative">
        <VehicleThumb
          color={vehicle.color}
          photoUrl={vehicleCoverUrl(vehicle)}
          size="lg"
          className="h-40 rounded-none"
        />
        <VehicleAvailabilityTag
          availability={availability}
          className="absolute start-3 top-3 shadow-sm"
        />
        {vehicle.photos.length > 1 && (
          <span className="absolute bottom-3 start-3 inline-flex items-center gap-1 rounded-md bg-black/60 px-2 py-0.5 text-xs font-medium tabular-nums text-white backdrop-blur">
            <Camera className="size-3.5" aria-hidden="true" />
            <span className="sr-only">{t('photoCount', { count: vehicle.photos.length })}</span>
            <span aria-hidden="true">{vehicle.photos.length}</span>
          </span>
        )}
        {vehicle.plateNumber !== null && (
          <span
            className="absolute bottom-3 end-3 rounded-md bg-surface/90 px-2 py-0.5 font-mono text-xs font-semibold tracking-wide text-foreground shadow-sm backdrop-blur"
            dir="ltr"
          >
            {vehicle.plateNumber}
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-4 p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="truncate font-semibold">
              {vehicle.brand} {vehicle.model}
            </h3>
            <p className="text-sm text-muted-foreground">
              {categoryLabel(vehicle.category)} ·{' '}
              <span className="tabular-nums">{vehicle.year}</span>
            </p>
          </div>
          <VehicleStatusMenu vehicle={vehicle} />
        </div>

        <ul className="flex flex-wrap gap-x-3 gap-y-1.5 text-xs text-muted-foreground">
          {specs.map(({ icon: Icon, label }) => (
            <li key={label} className="flex items-center gap-1">
              <Icon className="size-3.5" aria-hidden="true" />
              {label}
            </li>
          ))}
        </ul>

        <div className="flex items-end justify-between gap-3">
          <p>
            <span className="text-lg font-bold tabular-nums">
              {format.money(vehicle.dailyRateMillimes)}
            </span>
            <span className="text-sm text-muted-foreground"> {t('perDay')}</span>
          </p>
          <p className="text-end text-xs text-muted-foreground">
            {t('deposit', { amount: format.money(vehicle.depositMillimes) })}
            <br />
            {vehicle.mileageLimitKm === null
              ? t('unlimitedMileage')
              : t('mileagePerDay', { km: format.integer(vehicle.mileageLimitKm) })}
            <br />
            {t('pickupCount', { count: vehicle.pickupLocationSlugs.length })}
          </p>
        </div>

        <OccupancyMeter rate={vehicle.occupancyRate} />

        <div className="mt-auto rounded-control bg-surface-muted px-3 py-2 text-xs">
          {booking === null ? (
            <span className="text-muted-foreground">
              {vehicle.status === 'ACTIVE' ? t('noUpcoming') : t('unavailableHint')}
            </span>
          ) : (
            <Link
              href={`/bookings/${booking.id}`}
              className="flex items-center justify-between gap-2 rounded-sm hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span className="min-w-0 truncate">
                <span className="font-medium">
                  {vehicle.currentBooking === null ? t('nextBooking') : t('currentBooking')}
                </span>{' '}
                {booking.customerName}
              </span>
              <span className="shrink-0 tabular-nums text-muted-foreground">
                {vehicle.currentBooking === null
                  ? format.dayMonth(booking.pickupAt)
                  : t('until', { date: format.dayMonth(booking.returnAt) })}
              </span>
            </Link>
          )}
        </div>

        <Button
          variant="secondary"
          size="sm"
          onClick={() => {
            onEdit(vehicle);
          }}
        >
          <Pencil aria-hidden="true" />
          {t('edit')}
        </Button>
      </div>
    </Card>
  );
}

function FleetSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-hidden="true">
      {Array.from({ length: 6 }, (_, index) => (
        <Card key={index} className="grid gap-4 overflow-hidden p-0">
          <Skeleton className="h-32 rounded-none" />
          <div className="grid gap-3 p-4">
            <Skeleton className="h-5 w-2/3" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-9 w-full" />
          </div>
        </Card>
      ))}
    </div>
  );
}

/** `version` remonte le formulaire à chaque ouverture tout en gardant l'animation de fermeture. */
interface SheetState {
  open: boolean;
  vehicle: Vehicle | null;
  version: number;
}

export function FleetView() {
  const t = useTranslations('agency.fleet');
  const format = useAgencyFormat();
  const [params, setParams] = useUrlState(URL_DEFAULTS, isValidParam);
  const [sheet, setSheet] = useState<SheetState>({ open: false, vehicle: null, version: 0 });
  const { data, isPending, isError, error, refetch, isFetching } = useVehicles();
  const filter = params.filter as FleetFilter;

  const onSearch = useCallback(
    (q: string) => {
      setParams({ q });
    },
    [setParams],
  );

  const searched = (data ?? []).filter((vehicle) => matchesVehicleSearch(vehicle, params.q));
  const counts = Object.fromEntries(
    FLEET_FILTERS.map((value) => [
      value,
      value === 'all'
        ? searched.length
        : searched.filter((vehicle) => availabilityOf(vehicle) === value).length,
    ]),
  ) as Record<FleetFilter, number>;
  const visible =
    filter === 'all' ? searched : searched.filter((vehicle) => availabilityOf(vehicle) === filter);

  const activeVehicles = (data ?? []).filter((vehicle) => vehicle.status !== 'INACTIVE');
  const averageOccupancy =
    activeVehicles.length === 0
      ? 0
      : activeVehicles.reduce((sum, vehicle) => sum + vehicle.occupancyRate, 0) /
        activeVehicles.length;
  const revenue30d = (data ?? []).reduce((sum, vehicle) => sum + vehicle.revenue30dMillimes, 0);

  const openSheet = (vehicle: Vehicle | null) => {
    setSheet((current) => ({ open: true, vehicle, version: current.version + 1 }));
  };

  return (
    <div className="grid gap-6">
      <PageHeader
        title={t('title')}
        description={
          data === undefined
            ? t('subtitle')
            : t('summary', {
                count: data.length,
                occupancy: format.percent(averageOccupancy),
                revenue: format.money(revenue30d),
              })
        }
        actions={
          <Button
            onClick={() => {
              openSheet(null);
            }}
          >
            <Plus aria-hidden="true" />
            {t('add')}
          </Button>
        }
      />

      <div className="grid gap-4">
        <SearchField
          value={params.q}
          onValueChange={onSearch}
          label={t('searchLabel')}
          placeholder={t('searchPlaceholder')}
        />
        <FilterTabs
          label={t('filterLabel')}
          value={filter}
          onValueChange={(value) => {
            setParams({ filter: value });
          }}
          options={FLEET_FILTERS.map((value) => ({
            value,
            label: value === 'all' ? t('filterAll') : t(`availability.${value}`),
            count: data === undefined ? undefined : counts[value],
          }))}
        />
      </div>

      {isPending ? (
        <FleetSkeleton />
      ) : isError ? (
        <QueryError error={error} onRetry={() => void refetch()} retrying={isFetching} />
      ) : data.length === 0 ? (
        <EmptyState
          icon={CarFront}
          title={t('emptyTitle')}
          description={t('emptyText')}
          action={
            <Button
              onClick={() => {
                openSheet(null);
              }}
            >
              <Plus aria-hidden="true" />
              {t('add')}
            </Button>
          }
        />
      ) : visible.length === 0 ? (
        <EmptyState
          icon={CarFront}
          title={t('emptyFilteredTitle')}
          description={t('emptyFilteredText')}
          action={
            <Button
              variant="secondary"
              onClick={() => {
                setParams({ filter: 'all', q: '' });
              }}
            >
              {t('clearFilters')}
            </Button>
          }
        />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {visible.map((vehicle) => (
            <li key={vehicle.id} className="grid">
              <VehicleCard vehicle={vehicle} onEdit={openSheet} />
            </li>
          ))}
        </ul>
      )}

      <VehicleFormSheet
        key={sheet.version}
        open={sheet.open}
        vehicle={sheet.vehicle}
        onOpenChange={(open) => {
          setSheet((current) => ({ ...current, open }));
        }}
      />
    </div>
  );
}
