'use client';

import type { ActivityReport, ReportGrain } from '@drivetn/types';
import { Button } from '@drivetn/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@drivetn/ui/card';
import { cn } from '@drivetn/ui/lib/cn';
import { Skeleton } from '@drivetn/ui/skeleton';
import { ChevronLeft, ChevronRight, Download } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';

import {
  addDays,
  addMonths,
  type DayKey,
  dayKeyToDate,
  isoWeekday,
  todayKey,
} from '@/lib/agency/dates';
import { useActivityReport } from '@/lib/agency/queries';

import { FilterTabs } from '../filter-tabs';
import { QueryError } from '../query-states';
import { type AgencyFormat, useAgencyFormat } from '../use-agency-format';

const GRAINS: readonly ReportGrain[] = ['day', 'week', 'month', 'year'];
const PREVIEW_LIMIT = 5;

function periodStart(grain: ReportGrain, anchor: DayKey): DayKey {
  if (grain === 'week') {
    return addDays(anchor, -isoWeekday(anchor));
  }
  if (grain === 'month') {
    return `${anchor.slice(0, 7)}-01`;
  }
  if (grain === 'year') {
    return `${anchor.slice(0, 4)}-01-01`;
  }
  return anchor;
}

function shiftAnchor(grain: ReportGrain, anchor: DayKey, direction: -1 | 1): DayKey {
  if (grain === 'week') {
    return addDays(anchor, direction * 7);
  }
  if (grain === 'month') {
    return `${addMonths(anchor.slice(0, 7), direction)}-01`;
  }
  if (grain === 'year') {
    return `${String(Number(anchor.slice(0, 4)) + direction)}-01-01`;
  }
  return addDays(anchor, direction);
}

function periodIncludesToday(grain: ReportGrain, anchor: DayKey, today: DayKey): boolean {
  const start = periodStart(grain, anchor);
  const next = periodStart(grain, shiftAnchor(grain, anchor, 1));
  return today >= start && today < next;
}

