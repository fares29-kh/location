'use client';

import { SUBSCRIPTION_PLAN_DEFINITIONS } from '@drivetn/types';
import { Alert } from '@drivetn/ui/alert';
import { Button } from '@drivetn/ui/button';
import { Rating } from '@drivetn/ui/rating';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@drivetn/ui/sheet';
import { Skeleton } from '@drivetn/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@drivetn/ui/tabs';
import {
  CircleCheck,
  CircleDashed,
  FileText,
  Hash,
  Mail,
  MapPin,
  Phone,
  UserRound,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { type ReactNode, useState } from 'react';

import { QueryError } from '@/components/agency/query-states';
import { BookingStatusTag } from '@/components/agency/status-tags';
import { useAgencyFormat } from '@/components/agency/use-agency-format';
import { displayPhone } from '@/components/auth/otp-step';
import { useAgency, usePlatformSettings } from '@/lib/admin/queries';
import type { AgencyDetail } from '@/lib/admin/types';

import { ActivityList } from '../activity';
import { personName } from '../person';
import { AgencyStatusTag, InvoiceStatusTag, PlanTag } from '../status-tags';
import { AgencyDecisions } from './agency-decisions';

function Stat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="grid gap-0.5 rounded-control bg-surface-muted px-3 py-2.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="font-semibold tabular-nums">{value}</dd>
    </div>
  );
}

function InfoRow({ icon: Icon, children }: { icon: typeof Phone; children: ReactNode }) {
  return (
    <li className="flex items-start gap-2.5">
      <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      <span className="min-w-0 break-words">{children}</span>
    </li>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="grid gap-3">
      <h3 className="text-sm font-semibold">{title}</h3>
      {children}
    </section>
  );
}

function Overview({ agency }: { agency: AgencyDetail }) {
  const t = useTranslations('admin.agencies.detail');
  const tDocs = useTranslations('admin.agencies.documents');
  const format = useAgencyFormat();
  const { data: settings } = usePlatformSettings();
  const plan = SUBSCRIPTION_PLAN_DEFINITIONS[agency.plan];
  const commissionBps = agency.commissionBps ?? settings?.defaultCommissionBps ?? 0;

  return (
    <div className="grid gap-6">
      <Section title={t('contact')}>
        <ul className="grid gap-2.5 text-sm">
          <InfoRow icon={UserRound}>
            {personName(agency.owner)} <span className="text-muted-foreground">· {t('owner')}</span>
          </InfoRow>
          <InfoRow icon={Phone}>
            <a href={`tel:+216${agency.phone}`} className="tabular-nums hover:text-primary">
              {displayPhone(agency.phone)}
            </a>
            <span className="text-muted-foreground"> · </span>
            <a href={`tel:+216${agency.owner.phone}`} className="tabular-nums hover:text-primary">
              {displayPhone(agency.owner.phone)}
            </a>
          </InfoRow>
          {agency.extraPhones.map((extraPhone) => (
            <InfoRow key={extraPhone} icon={Phone}>
              <a href={`tel:+216${extraPhone}`} className="tabular-nums hover:text-primary">
                {displayPhone(extraPhone)}
              </a>
            </InfoRow>
          ))}
          <InfoRow icon={Mail}>
            {agency.email === null ? (
              <span className="text-muted-foreground">{t('noEmail')}</span>
            ) : (
              <a href={`mailto:${agency.email}`} className="text-primary hover:underline" dir="ltr">
                {agency.email}
              </a>
            )}
          </InfoRow>
          <InfoRow icon={MapPin}>{agency.address}</InfoRow>
          <InfoRow icon={Hash}>
            {t('taxId')} : <span className="font-mono text-xs">{agency.taxId}</span>
          </InfoRow>
        </ul>
      </Section>

      <Section title={tDocs('title')}>
        <ul className="grid divide-y divide-border rounded-control border border-border">
          {agency.documents.map((document) => (
            <li key={document.kind} className="flex items-center gap-3 p-3 text-sm">
              <FileText className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              <span className="flex-1">{tDocs(document.kind)}</span>
              {document.uploadedAt === null ? (
                <span className="inline-flex items-center gap-1.5 text-xs font-medium text-danger">
                  <CircleDashed className="size-4" aria-hidden="true" />
                  {tDocs('missing')}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 text-xs text-success">
                  <CircleCheck className="size-4" aria-hidden="true" />
                  {format.date(document.uploadedAt)}
                </span>
              )}
            </li>
          ))}
        </ul>
      </Section>

      <Section title={t('subscription')}>
        <dl className="grid grid-cols-2 gap-2">
          <Stat label={t('plan')} value={<PlanTag plan={agency.plan} />} />
          <Stat label={t('monthlyFee')} value={format.money(plan.monthlyPriceMillimes)} />
          {agency.trialEndsAt !== null && (
            <Stat label={t('trialEnds')} value={format.date(agency.trialEndsAt)} />
          )}
          <Stat
            label={t('vehicles')}
            value={
              plan.vehicleLimit === null
                ? format.integer(agency.vehiclesCount)
                : `${format.integer(agency.vehiclesCount)} / ${format.integer(plan.vehicleLimit)}`
            }
          />
          <Stat
            label={agency.commissionBps === null ? t('commissionDefault') : t('commissionCustom')}
            value={format.percent(commissionBps / 10_000)}
          />
        </dl>
      </Section>
    </div>
  );
}

