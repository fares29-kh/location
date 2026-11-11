import { formatNationalPhone, pickLocalized, type AgencySettings } from '@drivetn/types';

import type { BookingView } from '@/lib/agency/types';
import { escapeHtml } from '@/lib/agency/print-html';

import type { AgencyFormat } from '../use-agency-format';
import { customerName } from '../people';

export interface RentalContractCopy {
  lang: string;
  dir: 'ltr' | 'rtl';
  documentTitle: string;
  fileTitle: string;
  reference: string;
  lessor: string;
  lessee: string;
  vehicle: string;
  period: string;
  financials: string;
  conditions: string;
  clausesTitle: string;
  blankCin: string;
  blankLicense: string;
  blankFuel: string;
  blankCondition: string;
  brand: string;
  model: string;
  year: string;
  plate: string;
  fuel: string;
  seats: string;
  odometer: string;
  mileagePolicy: string;
  mileageUnlimited: string;
  mileageLimit: string;
  pickup: string;
  return: string;
  dailyRate: string;
  days: string;
  total: string;
  deposit: string;
  paid: string;
  balance: string;
  minAge: string;
  minLicense: string;
  freeCancellation: string;
  noFreeCancellation: string;
  hoursBefore: string;
  phone: string;
  email: string;
  city: string;
  address: string;
  note: string;
  lessorSign: string;
  lesseeSign: string;
  date: string;
  agreement: string;
  clauses: readonly string[];
  generated: string;
  fuelLabels: Record<string, string>;
}

function row(label: string, value: string): string {
  return `<tr><th>${escapeHtml(label)}</th><td>${escapeHtml(value)}</td></tr>`;
}

function blank(label: string): string {
  return `<tr><th>${escapeHtml(label)}</th><td class="blank">……………………………………</td></tr>`;
}

function section(title: string, body: string): string {
  return `<section><h2>${escapeHtml(title)}</h2>${body}</section>`;
}

function orDash(value: string | null | undefined): string {
  const trimmed = value?.trim() ?? '';
  return trimmed.length > 0 ? trimmed : '—';
}

