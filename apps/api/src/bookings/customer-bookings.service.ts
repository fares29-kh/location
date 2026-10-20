import { randomInt } from 'node:crypto';

import {
  BLOCKING_BOOKING_STATUSES,
  type CancelBookingInput,
  canCustomerCancel,
  type CreateBookingInput,
  type CustomerBooking,
  type LocalizedText,
  rentalDays,
  rentalPriceMillimes,
  rentalWindow,
  todayKey,
} from '@drivetn/types';
import { HttpStatus, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { toPlace } from '../agency/agency.mapper';
import { AuditService } from '../audit/audit.service';
import { AppException } from '../common/errors/app.exception';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';

const REFERENCE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const REFERENCE_ATTEMPTS = 5;

const CUSTOMER_BOOKING_INCLUDE = {
  vehicle: { include: { category: { select: { slug: true } } } },
  agency: true,
  events: { orderBy: { createdAt: 'asc' } },
} satisfies Prisma.BookingInclude;

type CustomerBookingRow = Prisma.BookingGetPayload<{ include: typeof CUSTOMER_BOOKING_INCLUDE }>;

function newReference(): string {
  return `DTN-${Array.from({ length: 6 }, () => REFERENCE_ALPHABET.charAt(randomInt(REFERENCE_ALPHABET.length))).join('')}`;
}

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

function unavailable(): AppException {
  return new AppException(
    HttpStatus.CONFLICT,
    'VEHICLE_UNAVAILABLE',
    'Ce véhicule n’est plus disponible sur ces dates.',
  );
}

function toCustomerBooking(
  row: CustomerBookingRow,
  now: Date,
  publicUrl: (key: string) => string,
): CustomerBooking {
  return {
    id: row.id,
    reference: row.reference,
    status: row.status,
    pickupAt: row.pickupAt.toISOString(),
    returnAt: row.returnAt.toISOString(),
    pickupLocation: toPlace(row.pickupPlace),
    days: rentalDays(row.pickupAt, row.returnAt),
    dailyRateMillimes: row.dailyRateMillimes,
    totalMillimes: row.totalMillimes,
    depositMillimes: row.depositMillimes,
    customerNote: row.customerNote,
    createdAt: row.createdAt.toISOString(),
    canCancel: canCustomerCancel(row.status, row.pickupAt, now),
    history: row.events.map((event) => ({
      status: event.status,
      at: event.createdAt.toISOString(),
      reason: event.reason,
    })),
    vehicle: {
      brand: row.vehicle.brand,
      model: row.vehicle.model,
      category: row.vehicle.category.slug,
      transmission: row.vehicle.transmission,
      seats: row.vehicle.seats,
      color: row.vehicle.color,
    },
    agency: {
      name: row.agency.name,
      logoUrl: row.agency.logoKey === null ? null : publicUrl(row.agency.logoKey),
      phone: row.agency.phone,
      whatsappPhone: row.agency.whatsappPhone,
      address: row.agency.address,
    },
  };
}

@Injectable()
export class CustomerBookingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly storage: StorageService,
  ) {}

  private publicUrl = (key: string): string => this.storage.publicUrl(key);

  async list(customerId: string): Promise<CustomerBooking[]> {
    const rows = await this.prisma.booking.findMany({
      where: { customerId },
      include: CUSTOMER_BOOKING_INCLUDE,
      orderBy: { pickupAt: 'desc' },
    });
    const now = new Date();
    return rows.map((row) => toCustomerBooking(row, now, this.publicUrl));
  }

  /**
   * Demande de réservation. Le véhicule est verrouillé le temps de vérifier le créneau, pour
   * que deux demandes simultanées ne puissent pas obtenir la même voiture.
   */
  async create(
    customerId: string,
    input: CreateBookingInput,
    ip: string | null,
  ): Promise<CustomerBooking> {
    if (input.pickup < todayKey()) {
      throw new AppException(HttpStatus.BAD_REQUEST, 'VALIDATION_ERROR', 'Date passée.', [
        { path: 'pickup', message: 'PAST_DATE' },
      ]);
    }
    const location = await this.prisma.location.findUnique({ where: { slug: input.location } });
    if (!location?.isActive) {
      throw new AppException(HttpStatus.BAD_REQUEST, 'VALIDATION_ERROR', 'Lieu inconnu.', [
        { path: 'location', message: 'REQUIRED' },
      ]);
    }
    const place: LocalizedText = { fr: location.nameFr, ar: location.nameAr, en: location.nameEn };
    const { pickupAt, returnAt, days } = rentalWindow(input.pickup, input.return);

    for (let attempt = 1; ; attempt += 1) {
      try {
        const booking = await this.prisma.$transaction(async (tx) => {
          await tx.$queryRaw`SELECT id FROM vehicles WHERE id = ${input.vehicleId} FOR UPDATE`;
          const vehicle = await tx.vehicle.findUnique({
            where: { id: input.vehicleId },
            include: { agency: true },
          });
          if (vehicle?.status !== 'ACTIVE' || vehicle.agency.status !== 'ACTIVE') {
            throw unavailable();
          }
          const overlapping = await tx.booking.count({
            where: {
              vehicleId: vehicle.id,
              status: { in: [...BLOCKING_BOOKING_STATUSES] },
              pickupAt: { lt: returnAt },
              returnAt: { gt: pickupAt },
            },
          });
          const maintenance = await tx.vehicleMaintenance.count({
            where: { vehicleId: vehicle.id, startsAt: { lt: returnAt }, endsAt: { gt: pickupAt } },
          });
          if (overlapping > 0 || maintenance > 0) {
            throw unavailable();
          }
          const instant = vehicle.agency.instantConfirmation;
          return tx.booking.create({
            data: {
              reference: newReference(),
              agencyId: vehicle.agencyId,
              vehicleId: vehicle.id,
              customerId,
              pickupLocationId: location.id,
              pickupAt,
              returnAt,
              pickupPlace: place,
              returnPlace: place,
              status: instant ? 'CONFIRMED' : 'PENDING',
              dailyRateMillimes: vehicle.dailyRateMillimes,
              totalMillimes: rentalPriceMillimes(vehicle.dailyRateMillimes, days),
              depositMillimes: vehicle.depositMillimes,
              customerNote: input.note === undefined || input.note.length === 0 ? null : input.note,
              events: {
                create: instant
                  ? [{ status: 'PENDING' }, { status: 'CONFIRMED', reason: null }]
                  : [{ status: 'PENDING' }],
              },
            },
            include: CUSTOMER_BOOKING_INCLUDE,
          });
        });
        await this.audit.log({
          action: 'booking.created',
          actorId: customerId,
          entityType: 'booking',
          entityId: booking.id,
          metadata: { vehicleId: booking.vehicleId, status: booking.status },
          ip,
        });
        return toCustomerBooking(booking, new Date(), this.publicUrl);
      } catch (error) {
        if (isUniqueViolation(error) && attempt < REFERENCE_ATTEMPTS) {
          continue;
        }
        throw error;
      }
    }
  }

  async cancel(
    customerId: string,
    bookingId: string,
    input: CancelBookingInput,
    ip: string | null,
  ): Promise<CustomerBooking> {
    const booking = await this.prisma.booking.findFirst({
      where: { id: bookingId, customerId },
    });
    if (booking === null) {
      throw new NotFoundException('Réservation introuvable.');
    }
    if (!canCustomerCancel(booking.status, booking.pickupAt, new Date())) {
      throw new AppException(
        HttpStatus.CONFLICT,
        'BOOKING_NOT_CANCELLABLE',
        'Cette réservation ne peut plus être annulée.',
      );
    }
    const updated = await this.prisma.booking.updateMany({
      where: { id: booking.id, status: booking.status },
      data: { status: 'CANCELLED' },
    });
    if (updated.count === 0) {
      throw new AppException(
        HttpStatus.CONFLICT,
        'BOOKING_NOT_CANCELLABLE',
        'Cette réservation ne peut plus être annulée.',
      );
    }
    await this.prisma.bookingEvent.create({
      data: {
        bookingId: booking.id,
        status: 'CANCELLED',
        reason: input.reason ?? 'Annulation à la demande du client.',
        actorId: customerId,
      },
    });
    await this.audit.log({
      action: 'booking.cancelled_by_customer',
      actorId: customerId,
      entityType: 'booking',
      entityId: booking.id,
      ip,
    });
    const row = await this.prisma.booking.findUniqueOrThrow({
      where: { id: booking.id },
      include: CUSTOMER_BOOKING_INCLUDE,
    });
    return toCustomerBooking(row, new Date(), this.publicUrl);
  }
}
