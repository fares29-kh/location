import { describe, expect, it, vi } from 'vitest';

import { GOVERNORATES, seedGovernorates } from './governorates.seed';
import { AIRPORTS, LOCATIONS, seedLocations } from './locations.seed';

describe('seedGovernorates', () => {
  it('contient les 24 gouvernorats avec des codes et slugs uniques', () => {
    expect(GOVERNORATES).toHaveLength(24);
    expect(new Set(GOVERNORATES.map((g) => g.code)).size).toBe(24);
    expect(new Set(GOVERNORATES.map((g) => g.slug)).size).toBe(24);
    for (const governorate of GOVERNORATES) {
      expect(governorate.code).toMatch(/^\d{2}$/);
      expect(governorate.nameAr).toMatch(/\p{Script=Arabic}/u);
    }
  });

  it('est idempotent (upsert par code)', async () => {
    const upsert = vi.fn().mockResolvedValue({});
    const prisma = { governorate: { upsert } } as unknown as Parameters<typeof seedGovernorates>[0];

    await seedGovernorates(prisma);

    expect(upsert).toHaveBeenCalledTimes(24);
    expect(upsert.mock.calls[0]?.[0]).toMatchObject({ where: { code: '11' } });
  });
});

describe('seedLocations', () => {
  const governorateCodes = new Set(GOVERNORATES.map((g) => g.code));

  it('rattache chaque lieu à un gouvernorat existant', () => {
    for (const location of LOCATIONS) {
      expect(governorateCodes.has(location.governorateCode)).toBe(true);
    }
  });

  it('a des slugs uniques et des coordonnées en Tunisie', () => {
    expect(new Set(LOCATIONS.map((l) => l.slug)).size).toBe(LOCATIONS.length);
    for (const location of LOCATIONS) {
      expect(location.latitude).toBeGreaterThan(30);
      expect(location.latitude).toBeLessThan(38);
      expect(location.longitude).toBeGreaterThan(7);
      expect(location.longitude).toBeLessThan(12);
    }
  });

  it('couvre les principaux aéroports avec leur code IATA', () => {
    expect(AIRPORTS.map((a) => a.iataCode)).toEqual(
      expect.arrayContaining(['TUN', 'NBE', 'MIR', 'DJE', 'SFA', 'TOE']),
    );
  });

  it('couvre chaque gouvernorat par au moins une ville', () => {
    const covered = new Set(
      LOCATIONS.filter((l) => l.type === 'CITY').map((l) => l.governorateCode),
    );
    expect(covered.size).toBe(24);
  });

  it('ne modifie pas l’activation lors d’un nouveau passage', async () => {
    const upsert = vi.fn().mockResolvedValue({});
    const prisma = { location: { upsert } } as unknown as Parameters<typeof seedLocations>[0];

    await seedLocations(prisma);

    expect(upsert).toHaveBeenCalledTimes(LOCATIONS.length);
    for (const call of upsert.mock.calls) {
      expect(call[0]).not.toHaveProperty(['update', 'isActive']);
    }
  });
});
