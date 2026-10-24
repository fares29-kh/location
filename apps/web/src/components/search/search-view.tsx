'use client';

import { rangesOverlap } from '@drivetn/types';
import { Alert } from '@drivetn/ui/alert';
import { Button } from '@drivetn/ui/button';
import { EmptyState } from '@drivetn/ui/empty-state';
import { cn } from '@drivetn/ui/lib/cn';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@drivetn/ui/select';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@drivetn/ui/sheet';
import {
  ArrowUpDown,
  CalendarDays,
  MapPin,
  RotateCcw,
  SearchX,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useCallback, useEffect, useId, useMemo, useState } from 'react';

import { PageHero } from '@/components/client/page-hero';
import { useCategoryLabel, useVehicleCategories } from '@/components/vehicle-categories';
import { Link, useRouter } from '@/i18n/navigation';
import { ActiveFilters, activeFilterKey, useActiveFilterLabel } from './active-filters';
import { BookingDialog } from './booking-dialog';
import {
  brandGroups,
  countActiveFilters,
  DEFAULT_FILTERS,
  filterOffers,
  listActiveFilters,
  type OfferFilters,
  removeFilter,
  type RentalDates,
  rentalDays,
  type SearchOffer,
  SORT_OPTIONS,
  type SortOption,
  sortOffers,
  type VehicleCategory,
  writeSearchFilters,
} from './catalog';
import { OfferCard } from './offer-card';
import { type CountWith, SearchFilters } from './search-filters';
import { type GovernorateOption, type LocationOption, SearchForm } from './search-form';

function formatDate(value: string, locale: string): string {
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat(`${locale}-TN-u-nu-latn`, {
        day: 'numeric',
        month: 'short',
        timeZone: 'UTC',
      }).format(date);
}

