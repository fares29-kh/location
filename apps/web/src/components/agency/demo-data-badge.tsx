'use client';

import { Badge } from '@drivetn/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@drivetn/ui/tooltip';
import { FlaskConical } from 'lucide-react';
import { useTranslations } from 'next-intl';

/** Signale clairement que l'espace affiche des données de démonstration. */
export function DemoDataBadge() {
  const t = useTranslations('agency.demo');
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className="hidden rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:inline-flex"
          aria-label={t('tooltip')}
        >
          <Badge tone="info" className="h-7 px-3 text-xs">
            <FlaskConical aria-hidden="true" />
            {t('badge')}
          </Badge>
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom">{t('tooltip')}</TooltipContent>
    </Tooltip>
  );
}
