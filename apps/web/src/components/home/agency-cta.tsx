import { Button } from '@drivetn/ui/button';
import { ArrowRight, Building2 } from 'lucide-react';
import { useTranslations } from 'next-intl';

export function AgencyCta({ agencyUrl }: { agencyUrl: string }) {
  const t = useTranslations('client.home.agencyCta');

  return (
    <section aria-labelledby="agency-cta-title" className="container py-16 sm:py-24">
      <div className="reveal relative isolate overflow-hidden rounded-[2rem] bg-gradient-to-br from-emerald-600 via-emerald-700 to-teal-800 px-6 py-12 text-white shadow-elevated sm:px-12 sm:py-16">
        <div aria-hidden="true" className="absolute inset-0 -z-10">
          <div className="absolute -end-20 -top-24 size-80 rounded-full bg-white/10 blur-2xl" />
          <div className="absolute -bottom-32 start-1/4 size-96 rounded-full bg-teal-300/20 blur-3xl" />
          <div className="absolute -bottom-20 -start-20 size-64 rounded-full border-[32px] border-white/5" />
        </div>
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
          <div className="grid max-w-2xl gap-4">
            <span className="flex size-12 items-center justify-center rounded-2xl bg-white/15 backdrop-blur">
              <Building2 className="size-6" aria-hidden="true" />
            </span>
            <h2
              id="agency-cta-title"
              className="text-[1.75rem] font-extrabold leading-tight tracking-tight sm:text-2xl lg:text-[2.25rem]"
            >
              {t('title')}
            </h2>
            <p className="text-base text-white/80 sm:text-lg">{t('text')}</p>
          </div>
          <Button
            asChild
            size="lg"
            className="w-full bg-white text-emerald-800 shadow-lg hover:bg-emerald-50 sm:w-fit"
          >
            <a href={`${agencyUrl}/signup`}>
              {t('action')}
              <ArrowRight className="rtl:rotate-180" aria-hidden="true" />
            </a>
          </Button>
        </div>
      </div>
    </section>
  );
}
