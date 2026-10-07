import { ShieldCheck } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { BrandLogo } from '@/components/brand-logo';
import { Link } from '@/i18n/navigation';

interface FooterItem {
  label: string;
  /** Lien interne localisé, lien externe (`external`) ou simple mention. */
  href?: string;
  external?: boolean;
}

const linkClassName =
  'rounded-sm transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

function FooterColumn({ title, items }: { title: string; items: FooterItem[] }) {
  return (
    <div className="grid content-start gap-3">
      <h2 className="text-sm font-semibold text-foreground">{title}</h2>
      <ul className="grid gap-2 text-sm text-muted-foreground">
        {items.map((item) => (
          <li key={item.label}>
            {item.href === undefined ? (
              item.label
            ) : item.external === true ? (
              <a href={item.href} className={linkClassName}>
                {item.label}
              </a>
            ) : (
              <Link href={item.href} className={linkClassName}>
                {item.label}
              </Link>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ClientFooter({ agencyUrl }: { agencyUrl: string }) {
  const t = useTranslations('client.footer');
  const tNav = useTranslations('client.nav');
  const tCommon = useTranslations('common');

  return (
    <footer className="border-t border-border bg-surface">
      <div className="container grid gap-10 py-12 sm:grid-cols-2 md:grid-cols-[2fr_1fr_1fr_1fr]">
        <div className="grid content-start gap-4 sm:col-span-2 md:col-span-1">
          <BrandLogo />
          <p className="max-w-sm text-sm text-muted-foreground">{t('about')}</p>
        </div>
        <FooterColumn
          title={t('explore')}
          items={[
            { label: tNav('search'), href: '/search' },
            { label: tNav('agencies'), href: '/agencies' },
            { label: t('howItWorks'), href: '/#how-title' },
          ]}
        />
        <FooterColumn
          title={t('support')}
          items={[
            { label: t('help'), href: '/#faq-title' },
            { label: tNav('bookings'), href: '/bookings' },
            { label: t('becomePartner'), href: agencyUrl, external: true },
          ]}
        />
        <FooterColumn
          title={t('company')}
          items={[{ label: t('terms') }, { label: t('privacy') }]}
        />
      </div>
      <div className="border-t border-border">
        <div className="container flex flex-col gap-2 py-5 pb-24 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between md:pb-5">
          <p>{t('rights', { year: String(new Date().getFullYear()) })}</p>
          <p className="flex items-center gap-1.5">
            <ShieldCheck className="size-4 text-success" aria-hidden="true" />
            {tCommon('noOnlinePayment')}
          </p>
        </div>
      </div>
    </footer>
  );
}
