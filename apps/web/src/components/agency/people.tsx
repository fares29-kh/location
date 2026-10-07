'use client';

import { buildWhatsAppUrl } from '@drivetn/types';
import { Avatar, AvatarFallback, getInitials } from '@drivetn/ui/avatar';
import { Button } from '@drivetn/ui/button';
import { cn } from '@drivetn/ui/lib/cn';
import { WhatsAppIcon } from '@drivetn/ui/whatsapp-button';
import { Phone } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { displayPhone } from '@/components/auth/otp-step';
import type { Customer } from '@/lib/agency/types';

export function customerName(customer: Pick<Customer, 'firstName' | 'lastName'>): string {
  return `${customer.firstName} ${customer.lastName}`;
}

/** Avatar, nom et téléphone d'un client. */
export function CustomerIdentity({
  customer,
  size = 'sm',
  showPhone = true,
  className,
}: {
  customer: Customer;
  size?: 'sm' | 'lg';
  showPhone?: boolean;
  className?: string;
}) {
  const name = customerName(customer);
  return (
    <span className={cn('flex min-w-0 items-center gap-3', className)}>
      <Avatar className={size === 'lg' ? 'size-14' : 'size-9'}>
        <AvatarFallback className={size === 'lg' ? 'text-lg' : 'text-xs'}>
          {getInitials(name)}
        </AvatarFallback>
      </Avatar>
      <span className="grid min-w-0">
        <span
          className={cn(
            'truncate font-medium text-foreground',
            size === 'lg' && 'font-heading text-lg font-semibold',
          )}
        >
          {name}
        </span>
        {showPhone && (
          <span className="truncate text-xs text-muted-foreground tabular-nums">
            {displayPhone(customer.phone)}
          </span>
        )}
      </span>
    </span>
  );
}

/** Appel et WhatsApp : les deux canaux de contact privilégiés des agences tunisiennes. */
export function ContactActions({
  phone,
  message,
  compact = false,
  className,
}: {
  phone: string;
  message?: string;
  compact?: boolean;
  className?: string;
}) {
  const t = useTranslations('agency.common');
  return (
    <div className={cn('flex flex-wrap gap-2', className)}>
      <Button asChild variant="secondary" size={compact ? 'icon-sm' : 'sm'}>
        <a href={`tel:+216${phone}`} aria-label={compact ? t('call') : undefined}>
          <Phone aria-hidden="true" />
          {!compact && t('call')}
        </a>
      </Button>
      <Button
        asChild
        size={compact ? 'icon-sm' : 'sm'}
        className="bg-[#25D366] text-white hover:bg-[#1EBE5A]"
      >
        <a
          href={buildWhatsAppUrl(phone, message)}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={compact ? t('whatsapp') : undefined}
        >
          <WhatsAppIcon className="size-4" />
          {!compact && t('whatsapp')}
        </a>
      </Button>
    </div>
  );
}
