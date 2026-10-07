import type { PaymentMethod } from '@drivetn/types';
import {
  Banknote,
  CreditCard,
  Landmark,
  type LucideIcon,
  ReceiptText,
  Smartphone,
  Stamp,
} from 'lucide-react';

import { cn } from '../lib/cn';

export const PAYMENT_METHOD_ICONS: Record<PaymentMethod, LucideIcon> = {
  CASH: Banknote,
  CARD_TPE: CreditCard,
  CHECK: ReceiptText,
  BANK_TRANSFER: Landmark,
  MOBILE_PAYMENT: Smartphone,
  MONEY_ORDER: Stamp,
};

export interface PaymentMethodBadgesProps {
  methods: readonly PaymentMethod[];
  /** Libellé traduit de chaque mode de paiement. */
  getLabel: (method: PaymentMethod) => string;
  className?: string;
}

/** Modes de paiement acceptés par une agence (réglés sur place, jamais en ligne). */
export function PaymentMethodBadges({ methods, getLabel, className }: PaymentMethodBadgesProps) {
  return (
    <ul className={cn('flex flex-wrap gap-2', className)}>
      {methods.map((method) => {
        const Icon = PAYMENT_METHOD_ICONS[method];
        return (
          <li
            key={method}
            className="inline-flex items-center gap-1.5 rounded-control border border-border bg-surface px-2.5 py-1 text-xs font-medium text-foreground"
          >
            <Icon className="size-3.5 text-muted-foreground" aria-hidden="true" />
            {getLabel(method)}
          </li>
        );
      })}
    </ul>
  );
}
