import { describe, expect, it } from 'vitest';

import {
  buildWhatsAppUrl,
  formatInternationalPhone,
  formatNationalPhone,
  isTunisianMobile,
  isValidTunisianPhone,
  normalizeTunisianPhone,
  toE164,
  tunisianPhoneSchema,
} from './phone';

describe('normalizeTunisianPhone', () => {
  it.each([
    ['20 123 456', '20123456'],
    ['+216 20 123 456', '20123456'],
    ['00216-20-123-456', '20123456'],
    ['216.20.123.456', '20123456'],
    ['  98123456 ', '98123456'],
  ])('%s => %s', (input, expected) => {
    expect(normalizeTunisianPhone(input)).toBe(expected);
  });
});

describe('isValidTunisianPhone', () => {
  it.each(['20123456', '41234567', '55123456', '98123456', '71234567', '31234567'])(
    'accepte %s',
    (phone) => {
      expect(isValidTunisianPhone(phone)).toBe(true);
    },
  );

  it.each(['', '1234567', '123456789', '10123456', '60123456', '80123456', 'abcdefgh'])(
    'refuse %s',
    (phone) => {
      expect(isValidTunisianPhone(phone)).toBe(false);
    },
  );
});

describe('isTunisianMobile', () => {
  it('distingue mobiles et fixes', () => {
    expect(isTunisianMobile('+216 50 123 456')).toBe(true);
    expect(isTunisianMobile('71 234 567')).toBe(false);
  });
});

describe('formatage', () => {
  it('groupe les chiffres pendant la saisie', () => {
    expect(formatNationalPhone('2')).toBe('2');
    expect(formatNationalPhone('2012')).toBe('20 12');
    expect(formatNationalPhone('201234')).toBe('20 123 4');
    expect(formatNationalPhone('2012345678')).toBe('20 123 456');
  });

  it('produit les formats international et E.164', () => {
    expect(formatInternationalPhone('20123456')).toBe('+216 20 123 456');
    expect(toE164('20 123 456')).toBe('+21620123456');
  });
});

describe('buildWhatsAppUrl', () => {
  it('construit un lien wa.me avec message encodé', () => {
    expect(buildWhatsAppUrl('20 123 456', 'Bonjour, réservation DTN-42')).toBe(
      'https://wa.me/21620123456?text=Bonjour%2C+r%C3%A9servation+DTN-42',
    );
  });

  it('omet le paramètre text sans message', () => {
    expect(buildWhatsAppUrl('+21698123456')).toBe('https://wa.me/21698123456');
  });
});

describe('tunisianPhoneSchema', () => {
  it('normalise une saisie valide', () => {
    expect(tunisianPhoneSchema.parse('+216 20 123 456')).toBe('20123456');
  });

  it('refuse une saisie invalide avec un code de message stable', () => {
    const result = tunisianPhoneSchema.safeParse('12345');
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe('INVALID_TUNISIAN_PHONE');
  });
});
