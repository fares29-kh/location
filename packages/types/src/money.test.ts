import { describe, expect, it } from 'vitest';

import { dinarsToMillimes, formatMillimes, millimesToDinarInput, parseDinars } from './money';

const NNBSP = '\u202F';
const NBSP = '\u00A0';

describe('formatMillimes', () => {
  it('affiche toujours 3 décimales', () => {
    expect(formatMillimes(85000, 'fr')).toBe(`85,000${NBSP}DT`);
    expect(formatMillimes(85000, 'ar')).toBe(`85.000${NBSP}د.ت`);
    expect(formatMillimes(85000, 'en')).toBe(`85.000${NBSP}TND`);
  });

  it('conserve les millimes', () => {
    expect(formatMillimes(1, 'fr')).toBe(`0,001${NBSP}DT`);
    expect(formatMillimes(12_345, 'en', { withCurrency: false })).toBe('12.345');
  });

  it('groupe les milliers selon la langue', () => {
    expect(formatMillimes(1_250_000_000, 'fr', { withCurrency: false })).toBe(
      `1${NNBSP}250${NNBSP}000,000`,
    );
    expect(formatMillimes(1_250_000_000, 'ar', { withCurrency: false })).toBe('1,250,000.000');
  });

  it('gère les montants négatifs et nuls', () => {
    expect(formatMillimes(-1500, 'en', { withCurrency: false })).toBe('-1.500');
    expect(formatMillimes(0, 'fr', { withCurrency: false })).toBe('0,000');
  });

  it('refuse les montants non entiers', () => {
    expect(() => formatMillimes(10.5, 'fr')).toThrow(RangeError);
    expect(() => formatMillimes(Number.NaN, 'fr')).toThrow(RangeError);
  });
});

describe('dinarsToMillimes', () => {
  it('convertit sans erreur de virgule flottante', () => {
    expect(dinarsToMillimes(85)).toBe(85_000);
    expect(dinarsToMillimes(0.1 + 0.2)).toBe(300);
    expect(dinarsToMillimes(19.999)).toBe(19_999);
  });

  it('refuse les valeurs non finies', () => {
    expect(() => dinarsToMillimes(Number.POSITIVE_INFINITY)).toThrow(RangeError);
  });
});

describe('parseDinars', () => {
  it('accepte la virgule, le point et les espaces de groupement', () => {
    expect(parseDinars('85')).toBe(85_000);
    expect(parseDinars('85,5')).toBe(85_500);
    expect(parseDinars('1 250.750')).toBe(1_250_750);
    expect(parseDinars(' 0.001 ')).toBe(1);
  });

  it('refuse les saisies invalides', () => {
    expect(parseDinars('')).toBeNull();
    expect(parseDinars('-5')).toBeNull();
    expect(parseDinars('12.3456')).toBeNull();
    expect(parseDinars('abc')).toBeNull();
  });

  it('fait l’aller-retour avec millimesToDinarInput', () => {
    expect(millimesToDinarInput(85_500)).toBe('85.5');
    expect(parseDinars(millimesToDinarInput(120_000))).toBe(120_000);
  });
});
