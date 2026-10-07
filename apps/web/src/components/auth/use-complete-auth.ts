'use client';

import type { AuthResult } from '@drivetn/types';
import { useLocale } from 'next-intl';
import { useCallback, useState } from 'react';

import { localizePath } from '@/lib/portal';

/**
 * Après une authentification réussie : navigation complète (le serveur relit les cookies)
 * vers `nextPath` ou l'accueil, ou vers le portail du rôle si l'API demande une redirection.
 * `redirecting` garde les formulaires désactivés pendant le chargement de la page suivante.
 */
export function useCompleteAuth(nextPath: string | null) {
  const locale = useLocale();
  const [redirecting, setRedirecting] = useState(false);

  const complete = useCallback(
    (result: AuthResult) => {
      setRedirecting(true);
      window.location.assign(
        result.status === 'redirect' ? result.redirectUrl : (nextPath ?? localizePath(locale, '/')),
      );
    },
    [locale, nextPath],
  );

  return { complete, redirecting };
}
