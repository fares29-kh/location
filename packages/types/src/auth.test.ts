import { describe, expect, it } from 'vitest';

import {
  authResultSchema,
  identifierSchema,
  loginSchema,
  otpCodeSchema,
  passwordSchema,
  portalForRole,
  signupSchema,
  updateProfileSchema,
  USER_ROLES,
} from './auth';

function firstMessage(result: { success: boolean; error?: { issues: { message: string }[] } }) {
  return result.error?.issues[0]?.message;
}

describe('portalForRole', () => {
  it('associe chaque rôle à son portail', () => {
    expect(USER_ROLES.map(portalForRole)).toEqual(['client', 'agency', 'agency', 'admin']);
  });
});

describe('passwordSchema', () => {
  it('accepte un mot de passe avec lettres et chiffres', () => {
    expect(passwordSchema.safeParse('voiture2026').success).toBe(true);
    expect(passwordSchema.safeParse('سيارة2026x').success).toBe(true);
  });

  it.each([
    ['court1', 'PASSWORD_TOO_SHORT'],
    ['seulementdeslettres', 'PASSWORD_TOO_WEAK'],
    ['1234567890', 'PASSWORD_TOO_WEAK'],
    [`a1${'x'.repeat(127)}`, 'PASSWORD_TOO_LONG'],
  ])('refuse %s (%s)', (password, code) => {
    expect(firstMessage(passwordSchema.safeParse(password))).toBe(code);
  });
});

describe('identifierSchema', () => {
  it('reconnaît un téléphone et le normalise', () => {
    expect(identifierSchema.parse('+216 20 123 456')).toEqual({ type: 'phone', value: '20123456' });
  });

  it('reconnaît un email et le met en minuscules', () => {
    expect(identifierSchema.parse('  Client@Demo.TN ')).toEqual({
      type: 'email',
      value: 'client@demo.tn',
    });
  });

  it.each(['abc', '12345', 'pas un@email'])('refuse %s', (value) => {
    expect(firstMessage(identifierSchema.safeParse(value))).toBe('INVALID_IDENTIFIER');
  });

  it('exige une valeur', () => {
    expect(firstMessage(identifierSchema.safeParse('  '))).toBe('REQUIRED');
  });
});

describe('otpCodeSchema', () => {
  it('accepte 6 chiffres', () => {
    expect(otpCodeSchema.parse('012345')).toBe('012345');
  });

  it.each(['12345', '1234567', 'abcdef'])('refuse %s', (code) => {
    expect(firstMessage(otpCodeSchema.safeParse(code))).toBe('INVALID_OTP_FORMAT');
  });
});

describe('signupSchema', () => {
  const valid = {
    firstName: ' Amira ',
    lastName: 'Ben Salah',
    phone: '98 123 456',
    email: '',
    password: 'voiture2026',
  };

  it('normalise les champs et ignore un email vide', () => {
    expect(signupSchema.parse(valid)).toEqual({
      firstName: 'Amira',
      lastName: 'Ben Salah',
      phone: '98123456',
      email: undefined,
      password: 'voiture2026',
      channel: 'SMS',
    });
  });

  it('refuse un email invalide', () => {
    expect(firstMessage(signupSchema.safeParse({ ...valid, email: 'faux' }))).toBe('INVALID_EMAIL');
  });

  it('exige le prénom', () => {
    expect(firstMessage(signupSchema.safeParse({ ...valid, firstName: ' ' }))).toBe('REQUIRED');
  });
});

describe('loginSchema', () => {
  it('transforme l’identifiant', () => {
    expect(loginSchema.parse({ identifier: '20123456', password: 'x' }).identifier).toEqual({
      type: 'phone',
      value: '20123456',
    });
  });
});

describe('updateProfileSchema', () => {
  it('transforme un email vide en null', () => {
    expect(
      updateProfileSchema.parse({ firstName: 'A', lastName: 'B', email: '', locale: 'ar' }).email,
    ).toBeNull();
  });
});

describe('authResultSchema', () => {
  it('accepte une redirection vers un autre portail', () => {
    expect(
      authResultSchema.safeParse({
        status: 'redirect',
        portal: 'agency',
        redirectUrl: 'http://agency.localhost/auth/handoff?code=abc',
      }).success,
    ).toBe(true);
  });
});
