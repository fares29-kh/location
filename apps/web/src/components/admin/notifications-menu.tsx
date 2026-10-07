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
import { cn } from '@drivetn/ui/lib/cn';
import {
  Bell,
  Building2,
  CheckCheck,
  type LucideIcon,
  MessageSquareWarning,
  ReceiptText,
} from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Link } from '@/i18n/navigation';
import { useAdminNavCounts } from '@/lib/admin/queries';

interface Task {
  key: 'pendingAgencies' | 'flaggedReviews' | 'overdueInvoices';
  href: string;
  icon: LucideIcon;
  className: string;
}

const TASKS: readonly Task[] = [
  {
    key: 'pendingAgencies',
    href: '/agencies?filter=pending',
    icon: Building2,
    className: 'bg-warning-soft text-warning-soft-foreground',
  },
  {
    key: 'flaggedReviews',
    href: '/reviews',
    icon: MessageSquareWarning,
    className: 'bg-info-soft text-info-soft-foreground',
  },
  {
    key: 'overdueInvoices',
    href: '/billing?filter=overdue',
    icon: ReceiptText,
    className: 'bg-danger-soft text-danger-soft-foreground',
  },
];

/** Cloche des tâches d'administration : agences à valider, avis signalés, factures en retard. */
export function AdminNotificationsMenu() {
  const t = useTranslations('admin.notifications');
  const { data } = useAdminNavCounts();
  const tasks = TASKS.filter((task) => (data?.[task.key] ?? 0) > 0);
  const total = tasks.reduce((sum, task) => sum + (data?.[task.key] ?? 0), 0);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          aria-label={total > 0 ? t('labelWithCount', { count: total }) : t('label')}
        >
          <Bell aria-hidden="true" />
          {total > 0 && (
            <span
              aria-hidden="true"
              className="absolute end-2 top-2 flex min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[0.625rem] font-bold leading-4 text-white ring-2 ring-surface"
            >
              {total > 9 ? '9+' : total}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 max-w-[calc(100vw-2rem)]">
        <DropdownMenuLabel className="text-sm text-foreground">{t('title')}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {tasks.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-4 py-6 text-center text-sm text-muted-foreground">
            <CheckCheck className="size-6 text-success" aria-hidden="true" />
            {t('empty')}
          </div>
        ) : (
          tasks.map(({ key, href, icon: Icon, className }) => (
            <DropdownMenuItem key={key} asChild className="items-start">
              <Link href={href}>
                <span
                  className={cn(
                    'flex size-8 shrink-0 items-center justify-center rounded-full',
                    className,
                  )}
                  aria-hidden="true"
                >
                  <Icon className="size-4" />
                </span>
                <span className="grid min-w-0 gap-0.5">
                  <span className="font-medium">
                    {t(`${key}.title`, { count: data?.[key] ?? 0 })}
                  </span>
                  <span className="text-xs text-muted-foreground">{t(`${key}.text`)}</span>
                </span>
              </Link>
            </DropdownMenuItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
