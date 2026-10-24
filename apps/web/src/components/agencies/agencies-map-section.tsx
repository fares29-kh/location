'use client';

import type { GeoPoint, PublicAgency } from '@drivetn/types';
import { Button } from '@drivetn/ui/button';
import { EmptyState } from '@drivetn/ui/empty-state';
import { inputClassName } from '@drivetn/ui/input';
import { cn } from '@drivetn/ui/lib/cn';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@drivetn/ui/select';
import { toast } from '@drivetn/ui/toaster';
import {
  Building2,
  Info,
  LoaderCircle,
  LocateFixed,
  MapPinned,
  RotateCcw,
  Search,
  SearchX,
  Star,
  WifiOff,
  X,
  Zap,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import {
  type ReactNode,
  useCallback,
  useDeferredValue,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react';

import { SectionHeading } from '@/components/home/section-heading';

import { AgenciesMapCanvas } from './agencies-map-canvas';
import { AgencyListItem, AgencyPopupCard } from './agency-card';
import {
  countDirectoryFilters,
  DEFAULT_DIRECTORY_FILTERS,
  type DirectoryFilters,
  distanceKm,
  filterAgencies,
  prefersReducedMotion,
  sortAgencies,
} from './agency-directory';

export interface GovernorateOption {
  code: string;
  name: string;
}

const ALL_GOVERNORATES = 'all';

function FilterChip({
  active,
  onClick,
  icon,
  children,
  disabled,
}: {
  active: boolean;
  onClick: () => void;
  icon: ReactNode;
  children: ReactNode;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'inline-flex h-11 shrink-0 items-center gap-2 rounded-full border px-4 text-sm font-medium transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60',
        '[&_svg]:size-4 [&_svg]:shrink-0',
        active
          ? 'border-primary bg-primary-soft text-primary-soft-foreground'
          : 'border-border bg-surface text-muted-foreground hover:border-primary/40 hover:text-foreground',
      )}
    >
      {icon}
      {children}
    </button>
  );
}

