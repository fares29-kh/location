import type { Governorate, LocationQuery, PickupLocation } from '@drivetn/types';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { Redis } from 'ioredis';

import { PrismaService } from '../prisma/prisma.service';
import { REDIS_CLIENT } from '../redis/redis.constants';

export const LOCATIONS_CACHE_TTL_SECONDS = 10 * 60;
const CACHE_PREFIX = 'drivetn:cache:locations:';

/** Référentiel géographique public (gouvernorats, aéroports, villes...), mis en cache Redis. */
@Injectable()
export class LocationsService {
  private readonly logger = new Logger(LocationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  governorates(): Promise<Governorate[]> {
    return this.cached('governorates', async () => {
      const rows = await this.prisma.governorate.findMany({ orderBy: { code: 'asc' } });
      return rows.map((row) => ({
        code: row.code,
        slug: row.slug,
        name: { fr: row.nameFr, ar: row.nameAr, en: row.nameEn },
      }));
    });
  }

  locations(query: LocationQuery): Promise<PickupLocation[]> {
    const key = `list:${query.type ?? 'all'}:${query.governorate ?? 'all'}`;
    return this.cached(key, async () => {
      const rows = await this.prisma.location.findMany({
        where: {
          isActive: true,
          ...(query.type === undefined ? {} : { type: query.type }),
          ...(query.governorate === undefined ? {} : { governorateCode: query.governorate }),
        },
        orderBy: [{ type: 'asc' }, { nameFr: 'asc' }],
      });
      return rows.map((row) => ({
        id: row.id,
        slug: row.slug,
        type: row.type,
        governorateCode: row.governorateCode,
        iataCode: row.iataCode,
        name: { fr: row.nameFr, ar: row.nameAr, en: row.nameEn },
        latitude: row.latitude,
        longitude: row.longitude,
      }));
    });
  }

  // Le cache est une optimisation : en cas d'indisponibilité de Redis, on lit la base.
  private async cached<T>(key: string, load: () => Promise<T>): Promise<T> {
    const cacheKey = `${CACHE_PREFIX}${key}`;
    try {
      const hit = await this.redis.get(cacheKey);
      if (hit !== null) {
        return JSON.parse(hit) as T;
      }
    } catch (error) {
      this.logger.warn(`Lecture du cache impossible : ${(error as Error).message}`);
    }
    const value = await load();
    try {
      await this.redis.set(cacheKey, JSON.stringify(value), 'EX', LOCATIONS_CACHE_TTL_SECONDS);
    } catch (error) {
      this.logger.warn(`Écriture du cache impossible : ${(error as Error).message}`);
    }
    return value;
  }
}