/** Document HTML A4 du contrat de location, prérempli depuis la réservation. */
export function buildRentalContractHtml(input: {
  booking: BookingView;
  settings: AgencySettings;
  format: AgencyFormat;
  copy: RentalContractCopy;
}): string {
  const { booking, settings, format, copy } = input;
  const profile = settings.profile;
  const conditions = settings.conditions;
  const vehicle = booking.vehicle;
  const customer = booking.customer;
  const locale = format.locale;
  const plate = orDash(vehicle.plateNumber);
  const mileagePolicy =
    vehicle.mileageLimitKm === null
      ? copy.mileageUnlimited
      : copy.mileageLimit.replace('{km}', format.integer(vehicle.mileageLimitKm));
  const cancellation =
    conditions.freeCancellationHours === 0
      ? copy.noFreeCancellation
      : copy.hoursBefore.replace('{count}', format.integer(conditions.freeCancellationHours));
  const email = orDash(customer.email);
  const city = orDash(customer.city);
  const agencyEmail = orDash(profile.email);
  const agencyAddress = orDash(profile.address);
  const note =
    booking.customerNote === null || booking.customerNote.trim().length === 0
      ? null
      : booking.customerNote.trim();

  const lessorTable = `<table class="kv">
    ${row(copy.lessor, profile.name)}
    ${row(copy.address, agencyAddress)}
    ${row(copy.phone, formatNationalPhone(profile.phone))}
    ${row(copy.email, agencyEmail)}
  </table>`;

  const lesseeTable = `<table class="kv">
    ${row(copy.lessee, customerName(customer))}
    ${row(copy.phone, formatNationalPhone(customer.phone))}
    ${row(copy.email, email)}
    ${row(copy.city, city)}
    ${blank(copy.blankCin)}
    ${blank(copy.blankLicense)}
  </table>`;

  const vehicleTable = `<table class="kv">
    ${row(copy.brand, vehicle.brand)}
    ${row(copy.model, vehicle.model)}
    ${row(copy.year, format.integer(vehicle.year))}
    ${row(copy.plate, plate)}
    ${row(copy.fuel, copy.fuelLabels[vehicle.fuel] ?? vehicle.fuel)}
    ${row(copy.seats, format.integer(vehicle.seats))}
    ${row(copy.odometer, `${format.integer(vehicle.mileageKm)} km`)}
    ${blank(copy.blankFuel)}
    ${blank(copy.blankCondition)}
  </table>`;

  const periodTable = `<table class="kv">
    ${row(copy.pickup, `${format.dateTime(booking.pickupAt)} · ${pickLocalized(booking.pickupLocation, locale)}`)}
    ${row(copy.return, `${format.dateTime(booking.returnAt)} · ${pickLocalized(booking.returnLocation, locale)}`)}
    ${row(copy.days, format.integer(booking.days))}
    ${row(copy.mileagePolicy, mileagePolicy)}
  </table>`;

  const moneyTable = `<table class="kv">
    ${row(copy.dailyRate, format.money(booking.dailyRateMillimes))}
    ${row(copy.total, format.money(booking.totalMillimes))}
    ${row(copy.deposit, format.money(booking.depositMillimes))}
    ${row(copy.paid, format.money(booking.payment.paidMillimes))}
    ${row(copy.balance, format.money(booking.payment.balanceMillimes))}
  </table>`;

  const conditionsTable = `<table class="kv">
    ${row(copy.minAge, format.integer(conditions.minDriverAge))}
    ${row(copy.minLicense, format.integer(conditions.minLicenseYears))}
    ${row(copy.freeCancellation, cancellation)}
  </table>`;

  const clauses = `<ol class="clauses">${copy.clauses
    .map((clause) => `<li>${escapeHtml(clause)}</li>`)
    .join('')}</ol>`;

  const noteBlock =
    note === null
      ? ''
      : `<p class="note"><strong>${escapeHtml(copy.note)} :</strong> ${escapeHtml(note)}</p>`;

  return `<!DOCTYPE html>
<html lang="${escapeHtml(copy.lang)}" dir="${copy.dir}">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(copy.fileTitle)}</title>
<style>
  @page { size: A4; margin: 14mm; }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    color: #111;
    font: 11pt/1.45 "Segoe UI", "Helvetica Neue", Arial, sans-serif;
  }
  h1 { margin: 0 0 4px; font-size: 18pt; }
  h2 {
    margin: 18px 0 8px;
    padding-bottom: 4px;
    border-bottom: 1px solid #ccc;
    font-size: 12pt;
  }
  .brand { margin: 0; color: #555; font-size: 10pt; letter-spacing: 0.04em; text-transform: uppercase; }
  .meta { margin: 2px 0; color: #444; font-size: 10pt; }
  .ref { margin: 8px 0 0; font-weight: 600; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px 18px; }
  table.kv { width: 100%; border-collapse: collapse; }
  table.kv th, table.kv td {
    padding: 4px 0;
    vertical-align: top;
    border-bottom: 1px solid #eee;
    font-size: 10.5pt;
  }
  table.kv th {
    width: 42%;
    padding-inline-end: 10px;
    color: #555;
    font-weight: 600;
    text-align: start;
  }
  td.blank { letter-spacing: 0.08em; color: #888; }
  .clauses { margin: 0; padding-inline-start: 1.2em; }
  .clauses li { margin: 0 0 6px; }
  .note { margin: 10px 0 0; padding: 8px 10px; background: #f7f7f7; border-radius: 4px; }
  .signs {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 24px;
    margin-top: 28px;
  }
  .sign {
    min-height: 110px;
    padding: 10px;
    border: 1px solid #ccc;
    border-radius: 4px;
  }
  .sign strong { display: block; margin-bottom: 6px; }
  .sign .line { margin-top: 48px; color: #777; font-size: 9.5pt; }
  footer {
    margin-top: 24px;
    padding-top: 8px;
    border-top: 1px solid #ddd;
    color: #777;
    font-size: 9pt;
  }
  @media print {
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  }
</style>
</head>
<body>
  <p class="brand">${escapeHtml(profile.name)}</p>
  <h1>${escapeHtml(copy.documentTitle)}</h1>
  <p class="ref">${escapeHtml(copy.reference)} ${escapeHtml(booking.reference)}</p>
  <p class="meta">${escapeHtml(copy.generated)}</p>

  <div class="grid">
    ${section(copy.lessor, lessorTable)}
    ${section(copy.lessee, lesseeTable)}
  </div>

  ${section(copy.vehicle, vehicleTable)}
  ${section(copy.period, periodTable)}
  ${section(copy.financials, moneyTable)}
  ${section(copy.conditions, conditionsTable)}
  ${noteBlock}
  ${section(copy.clausesTitle, clauses)}

  <div class="signs">
    <div class="sign">
      <strong>${escapeHtml(copy.lessorSign)}</strong>
      <div class="line">${escapeHtml(copy.date)} ____________</div>
      <div class="line">${escapeHtml(copy.agreement)}</div>
    </div>
    <div class="sign">
      <strong>${escapeHtml(copy.lesseeSign)}</strong>
      <div class="line">${escapeHtml(copy.date)} ____________</div>
      <div class="line">${escapeHtml(copy.agreement)}</div>
    </div>
  </div>

  <footer>${escapeHtml(profile.name)} · ${escapeHtml(copy.documentTitle)} · ${escapeHtml(booking.reference)}</footer>
</body>
</html>`;
}
