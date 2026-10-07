import { useTranslations } from 'next-intl';

export const MAIN_CONTENT_ID = 'contenu-principal';

export function SkipLink() {
  const t = useTranslations('common');
  return (
    <a
      href={`#${MAIN_CONTENT_ID}`}
      className="sr-only focus:not-sr-only focus:fixed focus:start-4 focus:top-4 focus:z-[100] focus:rounded-control focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-primary-foreground focus:shadow-elevated"
    >
      {t('skipToContent')}
    </a>
  );
}
