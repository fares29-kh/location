'use client';

import { formatMillimes } from '@drivetn/types';
import { useLocale } from 'next-intl';
import { useMemo } from 'react';

import { AGENCY_TIME_ZONE } from '@/lib/agency/dates';

const RELATIVE_UNITS: readonly [Intl.RelativeTimeFormatUnit, number][] = [
  ['year', 365 * 86_400],
  ['month', 30 * 86_400],
  ['week', 7 * 86_400],
  ['day', 86_400],
  ['hour', 3_600],
  ['minute', 60],
];

/**
 * Formatage des dates, montants et nombres du portail agence : fuseau `Africa/Tunis`
 * et chiffres latins dans les trois langues.
 */
export function useAgencyFormat() {
  const locale = useLocale();

  return useMemo(() => {
    const tag = `${locale}-TN-u-nu-latn`;
    const make = (options: Intl.DateTimeFormatOptions) =>
      new Intl.DateTimeFormat(tag, { timeZone: AGENCY_TIME_ZONE, ...options });
    const dayMonth = make({ day: 'numeric', month: 'short' });
    const fullDate = make({ day: 'numeric', month: 'short', year: 'numeric' });
    const weekdayDate = make({ weekday: 'long', day: 'numeric', month: 'long' });
    const time = make({ hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
    const monthShort = make({ month: 'short' });
    const monthLong = make({ month: 'long', year: 'numeric' });
    const weekdayShort = make({ weekday: 'short' });
    const relative = new Intl.RelativeTimeFormat(tag, { numeric: 'auto' });
    const integer = new Intl.NumberFormat(tag);
    const percent = new Intl.NumberFormat(tag, { style: 'percent', maximumFractionDigits: 0 });
    const signedPercent = new Intl.NumberFormat(tag, {
      style: 'percent',
      maximumFractionDigits: 0,
      signDisplay: 'exceptZero',
    });
    const decimal = new Intl.NumberFormat(tag, {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    });

    const toDate = (value: Date | string) => (typeof value === 'string' ? new Date(value) : value);

    return {
      locale,
      money: (millimes: number) => formatMillimes(millimes, locale),
      integer: (value: number) => integer.format(value),
      percent: (ratio: number) => percent.format(ratio),
      /** Variation signée (« +12 % », « −8 % »), ordonnée correctement en arabe. */
      signedPercent: (ratio: number) => signedPercent.format(ratio),
      decimal: (value: number) => decimal.format(value),
      dayMonth: (value: Date | string) => dayMonth.format(toDate(value)),
      date: (value: Date | string) => fullDate.format(toDate(value)),
      weekdayDate: (value: Date | string) => weekdayDate.format(toDate(value)),
      time: (value: Date | string) => time.format(toDate(value)),
      dateTime: (value: Date | string) =>
        `${fullDate.format(toDate(value))} · ${time.format(toDate(value))}`,
      shortDateTime: (value: Date | string) =>
        `${dayMonth.format(toDate(value))} · ${time.format(toDate(value))}`,
      monthShort: (value: Date | string) => monthShort.format(toDate(value)),
      monthLong: (value: Date | string) => monthLong.format(toDate(value)),
      weekdayShort: (value: Date | string) => weekdayShort.format(toDate(value)),
      /** « il y a 3 heures », « dans 2 jours »… */
      relative: (value: Date | string, now: Date = new Date()) => {
        const seconds = (toDate(value).getTime() - now.getTime()) / 1000;
        for (const [unit, size] of RELATIVE_UNITS) {
          if (Math.abs(seconds) >= size) {
            return relative.format(Math.round(seconds / size), unit);
          }
        }
        return relative.format(0, 'minute');
      },
    };
  }, [locale]);
}

export type AgencyFormat = ReturnType<typeof useAgencyFormat>;