function Activity({ agency }: { agency: AgencyDetail }) {
  const t = useTranslations('admin.agencies.detail');
  const format = useAgencyFormat();
  return (
    <div className="grid gap-6">
      <dl className="grid grid-cols-2 gap-2">
        <Stat label={t('gmvMonth')} value={format.money(agency.gmvMonthMillimes)} />
        <Stat label={t('bookings')} value={format.integer(agency.bookingsCount)} />
        <Stat
          label={t('rating')}
          value={
            agency.rating.count === 0 ? (
              '—'
            ) : (
              <span className="flex items-center gap-2">
                {format.decimal(agency.rating.average)}
                <Rating
                  value={agency.rating.average}
                  label={t('ratingLabel', { value: format.decimal(agency.rating.average) })}
                  className="[&_svg]:size-3.5"
                />
              </span>
            )
          }
        />
        <Stat label={t('reviews')} value={format.integer(agency.rating.count)} />
      </dl>

      <Section title={t('recentBookings')}>
        {agency.recentBookings.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('noBookings')}</p>
        ) : (
          <ul className="grid divide-y divide-border rounded-control border border-border">
            {agency.recentBookings.map((booking) => (
              <li key={booking.id} className="flex items-center gap-3 p-3">
                <span className="grid min-w-0 flex-1 gap-0.5">
                  <span className="truncate text-sm font-medium">
                    {personName(booking.customer)} · {booking.vehicle.brand} {booking.vehicle.model}
                  </span>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {format.dayMonth(booking.pickupAt)} – {format.date(booking.returnAt)} ·{' '}
                    <span className="font-mono">{booking.reference}</span>
                  </span>
                </span>
                <span className="grid justify-items-end gap-1">
                  <span className="text-sm font-semibold tabular-nums">
                    {format.money(booking.totalMillimes)}
                  </span>
                  <BookingStatusTag status={booking.status} />
                </span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title={t('invoices')}>
        {agency.invoices.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('noInvoices')}</p>
        ) : (
          <ul className="grid divide-y divide-border rounded-control border border-border">
            {agency.invoices.map((invoice) => (
              <li key={invoice.id} className="flex items-center gap-3 p-3 text-sm">
                <span className="grid min-w-0 flex-1 gap-0.5">
                  <span className="font-mono text-xs">{invoice.number}</span>
                  <span className="text-xs capitalize text-muted-foreground">
                    {format.monthLong(`${invoice.period}-15T12:00:00Z`)}
                  </span>
                </span>
                <span className="font-semibold tabular-nums">
                  {format.money(invoice.totalMillimes)}
                </span>
                <InvoiceStatusTag status={invoice.status} />
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}

function AgencyContent({ agency }: { agency: AgencyDetail }) {
  const t = useTranslations('admin.agencies.detail');
  const format = useAgencyFormat();
  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        <AgencyStatusTag status={agency.status} />
        <span>
          {t('since', { date: format.date(agency.createdAt) })}
          {agency.decidedAt !== null &&
            ` · ${t('decidedAt', { date: format.date(agency.decidedAt) })}`}
        </span>
      </div>
      {agency.statusReason !== null && (
        <Alert tone={agency.status === 'SUSPENDED' ? 'danger' : 'warning'} title={t('reasonTitle')}>
          {agency.statusReason}
        </Alert>
      )}
      <AgencyDecisions agency={agency} />
      <Tabs defaultValue="overview">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="overview">{t('tabs.overview')}</TabsTrigger>
          <TabsTrigger value="activity">{t('tabs.activity')}</TabsTrigger>
          <TabsTrigger value="history">{t('tabs.history')}</TabsTrigger>
        </TabsList>
        <TabsContent value="overview" className="pt-2">
          <Overview agency={agency} />
        </TabsContent>
        <TabsContent value="activity" className="pt-2">
          <Activity agency={agency} />
        </TabsContent>
        <TabsContent value="history" className="pt-2">
          <ActivityList entries={agency.activity} empty={t('noHistory')} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function DetailSkeleton() {
  return (
    <div className="grid gap-5" aria-hidden="true">
      <Skeleton className="h-6 w-40" />
      <Skeleton className="h-10 w-56" />
      <Skeleton className="h-10" />
      <Skeleton className="h-40" />
      <Skeleton className="h-40" />
    </div>
  );
}

/** Fiche agence en panneau latéral ; l'identifiant vit dans l'URL (`?agency=`). */
export function AgencySheet({
  agencyId,
  onClose,
}: {
  agencyId: string | null;
  onClose: () => void;
}) {
  const t = useTranslations('admin.agencies.detail');
  const tCommon = useTranslations('common');
  // Garde la dernière agence affichée pendant l'animation de fermeture.
  const [shownId, setShownId] = useState(agencyId);
  if (agencyId !== null && agencyId !== shownId) {
    setShownId(agencyId);
  }
  const { data, isPending, isError, error, refetch, isFetching } = useAgency(shownId);

  return (
    <Sheet
      open={agencyId !== null}
      onOpenChange={(open) => {
        if (!open) {
          onClose();
        }
      }}
    >
      <SheetContent
        side="end"
        closeLabel={tCommon('close')}
        className="w-full max-w-full gap-0 p-0 sm:max-w-lg"
      >
        <SheetHeader className="border-b border-border p-6 pe-14">
          <SheetTitle>{data === undefined ? t('title') : data.name}</SheetTitle>
          <SheetDescription>
            {data === undefined ? t('description') : `${data.city} · ${personName(data.owner)}`}
          </SheetDescription>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto p-6">
          {shownId === null || isPending ? (
            <DetailSkeleton />
          ) : isError ? (
            <QueryError error={error} onRetry={() => void refetch()} retrying={isFetching} />
          ) : (
            <AgencyContent agency={data} />
          )}
        </div>
        <div className="border-t border-border p-4 sm:px-6">
          <Button variant="secondary" className="w-full" onClick={onClose}>
            {tCommon('close')}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
