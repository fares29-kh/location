import {
  type AgencyDataset,
  type AgencySettings,
  type Booking,
  type Customer,
  type LocalizedText,
  localizedTextSchema,
  normalizeTunisianPhone,
  type PaymentRecord,
  type Review,
  type Vehicle,
} from '@drivetn/types';
import type { Prisma } from '@prisma/client';

export const AGENCY_DATASET_INCLUDE = {
  vehicles: true,
  bookings: {
    include: {
      events: { orderBy: { createdAt: 'asc' } },
      payments: true,
      customer: true,
      review: true,
    },
  },
} satisfies Prisma.AgencyInclude;

export type AgencyWithDataset = Prisma.AgencyGetPayload<{ include: typeof AGENCY_DATASET_INCLUDE }>;
type VehicleRow = AgencyWithDataset['vehicles'][number];
type BookingRow = AgencyWithDataset['bookings'][number];

const UNKNOWN_PLACE: LocalizedText = { fr: '—', ar: '—', en: '—' };

export function toPlace(value: Prisma.JsonValue): LocalizedText {
  const parsed = localizedTextSchema.safeParse(value);
  return parsed.success ? parsed.data : UNKNOWN_PLACE;
}

export function toVehicle(row: VehicleRow): Vehicle {
  return {
    id: row.id,
    brand: row.brand,
    model: row.model,
    year: row.year,
    plateNumber: row.plateNumber,
    category: row.category,
    transmission: row.transmission,
    fuel: row.fuel,
    seats: row.seats,
    airConditioning: row.airConditioning,
    dailyRateMillimes: row.dailyRateMillimes,
    depositMillimes: row.depositMillimes,
    mileageLimitKm: row.mileageLimitKm,
    status: row.status,
    color: row.color,
    mileageKm: row.mileageKm,
    createdAt: row.createdAt.toISOString(),
  };
}

function toBooking(row: BookingRow): Booking {
  return {
    id: row.id,
    reference: row.reference,
    vehicleId: row.vehicleId,
    customerId: row.customerId,
    pickupAt: row.pickupAt.toISOString(),
    returnAt: row.returnAt.toISOString(),
    pickupLocation: toPlace(row.pickupPlace),
    returnLocation: toPlace(row.returnPlace),
    status: row.status,
    dailyRateMillimes: row.dailyRateMillimes,
    totalMillimes: row.totalMillimes,
    depositMillimes: row.depositMillimes,
    customerNote: row.customerNote,
    createdAt: row.createdAt.toISOString(),
    history: row.events.map((event) => ({
      status: event.status,
      at: event.createdAt.toISOString(),
      reason: event.reason,
    })),
  };
}

function toCustomer(row: BookingRow['customer']): Customer {
  return {
    id: row.id,
    firstName: row.firstName,
    lastName: row.lastName,
    phone: normalizeTunisianPhone(row.phone),
    email: row.email,
    city: row.city ?? '',
    createdAt: row.createdAt.toISOString(),
  };
}

function toPayment(row: BookingRow['payments'][number]): PaymentRecord {
  return {
    id: row.id,
    bookingId: row.bookingId,
    kind: row.kind,
    method: row.method,
    amountMillimes: row.amountMillimes,
    recordedAt: row.recordedAt.toISOString(),
    note: row.note,
  };
}

export function toSettings(
  agency: AgencyWithDataset | Prisma.AgencyGetPayload<object>,
): AgencySettings {
  return {
    profile: {
      name: agency.name,
      phone: agency.phone,
      whatsappPhone: agency.whatsappPhone,
      email: agency.email ?? undefined,
      address: agency.address,
      governorateCode: agency.governorateCode,
      description: agency.description,
    },
    conditions: {
      minDriverAge: agency.minDriverAge,
      minLicenseYears: agency.minLicenseYears,
      freeCancellationHours: agency.freeCancellationHours,
      instantConfirmation: agency.instantConfirmation,
      acceptedPaymentMethods: agency.acceptedPaymentMethods,
    },
  };
}

/** Convertit les lignes PostgreSQL d'une agence en jeu de données pour `createAgencyQueries`. */
export function toAgencyDataset(agency: AgencyWithDataset): AgencyDataset {
  const vehicleNames = new Map(
    agency.vehicles.map((vehicle) => [vehicle.id, `${vehicle.brand} ${vehicle.model}`]),
  );
  const customers = new Map<string, Customer>();
  const payments: PaymentRecord[] = [];
  const reviews: Review[] = [];

  for (const booking of agency.bookings) {
    customers.set(booking.customerId, toCustomer(booking.customer));
    payments.push(...booking.payments.map(toPayment));
    if (booking.review !== null && booking.review.moderationStatus !== 'HIDDEN') {
      const { review, customer } = booking;
      reviews.push({
        id: review.id,
        bookingId: booking.id,
        customerName: `${customer.firstName} ${customer.lastName.charAt(0)}.`,
        vehicleName: vehicleNames.get(booking.vehicleId) ?? '',
        rating: review.rating,
        comment: review.comment,
        createdAt: review.createdAt.toISOString(),
        reply: review.reply,
        repliedAt: review.repliedAt?.toISOString() ?? null,
      });
    }
  }

  return {
    vehicles: agency.vehicles.map(toVehicle),
    customers: [...customers.values()],
    bookings: agency.bookings.map(toBooking),
    payments,
    reviews,
    settings: toSettings(agency),
  };
}
