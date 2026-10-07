import { BadgeCheck, Banknote, MessageCircle, ShieldCheck } from 'lucide-react';
import { useTranslations } from 'next-intl';

/** Bandeau d'engagements : la promesse « zéro paiement en ligne » est visible partout. */
export function ReassuranceBanner() {
  const t = useTranslations('client.banner');
  const items = [
    { id: 'noPayment', icon: ShieldCheck, label: t('noPayment') },
    { id: 'payAtAgency', icon: Banknote, label: t('payAtAgency') },
    { id: 'verifiedAgencies', icon: BadgeCheck, label: t('verifiedAgencies') },
    { id: 'support', icon: MessageCircle, label: t('support') },
  ];

  return (
    <aside aria-label={t('label')} className="bg-primary text-primary-foreground">
      <ul className="container flex h-9 items-center justify-center gap-6 text-xs font-medium sm:text-sm">
        {items.map((item, index) => (
          <li
            key={item.id}
            className={
              index === 0
                ? 'flex items-center gap-1.5'
                : index === 1
                  ? 'hidden items-center gap-1.5 sm:flex'
                  : 'hidden items-center gap-1.5 lg:flex'
            }
          >
            <item.icon className="size-4 shrink-0" aria-hidden="true" />
            {item.label}
          </li>
        ))}
      </ul>
    </aside>
  );
}