function variation(current: number, previous: number): number | null {
  if (previous === 0) {
    return null;
  }
  return (current - previous) / previous;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function printHtml(html: string): void {
  const frame = document.createElement('iframe');
  frame.setAttribute('aria-hidden', 'true');
  frame.style.position = 'fixed';
  frame.style.width = '0';
  frame.style.height = '0';
  frame.style.border = '0';
  frame.srcdoc = html;
  frame.addEventListener('load', () => {
    const win = frame.contentWindow;
    if (win === null) {
      frame.remove();
      return;
    }
    win.addEventListener('afterprint', () => {
      frame.remove();
    });
    win.focus();
    win.print();
  });
  document.body.append(frame);
}

function periodTitle(grain: ReportGrain, anchor: DayKey, format: AgencyFormat): string {
  if (grain === 'day') {
    return format.weekdayDate(dayKeyToDate(anchor));
  }
  if (grain === 'week') {
    const start = periodStart('week', anchor);
    const end = addDays(start, 6);
    return `${format.date(dayKeyToDate(start))} – ${format.date(dayKeyToDate(end))}`;
  }
  if (grain === 'month') {
    return format.monthLong(dayKeyToDate(`${anchor.slice(0, 7)}-15`));
  }
  return anchor.slice(0, 4);
}

function periodSlug(grain: ReportGrain, anchor: DayKey): string {
  if (grain === 'week') {
    const start = periodStart('week', anchor);
    return `${start}_${addDays(start, 6)}`;
  }
  if (grain === 'month') {
    return anchor.slice(0, 7);
  }
  if (grain === 'year') {
    return anchor.slice(0, 4);
  }
  return anchor;
}

function pointLabel(
  grain: ReportGrain,
  key: string,
  format: AgencyFormat,
  hour: (value: string) => string,
): string {
  if (grain === 'day') {
    return hour(key.padStart(2, '0'));
  }
  if (grain === 'year') {
    return format.monthShort(`${key}-15T12:00:00Z`);
  }
  return format.dayMonth(dayKeyToDate(key));
}

interface ReportCopy {
  brand: string;
  documentTitle: string;
  fileTitle: string;
  agencyName: string;
  period: string;
  generated: string;
  revenueLabel: string;
  revenue: string;
  departuresLabel: string;
  departures: string;
  averageLabel: string;
  average: string;
  comparison: string;
  chart: string;
  chartHint: string;
  linesHint: string;
  seriesHeaders: readonly [string, string, string];
  series: readonly { label: string; revenue: string; departures: string }[];
  preview: string;
  lineHeaders: readonly [string, string, string, string, string, string, string];
  lines: readonly (readonly [string, string, string, string, string, string, string])[];
  empty: string;
  truncated: string | null;
  totals: string;
  dir: 'ltr' | 'rtl';
  lang: string;
}

function reportHtml(copy: ReportCopy): string {
  const cell = (value: string) => `<td>${escapeHtml(value)}</td>`;
  const head = (value: string) => `<th>${escapeHtml(value)}</th>`;
  const seriesRows = copy.series
    .map(
      (row) =>
        `<tr>${cell(row.label)}<td class="num">${escapeHtml(row.revenue)}</td><td class="num">${escapeHtml(row.departures)}</td></tr>`,
    )
    .join('');
  const lineRows =
    copy.lines.length === 0
      ? `<tr><td colspan="7" class="empty">${escapeHtml(copy.empty)}</td></tr>`
      : copy.lines
          .map(
            (row) =>
              `<tr>${row
                .map((value, index) =>
                  index === row.length - 1
                    ? `<td class="num">${escapeHtml(value)}</td>`
                    : cell(value),
                )
                .join('')}</tr>`,
          )
          .join('');
  const note = copy.truncated === null ? '' : `<p class="note">${escapeHtml(copy.truncated)}</p>`;
  const totalRow = `<tr><th>${escapeHtml(copy.totals)}</th><td class="num">${escapeHtml(copy.revenue)}</td><td class="num">${escapeHtml(copy.departures)}</td></tr>`;
  return `<!DOCTYPE html>
<html lang="${escapeHtml(copy.lang)}" dir="${copy.dir}">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(copy.fileTitle)}</title>
<style>
  @page { size: A4; margin: 16mm; }
  * { box-sizing: border-box; }
  body { margin: 0; color: #18181b; font: 12px/1.45 "Segoe UI", "Noto Naskh Arabic", Tahoma, sans-serif; }
  header { display: flex; justify-content: space-between; gap: 16px; border-top: 4px solid #18181b; padding-top: 12px; }
  h1 { margin: 0; font-size: 22px; }
  h2 { margin: 22px 0 8px; font-size: 13px; letter-spacing: 0.04em; text-transform: uppercase; }
  .meta { margin: 4px 0 0; color: #52525b; }
  .brand { font-size: 12px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; }
  .kpis { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-top: 16px; }
  .kpi { background: #f4f4f5; border-radius: 8px; padding: 10px 12px; }
  .kpi span { display: block; color: #52525b; font-size: 11px; }
  .kpi strong { display: block; margin-top: 2px; font-size: 16px; }
  table { width: 100%; border-collapse: collapse; }
  th, td { border-bottom: 1px solid #e4e4e7; padding: 6px 8px; text-align: start; vertical-align: top; }
  th { background: #fafafa; font-size: 10px; letter-spacing: 0.04em; text-transform: uppercase; }
  td.num, th.num { text-align: end; font-variant-numeric: tabular-nums; white-space: nowrap; }
  td.empty { color: #52525b; text-align: center; padding: 16px; }
  .note, footer { color: #52525b; font-size: 11px; }
  footer { margin-top: 24px; border-top: 1px solid #e4e4e7; padding-top: 8px; }
</style>
</head>
<body>
<header>
  <div>
    <p class="brand">${escapeHtml(copy.brand)}</p>
    <h1>${escapeHtml(copy.documentTitle)}</h1>
    <p class="meta">${escapeHtml(copy.agencyName)}</p>
    <p class="meta">${escapeHtml(copy.period)}</p>
  </div>
  <p class="meta">${escapeHtml(copy.generated)}</p>
</header>
<section class="kpis">
  <div class="kpi"><span>${escapeHtml(copy.revenueLabel)}</span><strong>${escapeHtml(copy.revenue)}</strong></div>
  <div class="kpi"><span>${escapeHtml(copy.departuresLabel)}</span><strong>${escapeHtml(copy.departures)}</strong></div>
  <div class="kpi"><span>${escapeHtml(copy.averageLabel)}</span><strong>${escapeHtml(copy.average)}</strong></div>
</section>
<p class="meta">${escapeHtml(copy.comparison)}</p>
<h2>${escapeHtml(copy.chart)}</h2>
<p class="meta">${escapeHtml(copy.chartHint)}</p>
<table>
  <thead><tr>${copy.seriesHeaders.map((header, index) => (index === 0 ? head(header) : `<th class="num">${escapeHtml(header)}</th>`)).join('')}</tr></thead>
  <tbody>${seriesRows}</tbody>
  <tfoot>${totalRow}</tfoot>
</table>
<h2>${escapeHtml(copy.preview)}</h2>
<p class="meta">${escapeHtml(copy.linesHint)}</p>
<table>
  <thead><tr>${copy.lineHeaders.map((header, index) => (index < 3 ? head(header) : `<th class="num">${escapeHtml(header)}</th>`)).join('')}</tr></thead>
  <tbody>${lineRows}</tbody>
</table>
${note}
<footer>${escapeHtml(copy.brand)} · ${escapeHtml(copy.documentTitle)}</footer>
</body>
</html>`;
}

function tunisHour(now = new Date()): string {
  return String((now.getUTCHours() + 1) % 24);
}

function isCurrentPoint(
  report: ActivityReport,
  key: string,
  anchor: DayKey,
  today: DayKey,
): boolean {
  if (report.grain === 'day') {
    return anchor === today && key === tunisHour();
  }
  if (report.grain === 'year') {
    return key === today.slice(0, 7);
  }
  return key === today;
}

function ActivityChart({
  report,
  format,
  anchor,
  today,
}: {
  report: ActivityReport;
  format: AgencyFormat;
  anchor: DayKey;
  today: DayKey;
}) {
  const t = useTranslations('agency.dashboard.report');
  const max = Math.max(1, ...report.series.map((point) => point.revenueMillimes));
  const wide = report.grain === 'day' || report.grain === 'month';

  return (
    <figure className="grid gap-2">
      <figcaption className="grid gap-1">
        <span className="text-sm font-medium">{t(`chartTitle.${report.grain}`)}</span>
        <span className="text-xs text-muted-foreground">{t('chartHint')}</span>
      </figcaption>
      <div className="overflow-x-auto">
        <ol
          className="flex h-48 items-end gap-1"
          style={wide ? { minWidth: `${String(report.series.length * 2.25)}rem` } : undefined}
        >
          {report.series.map((point) => {
            const label = pointLabel(report.grain, point.key, format, (hour) =>
              t('hour', { hour }),
            );
            const current = isCurrentPoint(report, point.key, anchor, today);
            const ratio = point.revenueMillimes / max;
            return (
              <li
                key={point.key}
                className={cn('flex h-full flex-1 flex-col justify-end gap-1', wide && 'min-w-8')}
              >
                <span
                  className={cn(
                    'block w-full',
                    point.revenueMillimes > 0 &&
                      (current
                        ? 'rounded-t-control bg-primary'
                        : 'rounded-t-control bg-primary/70'),
                  )}
                  style={{
                    height:
                      point.revenueMillimes > 0 ? `${String(Math.max(ratio * 100, 8))}%` : '0%',
                  }}
                >
                  <span className="sr-only">
                    {t('barLabel', {
                      label,
                      amount: format.money(point.revenueMillimes),
                    })}
                  </span>
                </span>
                <span
                  className={cn(
                    'truncate text-center text-[0.625rem] capitalize text-muted-foreground',
                    current && 'font-semibold text-foreground',
                  )}
                  aria-hidden="true"
                >
                  {label}
                </span>
              </li>
            );
          })}
        </ol>
      </div>
    </figure>
  );
}

function ActivityLines({ report, format }: { report: ActivityReport; format: AgencyFormat }) {
  const t = useTranslations('agency.dashboard.report');
  const tStatus = useTranslations('status.booking');
  const preview = report.lines.slice(0, PREVIEW_LIMIT);
  const hidden = report.lines.length - preview.length;

  return (
    <div className="grid gap-2">
      <div className="grid gap-1">
        <h3 className="text-sm font-medium">{t('preview')}</h3>
        <p className="text-xs text-muted-foreground">{t('linesHint')}</p>
      </div>
      {preview.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('empty')}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[36rem] text-start text-sm">
            <thead className="text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-2 py-2 font-medium">{t('columns.reference')}</th>
                <th className="px-2 py-2 font-medium">{t('columns.customer')}</th>
                <th className="px-2 py-2 font-medium">{t('columns.vehicle')}</th>
                <th className="px-2 py-2 text-end font-medium">{t('columns.amount')}</th>
                <th className="px-2 py-2 font-medium">{t('columns.status')}</th>
              </tr>
            </thead>
            <tbody>
              {preview.map((line) => (
                <tr key={line.reference} className="border-t border-border">
                  <td className="px-2 py-2 font-medium tabular-nums">{line.reference}</td>
                  <td className="px-2 py-2">{line.customer}</td>
                  <td className="px-2 py-2">{line.vehicle}</td>
                  <td className="px-2 py-2 text-end tabular-nums">
                    {format.money(line.totalMillimes)}
                  </td>
                  <td className="px-2 py-2">{tStatus(line.status)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {hidden > 0 ? (
        <p className="text-xs text-muted-foreground">{t('more', { count: hidden })}</p>
      ) : null}
      {report.truncated ? (
        <p className="text-xs text-muted-foreground">
          {t('truncated', { count: report.lines.length })}
        </p>
      ) : null}
    </div>
  );
}

export function ActivityReportCard() {
  const t = useTranslations('agency.dashboard.report');
  const tStatus = useTranslations('status.booking');
  const locale = useLocale();
  const format = useAgencyFormat();
  const today = todayKey();
  const [grain, setGrain] = useState<ReportGrain>('month');
  const [anchor, setAnchor] = useState<DayKey>(today);
  const reportQuery = useActivityReport(grain, anchor);
  const onPeriod = reportQuery.data !== undefined && periodIncludesToday(grain, anchor, today);

  const download = (report: ActivityReport) => {
    const title = periodTitle(grain, anchor, format);
    const revenueTrend = variation(report.revenueMillimes, report.previousRevenueMillimes);
    const comparison =
      revenueTrend === null
        ? t('noComparison')
        : t('versus', { value: format.signedPercent(revenueTrend) });
    const average =
      report.bookings === 0 ? 0 : Math.round(report.revenueMillimes / report.bookings);
    const copy: ReportCopy = {
      brand: t('brand'),
      documentTitle: t('documentTitle'),
      fileTitle: t('fileName', { period: periodSlug(grain, anchor) }),
      agencyName: report.agencyName,
      period: title,
      generated: t('generated', { date: format.dateTime(new Date()) }),
      revenueLabel: t('revenue'),
      revenue: format.money(report.revenueMillimes),
      departuresLabel: t('departures'),
      departures: format.integer(report.bookings),
      averageLabel: t('average'),
      average: format.money(average),
      comparison,
      chart: t(`chartTitle.${report.grain}`),
      chartHint: t('chartHint'),
      linesHint: t('linesHint'),
      seriesHeaders: [
        t('seriesColumns.period'),
        t('seriesColumns.revenue'),
        t('seriesColumns.departures'),
      ],
      series: report.series.map((point) => ({
        label: pointLabel(report.grain, point.key, format, (hour) => t('hour', { hour })),
        revenue: format.money(point.revenueMillimes),
        departures: format.integer(point.bookings),
      })),
      preview: t('preview'),
      lineHeaders: [
        t('columns.reference'),
        t('columns.customer'),
        t('columns.vehicle'),
        t('columns.pickup'),
        t('columns.return'),
        t('columns.status'),
        t('columns.amount'),
      ],
      lines: report.lines.map((line) => [
        line.reference,
        line.customer,
        line.vehicle,
        format.dateTime(line.pickupAt),
        format.dateTime(line.returnAt),
        tStatus(line.status),
        format.money(line.totalMillimes),
      ]),
      empty: t('empty'),
      truncated: report.truncated ? t('truncated', { count: report.lines.length }) : null,
      totals: t('totals'),
      dir: locale === 'ar' ? 'rtl' : 'ltr',
      lang: locale,
    };
    printHtml(reportHtml(copy));
  };

  return (
    <Card>
      <CardHeader className="gap-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="grid gap-1">
            <CardTitle className="text-base">{t('title')}</CardTitle>
            <CardDescription>{t('subtitle')}</CardDescription>
          </div>
          <Button
            type="button"
            variant="secondary"
            disabled={reportQuery.data === undefined}
            title={t('downloadHint')}
            onClick={() => {
              if (reportQuery.data !== undefined) {
                download(reportQuery.data);
              }
            }}
          >
            <Download aria-hidden="true" />
            {t('download')}
          </Button>
        </div>
        <FilterTabs
          label={t('periodLabel')}
          value={grain}
          options={GRAINS.map((value) => ({ value, label: t(`grains.${value}`) }))}
          onValueChange={(value) => {
            setGrain(value);
            setAnchor(today);
          }}
        />
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center rounded-control border border-border bg-surface">
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={t('previous')}
              onClick={() => {
                setAnchor((current) => shiftAnchor(grain, current, -1));
              }}
            >
              <ChevronLeft className="rtl:rotate-180" aria-hidden="true" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="border-x border-border"
              disabled={onPeriod}
              onClick={() => {
                setAnchor(today);
              }}
            >
              {t('today')}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={t('next')}
              disabled={onPeriod}
              onClick={() => {
                setAnchor((current) => shiftAnchor(grain, current, 1));
              }}
            >
              <ChevronRight className="rtl:rotate-180" aria-hidden="true" />
            </Button>
          </div>
          <p className="text-sm font-semibold capitalize">{periodTitle(grain, anchor, format)}</p>
        </div>
      </CardHeader>
      <CardContent className="grid gap-6">
        {reportQuery.isPending ? (
          <Skeleton className="h-56 rounded-control" />
        ) : reportQuery.isError ? (
          <QueryError
            error={reportQuery.error}
            onRetry={() => {
              void reportQuery.refetch();
            }}
            retrying={reportQuery.isFetching}
          />
        ) : (
          <ActivityBody report={reportQuery.data} format={format} anchor={anchor} today={today} />
        )}
      </CardContent>
    </Card>
  );
}

function ActivityBody({
  report,
  format,
  anchor,
  today,
}: {
  report: ActivityReport;
  format: AgencyFormat;
  anchor: DayKey;
  today: DayKey;
}) {
  const t = useTranslations('agency.dashboard.report');
  const revenueTrend = variation(report.revenueMillimes, report.previousRevenueMillimes);
  const bookingsTrend = variation(report.bookings, report.previousBookings);
  const average = report.bookings === 0 ? 0 : Math.round(report.revenueMillimes / report.bookings);
  const trend = (value: number | null) =>
    value === null ? t('noComparison') : t('versus', { value: format.signedPercent(value) });

  return (
    <>
      <dl className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-control bg-surface-muted px-4 py-3">
          <dt className="text-sm font-medium">{t('revenue')}</dt>
          <dd className="text-xs text-muted-foreground">{t('revenueHint')}</dd>
          <dd className="mt-1 font-heading text-xl font-bold tabular-nums">
            {format.money(report.revenueMillimes)}
          </dd>
          <dd className="text-xs text-muted-foreground">{trend(revenueTrend)}</dd>
        </div>
        <div className="rounded-control bg-surface-muted px-4 py-3">
          <dt className="text-sm font-medium">{t('departures')}</dt>
          <dd className="text-xs text-muted-foreground">{t('departuresHint')}</dd>
          <dd className="mt-1 font-heading text-xl font-bold tabular-nums">
            {format.integer(report.bookings)}
          </dd>
          <dd className="text-xs text-muted-foreground">{trend(bookingsTrend)}</dd>
        </div>
        <div className="rounded-control bg-surface-muted px-4 py-3">
          <dt className="text-sm font-medium">{t('average')}</dt>
          <dd className="text-xs text-muted-foreground">{t('averageHint')}</dd>
          <dd className="mt-1 font-heading text-xl font-bold tabular-nums">
            {format.money(average)}
          </dd>
        </div>
      </dl>
      <ActivityChart report={report} format={format} anchor={anchor} today={today} />
      <ActivityLines report={report} format={format} />
    </>
  );
}
