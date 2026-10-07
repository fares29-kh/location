import { describe, expect, it } from 'vitest';

import { isValidTunisianPlate, normalizeTunisianPlate, vehicleInputSchema } from './vehicle';

const validVehicle = {
  brand: 'Peugeot',
  model: '208',
  year: 2023,
  plateNumber: '245tu1234',
  category: 'COMPACT',
  transmission: 'MANUAL',
  fuel: 'PETROL',
  seats: 5,
  airConditioning: true,
  dailyRateMillimes: 95_000,
  depositMillimes: 500_000,
  mileageLimitKm: null,
};

describe('immatriculation tunisienne', () => {
  it('accepte les saisies usuelles', () => {
    expect(isValidTunisianPlate('245 TU 1234')).toBe(true);
    expect(isValidTunisianPlate('245tu1234')).toBe(true);
    expect(isValidTunisianPlate('12 تونس 345')).toBe(true);
  });

  it('refuse les formats inconnus', () => {
    expect(isValidTunisianPlate('AB-123-CD')).toBe(false);
    expect(isValidTunisianPlate('2456 TU 1')).toBe(false);
  });

  it('normalise au format « 123 TU 4567 »', () => {
    expect(normalizeTunisianPlate(' 245tu1234 ')).toBe('245 TU 1234');
    expect(normalizeTunisianPlate('12 تونس 345')).toBe('12 TU 345');
  });
});

describe('vehicleInputSchema', () => {
  it('valide et normalise un véhicule complet', () => {
    const result = vehicleInputSchema.parse(validVehicle);
    expect(result.plateNumber).toBe('245 TU 1234');
  });

  it('renvoie des codes d’erreur traduisibles', () => {
    const result = vehicleInputSchema.safeParse({
      ...validVehicle,
      brand: '',
      year: 1990,
      plateNumber: 'XX',
      seats: 12,
      dailyRateMillimes: 0,
    });
    expect(result.success).toBe(false);
    const messages = Object.fromEntries(
      (result.error?.issues ?? []).map((issue) => [issue.path.join('.'), issue.message]),
    );
    expect(messages).toMatchObject({
      brand: 'REQUIRED',
      year: 'OUT_OF_RANGE',
      plateNumber: 'INVALID_PLATE',
      seats: 'OUT_OF_RANGE',
      dailyRateMillimes: 'INVALID_AMOUNT',
    });
  });
});
