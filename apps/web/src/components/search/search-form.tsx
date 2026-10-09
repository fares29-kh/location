'use client';

import { addDays, type LocationType, todayKey } from '@drivetn/types';
import { Button } from '@drivetn/ui/button';
import { inputClassName } from '@drivetn/ui/input';
import { Label } from '@drivetn/ui/label';
import { cn } from '@drivetn/ui/lib/cn';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@drivetn/ui/select';
import { CalendarDays, Landmark, type LucideIcon, MapPin, Search } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { type ReactNode, useId, useState } from 'react';

import { useRouter } from '@/i18n/navigation';

import { buildSearchHref } from './search-href';

export interface LocationOption {
  value: string;
  label: string;
  type: LocationType;
  /** Connu quand les lieux viennent de l'API. */
  governorateCode?: string;
}

export interface GovernorateOption {
  code: string;
  label: string;
}

/** Valeur des options « Toute la Tunisie » / « Tous les lieux » (Radix refuse une valeur vide). */
const ALL = 'all';

const GROUP_LABEL_KEYS = {
  AIRPORT: 'airports',
  CITY: 'cities',
  TRAIN_STATION: 'stations',
  PORT: 'ports',
} as const satisfies Record<LocationType, string>;

function FormField({
  id,
  icon: Icon,
  label,
  className,
  children,
}: {
  id: string;
  icon: LucideIcon;
  label: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn('grid min-w-0 gap-1.5', className)}>
      <Label
        htmlFor={id}
        className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
      >
        <Icon className="size-3.5 text-primary" aria-hidden="true" />
        {label}
      </Label>
      {children}
    </div>
  );
}

export function SearchForm({
  options,
  governorates,
  initialGovernorate,
  initialLocation,
  initialPickup,
  initialReturn,
}: {
  options: readonly LocationOption[];
  /** Vide si le référentiel est indisponible : le choix du gouvernorat est alors masqué. */
  governorates: readonly GovernorateOption[];
  initialGovernorate: string | null;
  initialLocation: string | null;
  initialPickup: string | null;
  initialReturn: string | null;
}) {
  const t = useTranslations('client.home.search');
  const tForm = useTranslations('client.search.form');
  const router = useRouter();
  const id = useId();
  const [governorate, setGovernorate] = useState(initialGovernorate ?? ALL);
  const [location, setLocation] = useState(initialLocation ?? ALL);
  const [pickup, setPickup] = useState(initialPickup ?? '');
  const [dropoff, setDropoff] = useState(initialReturn ?? '');
  const [today] = useState(todayKey);
  const withGovernorate = governorates.length > 0;

  const places =
    governorate === ALL
      ? options
      : options.filter((option) => option.governorateCode === governorate);
  const groups = (Object.keys(GROUP_LABEL_KEYS) as LocationType[])
    .map((type) => ({ type, items: places.filter((option) => option.type === type) }))
    .filter((group) => group.items.length > 0);

  const changeGovernorate = (value: string) => {
    setGovernorate(value);
    const place = options.find((option) => option.value === location);
    if (value !== ALL && place !== undefined && place.governorateCode !== value) {
      setLocation(ALL);
    }
  };

  const changeLocation = (value: string) => {
    setLocation(value);
    const code = options.find((option) => option.value === value)?.governorateCode;
    if (code !== undefined && withGovernorate) {
      setGovernorate(code);
    }
  };

  const groupLabel = (type: LocationType) => {
    const key = GROUP_LABEL_KEYS[type];
    return key === 'airports' || key === 'cities' ? t(key) : tForm(key);
  };

  return (
    <form
      role="search"
      aria-label={t('label')}
      onSubmit={(event) => {
        event.preventDefault();
        router.push(
          buildSearchHref(
            {
              governorate: governorate === ALL ? null : governorate,
              location: location === ALL ? null : location,
              pickup,
              dropoff,
            },
            new URLSearchParams(window.location.search),
          ),
          { scroll: false },
        );
      }}
      className={cn(
        'grid grid-cols-2 gap-3 rounded-panel border border-border/80 bg-surface/90 p-3 shadow-elevated backdrop-blur-xl sm:gap-4 sm:p-4 lg:items-end',
        withGovernorate
          ? 'lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)_auto]'
          : 'lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,1fr)_auto]',
      )}
    >
      {withGovernorate && (
        <FormField
          id={`${id}-governorate`}
          icon={Landmark}
          label={tForm('governorate')}
          className="col-span-2 sm:col-span-1"
        >
          <Select name="governorate" value={governorate} onValueChange={changeGovernorate}>
            <SelectTrigger id={`${id}-governorate`} className="h-12 bg-background/60">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="max-h-80 overflow-y-auto">
              <SelectItem value={ALL}>{tForm('allGovernorates')}</SelectItem>
              {governorates.map((option) => (
                <SelectItem key={option.code} value={option.code}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>
      )}

      <FormField
        id={`${id}-location`}
        icon={MapPin}
        label={t('location')}
        className={withGovernorate ? 'col-span-2 sm:col-span-1' : 'col-span-2 lg:col-span-1'}
      >
        <Select name="location" value={location} onValueChange={changeLocation}>
          <SelectTrigger id={`${id}-location`} className="h-12 bg-background/60">
            <SelectValue placeholder={t('locationPlaceholder')} />
          </SelectTrigger>
          <SelectContent className="max-h-80 overflow-y-auto">
            <SelectItem value={ALL}>
              {governorate === ALL ? tForm('allLocations') : tForm('allLocationsIn')}
            </SelectItem>
            {groups.map((group) => (
              <SelectGroup key={group.type}>
                <SelectLabel>{groupLabel(group.type)}</SelectLabel>
                {group.items.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            ))}
          </SelectContent>
        </Select>
      </FormField>

      <FormField id={`${id}-pickup`} icon={CalendarDays} label={t('pickupDate')}>
        <input
          id={`${id}-pickup`}
          name="pickup"
          type="date"
          value={pickup}
          min={today}
          onChange={(event) => {
            setPickup(event.target.value);
            if (dropoff !== '' && event.target.value >= dropoff) {
              setDropoff('');
            }
          }}
          className={cn(inputClassName, 'h-12 bg-background/60')}
        />
      </FormField>

      <FormField id={`${id}-return`} icon={CalendarDays} label={t('returnDate')}>
        <input
          id={`${id}-return`}
          name="return"
          type="date"
          value={dropoff}
          min={pickup === '' ? today : addDays(pickup, 1)}
          onChange={(event) => {
            setDropoff(event.target.value);
          }}
          className={cn(inputClassName, 'h-12 bg-background/60')}
        />
      </FormField>

      <Button
        type="submit"
        variant="cta"
        size="lg"
        className="col-span-2 h-12 shadow-lg shadow-cta/25 transition-all hover:-translate-y-0.5 hover:shadow-xl hover:shadow-cta/30 lg:col-span-1"
      >
        <Search aria-hidden="true" />
        {t('submit')}
      </Button>
    </form>
  );
}