export function AgenciesMapSection({
  agencies,
  governorates,
  signedIn,
}: {
  /** `null` si l'annuaire n'a pas pu être chargé. */
  agencies: readonly PublicAgency[] | null;
  governorates: readonly GovernorateOption[];
  /** Les numéros ne sont affichés que pour un client connecté. */
  signedIn: boolean;
}) {
  const t = useTranslations('client.agencies.map');
  const id = useId();
  const listRef = useRef<HTMLUListElement>(null);
  const mapRef = useRef<HTMLDivElement>(null);

  const [filters, setFilters] = useState<DirectoryFilters>(DEFAULT_DIRECTORY_FILTERS);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [userPosition, setUserPosition] = useState<GeoPoint | null>(null);
  const [locating, setLocating] = useState(false);
  const deferredQuery = useDeferredValue(filters.query);

  const governorateName = useMemo(() => {
    const names = new Map(governorates.map((governorate) => [governorate.code, governorate.name]));
    return (code: string) => names.get(code) ?? code;
  }, [governorates]);

  const all = useMemo(() => agencies ?? [], [agencies]);
  const filtered = useMemo(
    () => filterAgencies(all, { ...filters, query: deferredQuery }, governorateName),
    [all, filters, deferredQuery, governorateName],
  );
  const sorted = useMemo(() => sortAgencies(filtered, userPosition), [filtered, userPosition]);

  const governorateOptions = useMemo(() => {
    const counts = new Map<string, number>();
    for (const agency of all) {
      counts.set(agency.governorateCode, (counts.get(agency.governorateCode) ?? 0) + 1);
    }
    return governorates
      .filter((governorate) => counts.has(governorate.code))
      .map((governorate) => ({ ...governorate, count: counts.get(governorate.code) ?? 0 }));
  }, [all, governorates]);

  const activeSelectedId = filtered.some((agency) => agency.id === selectedId) ? selectedId : null;
  const activeFilters = countDirectoryFilters(filters);

  const selectFromMap = useCallback((agencyId: string | null) => {
    setSelectedId(agencyId);
    const list = listRef.current;
    const item =
      agencyId === null ? null : list?.querySelector(`[data-agency-id="${CSS.escape(agencyId)}"]`);
    if (list && item) {
      // Défile la liste seule : scrollIntoView ferait aussi défiler la page.
      const listBox = list.getBoundingClientRect();
      const itemBox = item.getBoundingClientRect();
      list.scrollBy({
        left: itemBox.left - listBox.left - (listBox.width - itemBox.width) / 2,
        top: itemBox.top - listBox.top - (listBox.height - itemBox.height) / 2,
        behavior: prefersReducedMotion() ? 'auto' : 'smooth',
      });
    }
  }, []);

  const selectFromList = (agencyId: string) => {
    setSelectedId((current) => (current === agencyId ? null : agencyId));
    const map = mapRef.current;
    if (map !== null && map.getBoundingClientRect().top < 0) {
      map.scrollIntoView({ block: 'start', behavior: 'smooth' });
    }
  };

  const locate = useCallback(() => {
    if (!('geolocation' in navigator)) {
      toast.error(t('locateError'));
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setUserPosition({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
        setLocating(false);
      },
      () => {
        toast.error(t('locateError'));
        setLocating(false);
      },
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 5 * 60_000 },
    );
  }, [t]);

  const resetFilters = () => {
    setFilters(DEFAULT_DIRECTORY_FILTERS);
  };

  const distanceTo = (agency: PublicAgency) =>
    userPosition === null ? null : distanceKm(userPosition, agency);

  const renderPopup = (agency: PublicAgency) => (
    <AgencyPopupCard
      agency={agency}
      governorate={governorateName(agency.governorateCode)}
      distanceKm={distanceTo(agency)}
      signedIn={signedIn}
      onClose={() => {
        setSelectedId(null);
      }}
    />
  );

  return (
    <section
      id="carte"
      aria-labelledby={`${id}-title`}
      className="relative isolate scroll-mt-20 overflow-hidden border-b border-border py-16 sm:py-20"
    >
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-x-0 top-0 h-2/3 bg-gradient-to-b from-primary-soft/40 to-transparent" />
        <div className="absolute -end-40 top-24 size-[28rem] rounded-full bg-info/10 blur-3xl" />
      </div>

      <div className="container grid gap-8">
        <SectionHeading
          id={`${id}-title`}
          align="start"
          eyebrow={t('eyebrow')}
          title={t('title')}
          text={t('text')}
        />

        {agencies === null ? (
          <EmptyState
            icon={WifiOff}
            title={t('unavailableTitle')}
            description={t('unavailableText')}
            className="bg-surface"
          />
        ) : agencies.length === 0 ? (
          <EmptyState
            icon={Building2}
            title={t('noAgenciesTitle')}
            description={t('noAgenciesText')}
            className="bg-surface"
          />
        ) : (
          <div className="grid gap-4">
            <div className="flex flex-col gap-3 rounded-panel border border-border bg-surface/90 p-3 shadow-soft backdrop-blur lg:flex-row lg:items-center">
              <div className="relative min-w-0 flex-1">
                <label htmlFor={`${id}-search`} className="sr-only">
                  {t('searchLabel')}
                </label>
                <Search
                  className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                  aria-hidden="true"
                />
                <input
                  id={`${id}-search`}
                  type="search"
                  value={filters.query}
                  onChange={(event) => {
                    setFilters((current) => ({ ...current, query: event.target.value }));
                  }}
                  placeholder={t('searchPlaceholder')}
                  className={cn(inputClassName, 'ps-10 [&::-webkit-search-cancel-button]:hidden')}
                />
                {filters.query !== '' && (
                  <button
                    type="button"
                    aria-label={t('clearSearch')}
                    onClick={() => {
                      setFilters((current) => ({ ...current, query: '' }));
                    }}
                    className="absolute end-2 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground hover:bg-surface-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <X className="size-4" aria-hidden="true" />
                  </button>
                )}
              </div>

              <Select
                value={filters.governorate ?? ALL_GOVERNORATES}
                onValueChange={(value) => {
                  setFilters((current) => ({
                    ...current,
                    governorate: value === ALL_GOVERNORATES ? null : value,
                  }));
                }}
              >
                <SelectTrigger aria-label={t('governorateLabel')} className="lg:w-60">
                  <span className="flex min-w-0 flex-1 items-center gap-2">
                    <MapPinned className="size-4 shrink-0 text-primary" aria-hidden="true" />
                    <span className="truncate">
                      <SelectValue />
                    </span>
                  </span>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_GOVERNORATES}>{t('allGovernorates')}</SelectItem>
                  {governorateOptions.map((governorate) => (
                    <SelectItem key={governorate.code} value={governorate.code}>
                      {governorate.name} ({governorate.count})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <div className="-mx-3 flex gap-2 overflow-x-auto px-3 [scrollbar-width:none] lg:mx-0 lg:px-0">
                <FilterChip
                  active={userPosition !== null}
                  disabled={locating}
                  onClick={() => {
                    if (userPosition === null) {
                      locate();
                    } else {
                      setUserPosition(null);
                    }
                  }}
                  icon={
                    locating ? (
                      <LoaderCircle className="animate-spin" aria-hidden="true" />
                    ) : (
                      <LocateFixed aria-hidden="true" />
                    )
                  }
                >
                  {t('nearMe')}
                </FilterChip>
                <FilterChip
                  active={filters.instantOnly}
                  onClick={() => {
                    setFilters((current) => ({ ...current, instantOnly: !current.instantOnly }));
                  }}
                  icon={<Zap aria-hidden="true" />}
                >
                  {t('instantOnly')}
                </FilterChip>
                <FilterChip
                  active={filters.topRated}
                  onClick={() => {
                    setFilters((current) => ({ ...current, topRated: !current.topRated }));
                  }}
                  icon={<Star aria-hidden="true" />}
                >
                  {t('topRated')}
                </FilterChip>
              </div>
            </div>

            <div className="grid gap-4 lg:h-[42rem] lg:grid-cols-[24rem_minmax(0,1fr)]">
              <div className="order-2 grid min-h-0 content-start gap-3 lg:order-1 lg:flex lg:flex-col">
                <div className="flex items-center justify-between gap-2 px-1">
                  <p aria-live="polite" className="text-sm font-semibold">
                    {filtered.length === 0
                      ? t('noResults')
                      : t('results', { count: filtered.length })}
                    {userPosition !== null && filtered.length > 0 && (
                      <span className="font-normal text-muted-foreground">
                        {' '}
                        · {t('byDistance')}
                      </span>
                    )}
                  </p>
                  {activeFilters > 0 && (
                    <Button variant="link" size="sm" onClick={resetFilters}>
                      <RotateCcw aria-hidden="true" />
                      {t('reset')}
                    </Button>
                  )}
                </div>

                {sorted.length === 0 ? (
                  <EmptyState
                    icon={SearchX}
                    title={t('emptyTitle')}
                    description={t('emptyText')}
                    className="bg-surface lg:flex-1"
                    action={
                      <Button variant="secondary" size="sm" onClick={resetFilters}>
                        <RotateCcw aria-hidden="true" />
                        {t('reset')}
                      </Button>
                    }
                  />
                ) : (
                  <ul
                    ref={listRef}
                    aria-label={t('listLabel')}
                    className="-mx-4 flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:thin] sm:mx-0 sm:px-0 lg:min-h-0 lg:flex-1 lg:snap-none lg:flex-col lg:overflow-y-auto lg:overflow-x-hidden lg:overscroll-contain lg:p-1"
                  >
                    {sorted.map((agency) => (
                      <li
                        key={agency.id}
                        className="w-[85%] max-w-sm shrink-0 snap-start sm:w-80 lg:w-auto lg:max-w-none"
                      >
                        <AgencyListItem
                          agency={agency}
                          governorate={governorateName(agency.governorateCode)}
                          distanceKm={distanceTo(agency)}
                          selected={agency.id === activeSelectedId}
                          highlighted={agency.id === hoveredId}
                          onSelect={selectFromList}
                          onHover={setHoveredId}
                        />
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div
                ref={mapRef}
                className="order-1 flex scroll-mt-24 flex-col gap-2 lg:order-2 lg:min-h-0"
              >
                <AgenciesMapCanvas
                  className="h-[28rem] sm:h-[34rem] lg:h-auto lg:min-h-0 lg:flex-1"
                  agencies={filtered}
                  selectedId={activeSelectedId}
                  highlightedId={hoveredId}
                  userPosition={userPosition}
                  locating={locating}
                  onSelect={selectFromMap}
                  onHover={setHoveredId}
                  onLocate={locate}
                  renderPopup={renderPopup}
                />
                <p className="flex items-start gap-1.5 px-1 text-xs text-muted-foreground">
                  <Info className="mt-px size-3.5 shrink-0 text-primary" aria-hidden="true" />
                  {t('approximate')}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
