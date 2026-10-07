import { ShieldCheck } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { BrandLogo } from '@/components/brand-logo';

function FooterColumn({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="grid content-start gap-3">
      <h2 className="text-sm font-semibold text-foreground">{title}</h2>
      <ul className="grid gap-2 text-sm text-muted-foreground">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

export function ClientFooter() {
  const t = useTranslations('client.footer');
  const tCommon = useTranslations('common');

  return (
    <footer className="border-t border-border bg-surface">
      <div className="container grid gap-10 py-12 md:grid-cols-[2fr_1fr_1fr]">
        <div className="grid content-start gap-4">
          <BrandLogo />
          <p className="max-w-sm text-sm text-muted-foreground">{t('about')}</p>
        </div>
        <FooterColumn
          title={t('explore')}
          items={[t('howItWorks'), t('becomePartner'), t('help')]}
        />
        <FooterColumn title={t('company')} items={[t('terms'), t('privacy')]} />
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
