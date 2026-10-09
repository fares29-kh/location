import { type GeoPoint, type PublicAgency, spreadAround } from '@drivetn/types';
import { Injectable } from '@nestjs/common';

import { CATEGORY_ORDER } from '../catalog/catalog.mapper';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';

@Injectable()
export class AgencyDirectoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  /**
   * Agences actives avec leur flotte disponible et leur note, placées sur le chef-lieu de leur
   * gouvernorat (ville homonyme, sinon premier lieu actif) ; sans lieu connu, l'agence est omise.
   */
  async list(): Promise<PublicAgency[]> {
    const agencies = await this.prisma.agency.findMany({
      where: { status: 'ACTIVE' },
      select: {
        id: true,
        name: true,
        logoKey: true,
        governorateCode: true,
        address: true,
        description: true,
        phone: true,
        whatsappPhone: true,
        instantConfirmation: true,
        freeCancellationHours: true,
        governorate: { select: { slug: true } },
        vehicles: {
          where: { status: 'ACTIVE' },
          select: { categoryId: true, dailyRateMillimes: true },
        },
      },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });
    if (agencies.length === 0) {
      return [];
    }

    const governorateCodes = [...new Set(agencies.map((agency) => agency.governorateCode))];
    const [locations, ratings, categoryOrder] = await Promise.all([
      this.prisma.location.findMany({
        where: { governorateCode: { in: governorateCodes }, isActive: true },
        select: { slug: true, type: true, governorateCode: true, latitude: true, longitude: true },
        orderBy: [{ type: 'asc' }, { slug: 'asc' }],
      }),
      this.prisma.review.groupBy({
        by: ['agencyId'],
        where: {
          agencyId: { in: agencies.map((agency) => agency.id) },
          moderationStatus: { not: 'HIDDEN' },
        },
        _avg: { rating: true },
        _count: { _all: true },
      }),
      this.prisma.vehicleCategory.findMany({
        select: { id: true, slug: true },
        orderBy: [...CATEGORY_ORDER],
      }),
    ]);
    const ratingByAgency = new Map(ratings.map((row) => [row.agencyId, row]));

    const centers = new Map<string, GeoPoint>();
    for (const agency of agencies) {
      if (centers.has(agency.governorateCode)) {
        continue;
      }
      const inGovernorate = locations.filter(
        (location) => location.governorateCode === agency.governorateCode,
      );
      const seat =
        inGovernorate.find(
          (location) => location.type === 'CITY' && location.slug === agency.governorate.slug,
        ) ?? inGovernorate.find((location) => location.type === 'CITY');
      const center = seat ?? inGovernorate[0];
      if (center !== undefined) {
        centers.set(agency.governorateCode, {
          latitude: center.latitude,
          longitude: center.longitude,
        });
      }
    }

    const placed = new Map<string, number>();
    const directory: PublicAgency[] = [];
    for (const agency of agencies) {
      const center = centers.get(agency.governorateCode);
      if (center === undefined) {
        continue;
      }
      const index = placed.get(agency.governorateCode) ?? 0;
      placed.set(agency.governorateCode, index + 1);

      const rating = ratingByAgency.get(agency.id);
      const rates = agency.vehicles.map((vehicle) => vehicle.dailyRateMillimes);
      const categories = new Set(agency.vehicles.map((vehicle) => vehicle.categoryId));
      directory.push({
        id: agency.id,
        name: agency.name,
        logoUrl: agency.logoKey === null ? null : this.storage.publicUrl(agency.logoKey),
        governorateCode: agency.governorateCode,
        address: agency.address,
        description: agency.description,
        phone: agency.phone,
        whatsappPhone: agency.whatsappPhone,
        rating: rating?._avg.rating ?? null,
        reviewsCount: rating?._count._all ?? 0,
        vehiclesCount: agency.vehicles.length,
        fromDailyRateMillimes: rates.length === 0 ? null : Math.min(...rates),
        categories: categoryOrder
          .filter((category) => categories.has(category.id))
          .map((category) => category.slug),
        instantConfirmation: agency.instantConfirmation,
        freeCancellationHours: agency.freeCancellationHours,
        ...spreadAround(center, index),
      });
    }
    return directory;
  }
}
