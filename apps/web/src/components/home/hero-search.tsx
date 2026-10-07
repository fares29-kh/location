'use client';

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
import { toast } from '@drivetn/ui/toaster';
import { CalendarDays, type LucideIcon, MapPin, Search } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { type ReactNode, useId, useState } from 'react';

import { AIRPORTS, CITIES } from './places';

function SearchField({
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
    <div className={cn('grid gap-1.5', className)}>
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

export function HeroSearch() {
  const t = useTranslations('client.home');
  const id = useId();
  const [pickupDate, setPickupDate] = useState('');
  const [returnDate, setReturnDate] = useState('');

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        toast.info(t('search.soonTitle'), { description: t('search.soonText') });
      }}
      aria-label={t('search.label')}
      className="grid grid-cols-2 gap-3 rounded-panel border border-border/80 bg-surface/90 p-3 shadow-elevated ring-1 ring-black/[0.02] backdrop-blur-xl sm:gap-4 sm:p-5"
    >
      <SearchField
        id={`${id}-location`}
        icon={MapPin}
        label={t('search.location')}
        className="col-span-2"
      >
        <Select name="location">
          <SelectTrigger id={`${id}-location`} className="h-12 bg-background/60">
            <SelectValue placeholder={t('search.locationPlaceholder')} />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectLabel>{t('search.airports')}</SelectLabel>
              {AIRPORTS.map((airport) => (
                <SelectItem key={airport.id} value={airport.id}>
                  {t(`places.${airport.id}`)}
                </SelectItem>
              ))}
            </SelectGroup>
            <SelectGroup>
              <SelectLabel>{t('search.cities')}</SelectLabel>
              {CITIES.map((city) => (
                <SelectItem key={city} value={city}>
                  {t(`places.${city}`)}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </SearchField>

      <SearchField id={`${id}-pickup`} icon={CalendarDays} label={t('search.pickupDate')}>
        <input
          id={`${id}-pickup`}
          name="pickupDate"
          type="date"
          value={pickupDate}
          onChange={(event) => {
            setPickupDate(event.target.value);
          }}
          className={cn(inputClassName, 'h-12 bg-background/60')}
        />
      </SearchField>

      <SearchField id={`${id}-return`} icon={CalendarDays} label={t('search.returnDate')}>
        <input
          id={`${id}-return`}
          name="returnDate"
          type="date"
          value={returnDate}
          min={pickupDate === '' ? undefined : pickupDate}
          onChange={(event) => {
            setReturnDate(event.target.value);
          }}
          className={cn(inputClassName, 'h-12 bg-background/60')}
        />
      </SearchField>

      <Button
        type="submit"
        variant="cta"
        size="lg"
        className="h-12 text-base shadow-lg shadow-cta/25 transition-all hover:-translate-y-0.5 hover:shadow-xl hover:shadow-cta/30 col-span-2"
      >
        <Search aria-hidden="true" />
        {t('search.submit')}
      </Button>
    </form>
  );
}
