import {
  BLOCKING_BOOKING_STATUSES,
  mergeUnavailableRanges,
  type Offer,
  type OfferSearch,
  type OfferSearchResult,
  rentalWindow,
  toDayKey,
  type UnavailableRange,
} from '@drivetn/types';
import { Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { toVehiclePhoto, VEHICLE_PHOTOS_INCLUDE } from '../storage/vehicle-photos';

export const OFFERS_LIMIT = 60;

@Injectable()
export class OffersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  /**
   * Véhicules disponibles des agences actives. Le lieu (ou, à défaut, le gouvernorat) restreint
   * aux lieux de remise de la voiture, pas au bureau de l'agence. Avec des dates, les véhicules
   * déjà réservés sur le créneau sont exclus.
   */
  async search(query: OfferSearch): Promise<OfferSearchResult> {
    const place =
      query.location !== undefined && query.location.length > 0
        ? { slug: query.location, isActive: true }
        : query.governorate !== undefined
          ? { governorateCode: query.governorate, isActive: true }
          : null;
    if (query.location !== undefined && query.location.length > 0) {
      const location = await this.prisma.location.findUnique({
        where: { slug: query.location },
        select: { isActive: true },
      });
      if (!location?.isActive) {
        return { offers: [], days: null };
      }
    }

    const window =
      query.pickup !== undefined && query.return !== undefined && query.return > query.pickup
        ? rentalWindow(query.pickup, query.return)
        : null;

    const where: Prisma.VehicleWhereInput = {
      status: 'ACTIVE',
      deletedAt: null,
      ...(query.category === undefined ? {} : { category: { slug: query.category } }),
      agency: { status: 'ACTIVE' },
      ...(place === null ? {} : { pickupLocations: { some: { location: place } } }),
      ...(window === null
        ? {}
        : {
            bookings: {
              none: {
                status: { in: [...BLOCKING_BOOKING_STATUSES] },
                pickupAt: { lt: window.returnAt },
                returnAt: { gt: window.pickupAt },
              },
            },
            maintenances: {
              none: { startsAt: { lt: window.returnAt }, endsAt: { gt: window.pickupAt } },
            },
          }),
    };

    const vehicles = await this.prisma.vehicle.findMany({
      where,
      include: {
        agency: true,
        photos: VEHICLE_PHOTOS_INCLUDE,
        category: { select: { slug: true } },
        pickupLocations: {
          select: {
            location: {
              select: {
                slug: true,
                isActive: true,
                nameFr: true,
                nameAr: true,
                nameEn: true,
              },
            },
          },
        },
      },
      orderBy: [{ dailyRateMillimes: 'asc' }, { id: 'asc' }],
      take: OFFERS_LIMIT,
    });
    const unavailableByVehicle = await this.unavailableByVehicle(
      vehicles.map((vehicle) => vehicle.id),
    );

    const agencyIds = [...new Set(vehicles.map((vehicle) => vehicle.agencyId))];
    const ratings = await this.prisma.review.groupBy({
      by: ['agencyId'],
      where: { agencyId: { in: agencyIds }, moderationStatus: { not: 'HIDDEN' } },
      _avg: { rating: true },
      _count: { _all: true },
    });
    const ratingByAgency = new Map(ratings.map((row) => [row.agencyId, row]));

    const offers: Offer[] = vehicles.map((vehicle) => {
      const rating = ratingByAgency.get(vehicle.agencyId);
      return {
        vehicleId: vehicle.id,
        brand: vehicle.brand,
        model: vehicle.model,
        year: vehicle.year,
        category: vehicle.category.slug,
        transmission: vehicle.transmission,
        fuel: vehicle.fuel,
        seats: vehicle.seats,
        airConditioning: vehicle.airConditioning,
        color: vehicle.color,
        photos: vehicle.photos.map((photo) =>
          toVehiclePhoto(photo, (key) => this.storage.publicUrl(key)),
        ),
        dailyRateMillimes: vehicle.dailyRateMillimes,
        depositMillimes: vehicle.depositMillimes,
        mileageLimitKm: vehicle.mileageLimitKm,
        pickupLocations: vehicle.pickupLocations
          .filter((link) => link.location.isActive)
          .map((link) => ({
            slug: link.location.slug,
            name: { fr: link.location.nameFr, ar: link.location.nameAr, en: link.location.nameEn },
          }))
          .sort((a, b) => a.name.fr.localeCompare(b.name.fr, 'fr')),
        agency: {
          id: vehicle.agency.id,
          name: vehicle.agency.name,
          logoUrl:
            vehicle.agency.logoKey === null ? null : this.storage.publicUrl(vehicle.agency.logoKey),
          governorateCode: vehicle.agency.governorateCode,
          address: vehicle.agency.address,
          rating: rating?._avg.rating ?? null,
          reviewsCount: rating?._count._all ?? 0,
          instantConfirmation: vehicle.agency.instantConfirmation,
          freeCancellationHours: vehicle.agency.freeCancellationHours,
          minDriverAge: vehicle.agency.minDriverAge,
          acceptedPaymentMethods: vehicle.agency.acceptedPaymentMethods,
        },
        unavailable: unavailableByVehicle.get(vehicle.id) ?? [],
      };
    });

    return { offers, days: window?.days ?? null };
  }

  /** Demandes, réservations confirmées et entretiens encore en cours, par véhicule. */
  private async unavailableByVehicle(
    vehicleIds: readonly string[],
  ): Promise<Map<string, UnavailableRange[]>> {
    const grouped = new Map<string, UnavailableRange[]>();
    if (vehicleIds.length === 0) {
      return grouped;
    }
    const now = new Date();
    const horizon = new Date(now.getTime() + 366 * 24 * 60 * 60 * 1000);
    const [bookings, maintenances] = await Promise.all([
      this.prisma.booking.findMany({
        where: {
          vehicleId: { in: [...vehicleIds] },
          status: { in: [...BLOCKING_BOOKING_STATUSES] },
          returnAt: { gt: now },
          pickupAt: { lt: horizon },
        },
        select: { vehicleId: true, pickupAt: true, returnAt: true },
      }),
      this.prisma.vehicleMaintenance.findMany({
        where: {
          vehicleId: { in: [...vehicleIds] },
          endsAt: { gt: now },
          startsAt: { lt: horizon },
        },
        select: { vehicleId: true, startsAt: true, endsAt: true },
      }),
    ]);
    for (const row of bookings) {
      const ranges = grouped.get(row.vehicleId) ?? [];
      ranges.push({ pickup: toDayKey(row.pickupAt), return: toDayKey(row.returnAt) });
      grouped.set(row.vehicleId, ranges);
    }
    for (const row of maintenances) {
      const ranges = grouped.get(row.vehicleId) ?? [];
      ranges.push({ pickup: toDayKey(row.startsAt), return: toDayKey(row.endsAt) });
      grouped.set(row.vehicleId, ranges);
    }
    for (const [vehicleId, ranges] of grouped) {
      grouped.set(vehicleId, mergeUnavailableRanges(ranges));
    }
    return grouped;
  }

  /**
   * Jours déjà pris sur un an : demandes en attente, réservations confirmées ou en cours,
   * et entretiens. Aucun nom de client. Le matin du retour reste libre.
   */
  async availability(
    vehicleId: string,
  ): Promise<{ vehicleId: string; unavailable: UnavailableRange[] }> {
    const vehicle = await this.prisma.vehicle.findFirst({
      where: { id: vehicleId, status: 'ACTIVE', deletedAt: null, agency: { status: 'ACTIVE' } },
      select: { id: true },
    });
    if (vehicle === null) {
      throw new NotFoundException('Véhicule introuvable.');
    }
    const unavailable = (await this.unavailableByVehicle([vehicle.id])).get(vehicle.id) ?? [];
    return { vehicleId, unavailable };
  }
}
