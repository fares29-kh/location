'use client';

import { Button } from '@drivetn/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@drivetn/ui/dropdown-menu';
import { Bell, CheckCheck } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Link } from '@/i18n/navigation';
import { useNavCounts } from '@/lib/agency/queries';

import { customerName } from './people';
import { useAgencyFormat } from './use-agency-format';

/** Cloche des demandes de réservation en attente de réponse. */
export function NotificationsMenu() {
  const t = useTranslations('agency.notifications');
  const format = useAgencyFormat();
  const { data } = useNavCounts();
  const count = data?.pendingBookings ?? 0;
  const items = data?.latestPending ?? [];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          aria-label={count > 0 ? t('labelWithCount', { count }) : t('label')}
        >
          <Bell aria-hidden="true" />
          {count > 0 && (
            <span
              aria-hidden="true"
              className="absolute end-2 top-2 flex min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[0.625rem] font-bold leading-4 text-white ring-2 ring-surface"
            >
              {count > 9 ? '9+' : count}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 max-w-[calc(100vw-2rem)]">
        <DropdownMenuLabel className="flex items-center justify-between text-sm text-foreground">
          {t('title')}
          {count > 0 && <span className="text-xs font-normal text-muted-foreground">{count}</span>}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {items.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-4 py-6 text-center text-sm text-muted-foreground">
            <CheckCheck className="size-6 text-success" aria-hidden="true" />
            {t('empty')}
          </div>
        ) : (
          items.map((booking) => (
            <DropdownMenuItem key={booking.id} asChild className="items-start">
              <Link href={`/bookings/${booking.id}`}>
                <span
                  className="mt-1.5 size-2 shrink-0 rounded-full bg-warning"
                  aria-hidden="true"
                />
                <span className="grid min-w-0 gap-0.5">
                  <span className="truncate font-medium">
                    {t('newRequest', { name: customerName(booking.customer) })}
                  </span>
                  <span className="truncate text-xs text-muted-foreground">
                    {booking.vehicle.brand} {booking.vehicle.model} ·{' '}
                    {format.dayMonth(booking.pickupAt)} – {format.dayMonth(booking.returnAt)}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {format.relative(booking.createdAt)}
                  </span>
                </span>
              </Link>
            </DropdownMenuItem>
          ))
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild className="justify-center font-medium text-primary">
          <Link href="/bookings?filter=pending">{t('viewAll')}</Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
