import { HandCoins, MessageCircle, ShieldCheck } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { HeroPreview } from './hero-preview';
import { HeroSearch } from './hero-search';

const TRUST_ITEMS = [
  { id: 'noCard', icon: ShieldCheck },
  { id: 'payAtAgency', icon: HandCoins },
  { id: 'whatsapp', icon: MessageCircle },
] as const;

const ENTER = 'animate-in fade-in slide-in-from-bottom-4 fill-mode-both duration-700';

export function HomeHero() {
  const t = useTranslations('client.home');

  return (
    <section aria-labelledby="hero-title" className="relative isolate overflow-hidden">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-grid opacity-70 [mask-image:radial-gradient(ellipse_80%_70%_at_50%_0%,black,transparent)]" />
        <div className="absolute -top-56 start-[5%] size-[42rem] rounded-full bg-primary/15 blur-3xl" />
        <div className="absolute -end-40 top-32 size-[30rem] rounded-full bg-info/15 blur-3xl" />
      </div>

      <div className="container grid items-center gap-10 pb-16 pt-10 sm:pt-16 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:gap-14 lg:pb-24 lg:pt-20">
        <div className="grid min-w-0 content-start gap-6">
          <span
            className={`${ENTER} inline-flex w-fit items-center gap-2 rounded-full border border-border bg-surface/80 py-1 pe-3 ps-1 text-sm font-medium shadow-soft backdrop-blur`}
          >
            <span
              className="rounded-full bg-tn-red px-2 py-0.5 text-xs font-bold text-white"
              aria-hidden="true"
            >
              TN
            </span>
            {t('eyebrow')}
          </span>

          <h1
            id="hero-title"
            className={`${ENTER} text-[2.25rem] font-extrabold leading-[1.1] tracking-tight delay-100 sm:text-3xl lg:text-[3.5rem] lg:leading-[1.05] rtl:leading-[1.35]`}
          >
            {t.rich('title', {
              highlight: (chunks) => <span className="text-gradient">{chunks}</span>,
            })}
          </h1>

          <p className={`${ENTER} max-w-xl text-base text-muted-foreground delay-200 sm:text-lg`}>
            {t('subtitle')}
          </p>

          <div className={`${ENTER} delay-300`}>
            <HeroSearch />
          </div>

          <ul
            className={`${ENTER} flex flex-wrap gap-x-6 gap-y-3 text-sm font-medium text-muted-foreground delay-500`}
          >
            {TRUST_ITEMS.map((item) => (
              <li key={item.id} className="flex items-center gap-2">
                <span className="flex size-6 items-center justify-center rounded-full bg-success-soft text-success-soft-foreground">
                  <item.icon className="size-3.5" aria-hidden="true" />
                </span>
                {t(`trust.${item.id}`)}
              </li>
            ))}
          </ul>
        </div>

        <div className="hidden min-w-0 duration-1000 animate-in fade-in zoom-in-95 fill-mode-both delay-300 lg:block">
          <HeroPreview />
        </div>
      </div>
    </section>
  );
}
