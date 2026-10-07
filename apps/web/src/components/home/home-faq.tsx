import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@drivetn/ui/accordion';
import { useTranslations } from 'next-intl';

import { SectionHeading } from './section-heading';

const QUESTIONS = ['payment', 'documents', 'deposit', 'contact'] as const;

export function HomeFaq() {
  const t = useTranslations('client.home.faq');

  return (
    <section
      aria-labelledby="faq-title"
      className="border-y border-border bg-surface-muted/50 py-16 sm:py-24"
    >
      <div className="container grid gap-10 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:gap-16">
        <div className="lg:sticky lg:top-28 lg:self-start">
          <SectionHeading id="faq-title" align="start" eyebrow={t('eyebrow')} title={t('title')} />
        </div>
        <Accordion
          type="single"
          collapsible
          defaultValue={QUESTIONS[0]}
          className="reveal rounded-panel border border-border bg-surface px-5 shadow-soft sm:px-7"
        >
          {QUESTIONS.map((question) => (
            <AccordionItem key={question} value={question}>
              <AccordionTrigger>{t(`${question}Question`)}</AccordionTrigger>
              <AccordionContent>{t(`${question}Answer`)}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
}
