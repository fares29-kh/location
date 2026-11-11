'use client';

import { FUEL_TYPES } from '@drivetn/types';
import { Button } from '@drivetn/ui/button';
import { Printer } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';

import { useAgencySettings } from '@/lib/agency/queries';
import { printHtml } from '@/lib/agency/print-html';
import type { BookingView } from '@/lib/agency/types';

import { useAgencyFormat } from '../use-agency-format';
import { buildRentalContractHtml, type RentalContractCopy } from './rental-contract';

function useContractCopy(): RentalContractCopy {
  const t = useTranslations('agency.bookingDetail.contract');
  const tFuel = useTranslations('agency.fleet.fuels');
  const locale = useLocale();
  const fuelLabels = Object.fromEntries(FUEL_TYPES.map((fuel) => [fuel, tFuel(fuel)])) as Record<
    string,
    string
  >;

  return {
    lang: locale,
    dir: locale === 'ar' ? 'rtl' : 'ltr',
    documentTitle: t('documentTitle'),
    fileTitle: t('fileTitle'),
    reference: t('reference'),
    lessor: t('lessor'),
    lessee: t('lessee'),
    vehicle: t('vehicle'),
    period: t('period'),
    financials: t('financials'),
    conditions: t('conditions'),
    clausesTitle: t('clausesTitle'),
    blankCin: t('blankCin'),
    blankLicense: t('blankLicense'),
    blankFuel: t('blankFuel'),
    blankCondition: t('blankCondition'),
    brand: t('brand'),
    model: t('model'),
    year: t('year'),
    plate: t('plate'),
    fuel: t('fuel'),
    seats: t('seats'),
    odometer: t('odometer'),
    mileagePolicy: t('mileagePolicy'),
    mileageUnlimited: t('mileageUnlimited'),
    mileageLimit: t('mileageLimit'),
    pickup: t('pickup'),
    return: t('return'),
    dailyRate: t('dailyRate'),
    days: t('days'),
    total: t('total'),
    deposit: t('deposit'),
    paid: t('paid'),
    balance: t('balance'),
    minAge: t('minAge'),
    minLicense: t('minLicense'),
    freeCancellation: t('freeCancellation'),
    noFreeCancellation: t('noFreeCancellation'),
    hoursBefore: t('hoursBefore'),
    phone: t('phone'),
    email: t('email'),
    city: t('city'),
    address: t('address'),
    note: t('note'),
    lessorSign: t('lessorSign'),
    lesseeSign: t('lesseeSign'),
    date: t('date'),
    agreement: t('agreement'),
    clauses: [t('clause1'), t('clause2'), t('clause3'), t('clause4'), t('clause5'), t('clause6')],
    generated: t('generated'),
    fuelLabels,
  };
}

export function PrintRentalContractButton({ booking }: { booking: BookingView }) {
  const t = useTranslations('agency.bookingDetail');
  const format = useAgencyFormat();
  const copy = useContractCopy();
  const settings = useAgencySettings();
  const ready = settings.data !== undefined;

  return (
    <Button
      type="button"
      variant="secondary"
      disabled={!ready}
      onClick={() => {
        if (settings.data === undefined) {
          return;
        }
        printHtml(
          buildRentalContractHtml({
            booking,
            settings: settings.data,
            format,
            copy: {
              ...copy,
              generated: t('contract.generatedAt', { date: format.dateTime(new Date()) }),
            },
          }),
        );
      }}
    >
      <Printer className="size-4" aria-hidden="true" />
      {t('printContract')}
    </Button>
  );
}
