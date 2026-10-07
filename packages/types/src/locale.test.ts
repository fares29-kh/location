import { describe, expect, it } from 'vitest';

import { DEFAULT_LOCALE, getDirection, isLocale, LOCALES } from './locale';

describe('locales', () => {
  it('propose le français par défaut', () => {
    expect(DEFAULT_LOCALE).toBe('fr');
    expect(LOCALES).toEqual(['fr', 'ar', 'en']);
  });

  it('écrit l’arabe de droite à gauche', () => {
    expect(getDirection('ar')).toBe('rtl');
    expect(getDirection('fr')).toBe('ltr');
    expect(getDirection('en')).toBe('ltr');
  });

  it('reconnaît uniquement les langues supportées', () => {
    expect(isLocale('ar')).toBe(true);
    expect(isLocale('de')).toBe(false);
    expect(isLocale(undefined)).toBe(false);
  });
});
