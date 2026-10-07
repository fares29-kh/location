import { Button } from '@drivetn/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@drivetn/ui/card';
import { EmptyState } from '@drivetn/ui/empty-state';
import { BookingStatusBadge } from '@drivetn/ui/status-badges';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@drivetn/ui/tabs';
import { CalendarCheck, CalendarClock, CarFront, Check, History, Plus, Search } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { PageHero } from '@/components/client/page-hero';
import { Link } from '@/i18n/navigation';

const TABS = [
  { id: 'upcoming', icon: CalendarClock },
  { id: 'active', icon: CarFront },
  { id: 'past', icon: History },
] as const;

const JOURNEY = ['PENDING', 'CONFIRMED', 'PICKED_UP', 'COMPLETED'] as const;

const CHECKLIST = ['identity', 'license', 'deposit', 'payment'] as const;

export function BookingsView({ firstName }: { firstName: string }) {
  const t = useTranslations('client.bookings');
  const tStatus = useTranslations('status.booking');

  const searchAction = (
    <Button asChild>
      <Link href="/search">
        <Search aria-hidden="true" />
        {t('empty.action')}
      </Link>
    </Button>
  );

  return (
    <>
      <PageHero
        id="bookings-title"
        icon={CalendarCheck}
        eyebrow={t('eyebrow')}
        title={t('title')}
        subtitle={t('subtitle', { name: firstName })}
        actions={
          <Button asChild variant="cta" size="lg" className="shadow-lg shadow-cta/25">
            <Link href="/search">
              <Plus aria-hidden="true" />
              {t('newBooking')}
            </Link>
          </Button>
        }
      />

      <div className="container grid gap-8 py-8 sm:py-12 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <Tabs defaultValue="upcoming" className="min-w-0">
          <TabsList aria-label={t('tabs.label')} className="w-full sm:w-auto">
            {TABS.map((tab) => (
              <TabsTrigger key={tab.id} value={tab.id} className="flex-1 sm:flex-none">
                <tab.icon className="size-4" aria-hidden="true" />
                {t(`tabs.${tab.id}`)}
              </TabsTrigger>
            ))}
          </TabsList>
          {TABS.map((tab) => (
            <TabsContent key={tab.id} value={tab.id} className="mt-6">
              <EmptyState
                icon={tab.icon}
                title={t(`empty.${tab.id}Title`)}
                description={t(`empty.${tab.id}Text`)}
                action={tab.id === 'active' ? undefined : searchAction}
                className="bg-surface py-16 shadow-soft"
              />
            </TabsContent>
          ))}
        </Tabs>

        <aside className="grid content-start gap-6">
          <Card>
            <CardHeader>
              <CardTitle>{t('journey.title')}</CardTitle>
              <CardDescription>{t('journey.description')}</CardDescription>
            </CardHeader>
            <CardContent>
              <ol className="grid gap-5">
                {JOURNEY.map((status, index) => (
                  <li key={status} className="relative flex gap-3">
                    {index < JOURNEY.length - 1 && (
                      <span
                        aria-hidden="true"
                        className="absolute start-[0.9375rem] top-9 h-[calc(100%-1rem)] w-px bg-border"
                      />
                    )}
                    <span
                      aria-hidden="true"
                      className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary-soft text-sm font-bold text-primary-soft-foreground ring-4 ring-surface"
                    >
                      {index + 1}
                    </span>
                    <div className="grid gap-1 pt-1">
                      <BookingStatusBadge status={status} className="w-fit">
                        {tStatus(status)}
                      </BookingStatusBadge>
                      <p className="text-sm text-muted-foreground">{t(`journey.${status}`)}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t('checklist.title')}</CardTitle>
              <CardDescription>{t('checklist.description')}</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="grid gap-3 text-sm">
                {CHECKLIST.map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-success-soft text-success-soft-foreground">
                      <Check className="size-3.5" strokeWidth={3} aria-hidden="true" />
                    </span>
                    {t(`checklist.${item}`)}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </aside>
      </div>
    </>
  );
}
