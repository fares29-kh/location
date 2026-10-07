import { describe, expect, it } from 'vitest';

import { errorResponseSchema } from './errors';

describe('errorResponseSchema', () => {
  it('accepte une erreur avec détails', () => {
    const error = { code: 'VALIDATION_ERROR', message: 'Invalide', details: [{ path: 'phone' }] };
    expect(errorResponseSchema.parse(error)).toEqual(error);
  });

  it('accepte une erreur sans détails', () => {
    expect(
      errorResponseSchema.safeParse({ code: 'NOT_FOUND', message: 'Introuvable' }).success,
    ).toBe(true);
  });

  it('refuse un code inconnu', () => {
    expect(errorResponseSchema.safeParse({ code: 'OOPS', message: 'x' }).success).toBe(false);
  });

  it('refuse un message vide', () => {
    expect(errorResponseSchema.safeParse({ code: 'NOT_FOUND', message: '' }).success).toBe(false);
  });
});
