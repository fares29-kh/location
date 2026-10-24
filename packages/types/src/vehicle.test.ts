import { describe, expect, it } from 'vitest';

import {
  isValidTunisianPlate,
  isVehiclePhotoType,
  matchVehicleBrand,
  matchVehicleModel,
  normalizeTunisianPlate,
  slugify,
  slugSchema,
  vehicleInputSchema,
  vehiclePhotoOrderSchema,
} from './vehicle';

const validVehicle = {
  brand: 'Peugeot',
  model: '208',
  year: 2023,
  plateNumber: '245tu1234',
  category: 'compact',
  transmission: 'MANUAL',
  fuel: 'PETROL',
  seats: 5,
  airConditioning: true,
  dailyRateMillimes: 95_000,
  depositMillimes: 500_000,
  mileageLimitKm: null,
  pickupLocationSlugs: ['monastir', 'bouhjar'],
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

  it('rend l’immatriculation facultative', () => {
    expect(vehicleInputSchema.parse({ ...validVehicle, plateNumber: '' }).plateNumber).toBeNull();
    expect(vehicleInputSchema.parse({ ...validVehicle, plateNumber: '  ' }).plateNumber).toBeNull();
    expect(vehicleInputSchema.parse({ ...validVehicle, plateNumber: null }).plateNumber).toBeNull();
    const { plateNumber: _omitted, ...withoutPlate } = validVehicle;
    expect(vehicleInputSchema.parse(withoutPlate).plateNumber).toBeNull();
  });

  it('exige un slug de catégorie', () => {
    const result = vehicleInputSchema.safeParse({ ...validVehicle, category: 'Grande SUV' });
    expect(result.error?.issues[0]?.message).toBe('INVALID_SLUG');
  });
});

describe('marques', () => {
  const brands = ['Citroën', 'Land Rover', 'Mercedes-Benz', 'Volkswagen'];

  it('reconnaît les variantes de saisie et les alias', () => {
    expect(matchVehicleBrand('citroen', brands)).toBe('Citroën');
    expect(matchVehicleBrand('MERCEDES BENZ', brands)).toBe('Mercedes-Benz');
    expect(matchVehicleBrand('mercedes', brands)).toBe('Mercedes-Benz');
    expect(matchVehicleBrand('vw', brands)).toBe('Volkswagen');
    expect(matchVehicleBrand('land-rover', brands)).toBe('Land Rover');
    expect(matchVehicleBrand('Inconnue', brands)).toBeNull();
  });

  it('ignore un alias dont la marque n’est pas au référentiel', () => {
    expect(matchVehicleBrand('vw', ['Peugeot'])).toBeNull();
  });
});

describe('matchVehicleModel', () => {
  const models = ['Série 3', 'X6', 'C-HR', 'Grand i10'];

  it('retrouve le modèle de la marque quelle que soit la saisie', () => {
    expect(matchVehicleModel('serie 3', models)).toBe('Série 3');
    expect(matchVehicleModel('x6', models)).toBe('X6');
    expect(matchVehicleModel('chr', models)).toBe('C-HR');
    expect(matchVehicleModel('GRAND-I10', models)).toBe('Grand i10');
  });

  it('refuse un modèle absent de la marque', () => {
    expect(matchVehicleModel('X7', models)).toBeNull();
  });
});

describe('slugs', () => {
  it('propose un slug à partir d’un libellé', () => {
    expect(slugify('Mini-van 7 places')).toBe('mini-van-7-places');
    expect(slugify('  Économique ! ')).toBe('economique');
    expect(slugSchema.safeParse(slugify('Ben Arous')).success).toBe(true);
  });

  it('refuse majuscules, espaces et tirets en bordure', () => {
    expect(slugSchema.safeParse('Suv').success).toBe(false);
    expect(slugSchema.safeParse('mini van').success).toBe(false);
    expect(slugSchema.safeParse('-suv').success).toBe(false);
  });
});

describe('vehiclePhotoOrderSchema', () => {
  it('refuse les doublons et les listes vides', () => {
    expect(vehiclePhotoOrderSchema.safeParse({ photoIds: ['a', 'b'] }).success).toBe(true);
    expect(vehiclePhotoOrderSchema.safeParse({ photoIds: ['a', 'a'] }).success).toBe(false);
    expect(vehiclePhotoOrderSchema.safeParse({ photoIds: [] }).success).toBe(false);
  });

  it('n’accepte que les formats d’image courants', () => {
    expect(isVehiclePhotoType('image/jpeg')).toBe(true);
    expect(isVehiclePhotoType('image/webp')).toBe(true);
    expect(isVehiclePhotoType('image/gif')).toBe(false);
  });
});