export function SearchView({
  locationOptions,
  governorateOptions,
  initialGovernorate,
  initialLocation,
  initialPickup,
  initialReturn,
  initialFilters,
  initialSort,
  initialBooking,
  offers,
  dates,
  signedIn,
}: {
  locationOptions: readonly LocationOption[];
  governorateOptions: readonly GovernorateOption[];
  initialGovernorate: string | null;
  initialLocation: string | null;
  initialPickup: string | null;
  initialReturn: string | null;
  initialFilters: OfferFilters;
  initialSort: SortOption;
  /** Offre à rouvrir après la connexion (paramètre `book`). */
  initialBooking: string | null;
  /** `null` si la recherche n'a pas pu joindre l'API. */
  offers: readonly SearchOffer[] | null;
  /** Dates réservables issues de la recherche. */
  dates: RentalDates | null;
  signedIn: boolean;
}) {
  const t = useTranslations('client.search');
  const categories = useVehicleCategories();
  const categoryLabel = useCategoryLabel();
  const tCommon = useTranslations('common');
  const locale = useLocale();
  const router = useRouter();
  const id = useId();
  const filterLabel = useActiveFilterLabel();
  const [filters, setFilters] = useState<OfferFilters>(initialFilters);
  const [sort, setSort] = useState<SortOption>(initialSort);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [booking, setBooking] = useState<SearchOffer | null>(() =>
    signedIn ? (offers?.find((offer) => offer.id === initialBooking) ?? null) : null,
  );

  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.has('book')) {
      url.searchParams.delete('book');
      window.history.replaceState(window.history.state, '', url);
    }
  }, []);

  // Les filtres vivent dans l'URL (partage, retour arrière, reprise après connexion) sans
  // relancer la recherche côté serveur ; `offers` resynchronise après une nouvelle recherche.
  useEffect(() => {
    const url = new URL(window.location.href);
    writeSearchFilters(url.searchParams, filters, sort);
    url.search = url.searchParams.toString().replaceAll('%2C', ',');
    if (url.href !== window.location.href) {
      window.history.replaceState(window.history.state, '', url);
    }
  }, [filters, sort, offers]);

  const placeLabel =
    locationOptions.find((option) => option.value === initialLocation)?.label ??
    governorateOptions.find((option) => option.code === initialGovernorate)?.label ??
    null;
  const days = dates === null ? null : rentalDays(dates.pickup, dates.dropoff);
  const activeFilters = countActiveFilters(filters);
  const available = useMemo(() => {
    const list = offers ?? [];
    if (dates === null) {
      return list;
    }
    return list.filter((offer) => !rangesOverlap(dates.pickup, dates.dropoff, offer.unavailable));
  }, [offers, dates]);
  const brands = useMemo(() => brandGroups(available), [available]);

  const results = useMemo(
    () => sortOffers(filterOffers(available, filters), sort),
    [available, filters, sort],
  );

  const countWith = useCallback<CountWith>(
    (patch) => filterOffers(available, { ...filters, ...patch }).length,
    [available, filters],
  );

  const suggestions = useMemo(
    () =>
      results.length > 0
        ? []
        : listActiveFilters(filters)
            .map((filter) => ({
              filter,
              count: filterOffers(available, removeFilter(filters, filter)).length,
            }))
            .filter((suggestion) => suggestion.count > 0)
            .sort((a, b) => b.count - a.count)
            .slice(0, 3),
    [available, filters, results.length],
  );

  const startBooking = (offer: SearchOffer) => {
    if (signedIn) {
      setBooking(offer);
      return;
    }
    const next = new URL(window.location.href);
    next.searchParams.set('book', offer.id);
    router.push({ pathname: '/signup', query: { next: `${next.pathname}${next.search}` } });
  };

  const resetFilters = () => {
    setFilters(DEFAULT_FILTERS);
  };

  const toggleQuickCategory = (category: VehicleCategory) => {
    setFilters((current) => ({
      ...current,
      categories: current.categories.includes(category)
        ? current.categories.filter((item) => item !== category)
        : [...current.categories, category],
    }));
  };

  return (
    <>
      <PageHero
        id="search-title"
        icon={SlidersHorizontal}
        eyebrow={t('eyebrow')}
        title={t('title')}
        subtitle={t('subtitle')}
      >
        <SearchForm
          options={locationOptions}
          governorates={governorateOptions}
          initialGovernorate={initialGovernorate}
          initialLocation={initialLocation}
          initialPickup={initialPickup}
          initialReturn={initialReturn}
        />
      </PageHero>

      <div className="container grid gap-6 py-8 sm:py-10 lg:grid-cols-[17rem_minmax(0,1fr)] lg:gap-8">
        <aside aria-labelledby={`${id}-filters`} className="hidden lg:block">
          <div className="sticky top-24 grid max-h-[calc(100dvh-7rem)] gap-4 overflow-y-auto overscroll-contain rounded-panel border border-border bg-surface p-5 shadow-soft">
            <div className="flex items-center justify-between gap-2">
              <h2 id={`${id}-filters`} className="flex items-center gap-2 text-base font-bold">
                <SlidersHorizontal className="size-4 text-primary" aria-hidden="true" />
                {t('filters.title')}
              </h2>
              {activeFilters > 0 && (
                <Button variant="link" size="sm" onClick={resetFilters}>
                  {t('filters.reset')}
                </Button>
              )}
            </div>
            <SearchFilters
              filters={filters}
              onChange={setFilters}
              countWith={countWith}
              brands={brands}
            />
          </div>
        </aside>

        <section aria-labelledby={`${id}-results`} className="grid content-start gap-5">
          {offers === null ? (
            <Alert tone="danger" title={t('unavailableTitle')}>
              {t('unavailableText')}
            </Alert>
          ) : (
            dates === null && <Alert title={t('datesHintTitle')}>{t('datesHintText')}</Alert>
          )}

          {!signedIn && (
            <Alert
              title={t('accountRequiredTitle')}
              action={
                <Button asChild size="sm">
                  <Link href="/signup">{t('accountRequiredAction')}</Link>
                </Button>
              }
            >
              {t('accountRequiredText')}
            </Alert>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <div className="grid min-w-0 flex-1 gap-1">
              <h2
                id={`${id}-results`}
                aria-live="polite"
                className="flex flex-wrap items-baseline gap-x-2 text-xl font-bold"
              >
                {t('results', { count: results.length })}
                {activeFilters > 0 && available.length > 0 && (
                  <span className="text-sm font-medium text-muted-foreground">
                    {t('filteredFrom', { total: available.length })}
                  </span>
                )}
              </h2>
              <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <MapPin className="size-4 text-primary" aria-hidden="true" />
                  {placeLabel ?? t('summary.anywhere')}
                </span>
                <span className="flex items-center gap-1.5">
                  <CalendarDays className="size-4 text-primary" aria-hidden="true" />
                  {days !== null && initialPickup !== null && initialReturn !== null
                    ? t('summary.dates', {
                        from: formatDate(initialPickup, locale),
                        to: formatDate(initialReturn, locale),
                        count: days,
                      })
                    : t('summary.anyDates')}
                </span>
              </p>
            </div>

            <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
              <SheetTrigger asChild>
                <Button variant="secondary" className="lg:hidden">
                  <SlidersHorizontal aria-hidden="true" />
                  {t('filters.title')}
                  {activeFilters > 0 && (
                    <span className="flex size-5 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                      {activeFilters}
                    </span>
                  )}
                </Button>
              </SheetTrigger>
              <SheetContent side="bottom" closeLabel={tCommon('close')}>
                <SheetHeader>
                  <SheetTitle>{t('filters.title')}</SheetTitle>
                  <SheetDescription>{t('filters.description')}</SheetDescription>
                </SheetHeader>
                <SearchFilters
                  filters={filters}
                  onChange={setFilters}
                  countWith={countWith}
                  brands={brands}
                />
                <div className="sticky -bottom-[max(1.5rem,env(safe-area-inset-bottom))] -mx-6 -mb-[max(1.5rem,env(safe-area-inset-bottom))] grid grid-cols-2 gap-2 border-t border-border bg-surface px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-4">
                  <Button variant="secondary" onClick={resetFilters} disabled={activeFilters === 0}>
                    <RotateCcw aria-hidden="true" />
                    {t('filters.reset')}
                  </Button>
                  <Button
                    onClick={() => {
                      setFiltersOpen(false);
                    }}
                  >
                    {t('filters.show', { count: results.length })}
                  </Button>
                </div>
              </SheetContent>
            </Sheet>

            <Select
              value={sort}
              onValueChange={(value) => {
                setSort(SORT_OPTIONS.find((option) => option === value) ?? 'recommended');
              }}
            >
              <SelectTrigger
                aria-label={t('sort.label')}
                className="h-11 w-auto min-w-[11rem] gap-2"
              >
                <ArrowUpDown className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent align="end">
                {SORT_OPTIONS.map((option) => (
                  <SelectItem key={option} value={option}>
                    {t(`sort.${option}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <ul
            aria-label={t('filters.quickLabel')}
            className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0"
          >
            {categories.map(({ slug: category }) => {
              const active = filters.categories.includes(category);
              const count = countWith({ categories: [category] });
              return (
                <li key={category} className="shrink-0">
                  <button
                    type="button"
                    aria-pressed={active}
                    disabled={count === 0 && !active}
                    onClick={() => {
                      toggleQuickCategory(category);
                    }}
                    className={cn(
                      'inline-flex h-9 items-center gap-2 rounded-full border px-4 text-sm font-medium transition-colors',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                      'disabled:cursor-not-allowed disabled:opacity-50',
                      active
                        ? 'border-primary bg-primary-soft text-primary-soft-foreground'
                        : 'border-border bg-surface text-muted-foreground enabled:hover:border-primary/40 enabled:hover:text-foreground',
                    )}
                  >
                    {categoryLabel(category)}
                    <span className="text-xs tabular-nums opacity-70">{count}</span>
                  </button>
                </li>
              );
            })}
          </ul>

          <ActiveFilters filters={filters} onChange={setFilters} onReset={resetFilters} />

          {results.length > 0 ? (
            <ul className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {results.map((offer) => (
                <li key={offer.id} className="grid">
                  <OfferCard offer={offer} days={days} onBook={startBooking} />
                </li>
              ))}
            </ul>
          ) : available.length === 0 ? (
            offers !== null && (
              <EmptyState
                icon={SearchX}
                title={t('noOffers.title')}
                description={t('noOffers.text')}
                className="bg-surface py-16"
                action={
                  <Button asChild variant="secondary">
                    <Link href="/search" onClick={resetFilters}>
                      <RotateCcw aria-hidden="true" />
                      {t('noOffers.action')}
                    </Link>
                  </Button>
                }
              />
            )
          ) : (
            <EmptyState
              icon={SearchX}
              title={t('empty.title')}
              description={t('empty.text')}
              className="bg-surface py-16"
              action={
                <div className="grid justify-items-center gap-5">
                  {suggestions.length > 0 && (
                    <div className="grid justify-items-center gap-2">
                      <p className="text-sm font-medium">{t('empty.tryWithout')}</p>
                      <ul className="flex flex-wrap justify-center gap-2">
                        {suggestions.map(({ filter, count }) => (
                          <li key={activeFilterKey(filter)}>
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => {
                                setFilters(removeFilter(filters, filter));
                              }}
                            >
                              <X aria-hidden="true" />
                              {filterLabel(filter)}
                              <span className="text-xs font-semibold tabular-nums text-success">
                                {t('empty.more', { count })}
                              </span>
                            </Button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <Button variant="link" size="sm" onClick={resetFilters}>
                    <RotateCcw aria-hidden="true" />
                    {t('empty.action')}
                  </Button>
                </div>
              }
            />
          )}
        </section>
      </div>

      {booking !== null && (
        <BookingDialog
          key={booking.id}
          offer={booking}
          dates={dates}
          location={initialLocation}
          locationOptions={locationOptions}
          onOpenChange={(open) => {
            if (!open) {
              setBooking(null);
            }
          }}
        />
      )}
    </>
  );
}
