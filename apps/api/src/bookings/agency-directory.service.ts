import {
  type GeoPoint,
  type PublicAgency,
  type PublicReview,
  publicReviewAuthor,
  spreadAround,
} from '@drivetn/types';
import { Injectable, NotFoundException } from '@nestjs/common';

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
   * Agences actives avec leur flotte et leur note. Un point choisi par l'agence est utilisé tel
   * quel ; sinon elle est placée au chef-lieu de son gouvernorat. Sans lieu connu, elle est omise.
   */
  async list(): Promise<PublicAgency[]> {
    const agencies = await this.prisma.agency.findMany({
      where: { status: 'ACTIVE' },
      select: {
        id: true,
        name: true,
        logoKey: true,
        governorateCode: true,
        latitude: true,
        longitude: true,
        address: true,
        description: true,
        phone: true,
        whatsappPhone: true,
        extraPhones: true,
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
      const exact =
        agency.latitude !== null && agency.longitude !== null
          ? { latitude: agency.latitude, longitude: agency.longitude }
          : null;
      const center = centers.get(agency.governorateCode);
      let point = exact;
      if (point === null && center !== undefined) {
        const index = placed.get(agency.governorateCode) ?? 0;
        placed.set(agency.governorateCode, index + 1);
        point = spreadAround(center, index);
      }
      if (point === null) {
        continue;
      }

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
        extraPhones: agency.extraPhones,
        rating: rating?._avg.rating ?? null,
        reviewsCount: rating?._count._all ?? 0,
        vehiclesCount: agency.vehicles.length,
        fromDailyRateMillimes: rates.length === 0 ? null : Math.min(...rates),
        categories: categoryOrder
          .filter((category) => categories.has(category.id))
          .map((category) => category.slug),
        instantConfirmation: agency.instantConfirmation,
        freeCancellationHours: agency.freeCancellationHours,
        ...point,
      });
    }
    return directory;
  }

  /** Derniers avis publiés d'une agence active. Le nom de famille est abrégé. */
  async reviews(agencyId: string): Promise<PublicReview[]> {
    const agency = await this.prisma.agency.findFirst({
      where: { id: agencyId, status: 'ACTIVE' },
      select: { id: true },
    });
    if (agency === null) {
      throw new NotFoundException('Agence introuvable.');
    }
    const rows = await this.prisma.review.findMany({
      where: { agencyId: agency.id, moderationStatus: { not: 'HIDDEN' } },
      include: { customer: { select: { firstName: true, lastName: true } } },
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      take: 8,
    });
    return rows.map((row) => ({
      id: row.id,
      rating: row.rating,
      comment: row.comment,
      author: publicReviewAuthor(row.customer.firstName, row.customer.lastName),
      createdAt: row.createdAt.toISOString(),
      reply: row.reply,
      repliedAt: row.repliedAt?.toISOString() ?? null,
    }));
  }
}
