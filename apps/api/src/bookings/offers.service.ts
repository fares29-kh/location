import {
  BLOCKING_BOOKING_STATUSES,
  type Offer,
  type OfferSearch,
  type OfferSearchResult,
  rentalWindow,
} from '@drivetn/types';
import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';

export const OFFERS_LIMIT = 60;

@Injectable()
export class OffersService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Véhicules disponibles des agences actives. Le lieu restreint au gouvernorat de l'agence ;
   * avec des dates, les véhicules déjà réservés sur le créneau sont exclus.
   */
  async search(query: OfferSearch): Promise<OfferSearchResult> {
    let governorateCode: string | undefined;
    if (query.location !== undefined && query.location.length > 0) {
      const location = await this.prisma.location.findUnique({
        where: { slug: query.location },
        select: { governorateCode: true, isActive: true },
      });
      if (!location?.isActive) {
        return { offers: [], days: null };
      }
      governorateCode = location.governorateCode;
    }

    const window =
      query.pickup !== undefined && query.return !== undefined && query.return > query.pickup
        ? rentalWindow(query.pickup, query.return)
        : null;

    const where: Prisma.VehicleWhereInput = {
      status: 'ACTIVE',
      category: query.category,
      agency: { status: 'ACTIVE', governorateCode },
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
          }),
    };

    const vehicles = await this.prisma.vehicle.findMany({
      where,
      include: { agency: true },
      orderBy: [{ dailyRateMillimes: 'asc' }, { id: 'asc' }],
      take: OFFERS_LIMIT,
    });

    const agencyIds = [...new Set(vehicles.map((vehicle) => vehicle.agencyId))];
    const ratings = await this.prisma.review.groupBy({
      by: ['agencyId'],
      where: { agencyId: { in: agencyIds } },
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
        category: vehicle.category,
        transmission: vehicle.transmission,
        fuel: vehicle.fuel,
        seats: vehicle.seats,
        airConditioning: vehicle.airConditioning,
        color: vehicle.color,
        dailyRateMillimes: vehicle.dailyRateMillimes,
        depositMillimes: vehicle.depositMillimes,
        mileageLimitKm: vehicle.mileageLimitKm,
        agency: {
          id: vehicle.agency.id,
          name: vehicle.agency.name,
          governorateCode: vehicle.agency.governorateCode,
          address: vehicle.agency.address,
          rating: rating?._avg.rating ?? null,
          reviewsCount: rating?._count._all ?? 0,
          instantConfirmation: vehicle.agency.instantConfirmation,
          freeCancellationHours: vehicle.agency.freeCancellationHours,
          minDriverAge: vehicle.agency.minDriverAge,
          acceptedPaymentMethods: vehicle.agency.acceptedPaymentMethods,
        },
      };
    });

    return { offers, days: window?.days ?? null };
  }
}
