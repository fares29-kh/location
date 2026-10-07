'use client';

import { useSearchParams } from 'next/navigation';
import { useCallback, useMemo } from 'react';

type Params = Record<string, string>;

/**
 * Filtres d'un écran reflétés dans l'URL (partageables, conservés au retour arrière).
 * La mise à jour passe par l'API History, intégrée à Next.js : aucun aller-retour serveur.
 * Les valeurs par défaut ne sont pas écrites dans l'URL.
 */
export function useUrlState<T extends Params>(
  defaults: T,
  isValid: (key: keyof T, value: string) => boolean = () => true,
): [T, (patch: Partial<T>) => void] {
  const searchParams = useSearchParams();

  const values = useMemo(() => {
    const result: Params = { ...defaults };
    for (const key of Object.keys(defaults)) {
      const value = searchParams.get(key);
      if (value !== null && isValid(key, value)) {
        result[key] = value;
      }
    }
    return result as T;
  }, [searchParams, defaults, isValid]);

  const update = useCallback(
    (patch: Partial<T>) => {
      const params = new URLSearchParams(window.location.search);
      for (const [key, value] of Object.entries(patch) as [string, string | undefined][]) {
        if (value === undefined || value === '' || value === defaults[key]) {
          params.delete(key);
        } else {
          params.set(key, value);
        }
      }
      const query = params.toString();
      // Un état `null` est requis : Next.js ignore les appels qui portent son propre état interne.
      window.history.replaceState(
        null,
        '',
        `${window.location.pathname}${query.length > 0 ? `?${query}` : ''}`,
      );
    },
    [defaults],
  );

  return [values, update];
}
