import {
  addDays,
  type AgencySettings,
  type BookingRef,
  type BookingView,
  type Customer,
  type CustomerView,
  type LocalizedText,
  localizedTextSchema,
  normalizeTunisianPhone,
  type PaymentRecord,
  type PlanningBooking,
  publicReviewAuthor,
  rentalDays,
  type Review,
  summarizePayments,
  toDayKey,
  type Vehicle,
  type VehicleMaintenance,
  type VehicleView,
} from '@drivetn/types';
import type { Prisma } from '@prisma/client';

import { toVehiclePhoto } from '../storage/vehicle-photos';
import type {
  BOOKING_REF_INCLUDE,
  BOOKING_VIEW_INCLUDE,
  CUSTOMER_SELECT,
  CustomerPageRow,
  NextBookingRow,
  PLANNING_BOOKING_SELECT,
  REVIEW_INCLUDE,
  VEHICLE_CATEGORY_INCLUDE,
} from './agency.queries';

type VehicleRow = Prisma.VehicleGetPayload<{
  include: { photos: true; category: typeof VEHICLE_CATEGORY_INCLUDE };
}>;
type PlanningBookingRow = Prisma.BookingGetPayload<{ select: typeof PLANNING_BOOKING_SELECT }>;
type CustomerRow = Prisma.UserGetPayload<{ select: typeof CUSTOMER_SELECT }>;
type PaymentRow = Prisma.PaymentGetPayload<object>;
export type BookingViewRow = Prisma.BookingGetPayload<{ include: typeof BOOKING_VIEW_INCLUDE }>;
export type BookingRefRow = Prisma.BookingGetPayload<{ include: typeof BOOKING_REF_INCLUDE }>;
type ReviewRow = Prisma.ReviewGetPayload<{ include: typeof REVIEW_INCLUDE }>;

const UNKNOWN_PLACE: LocalizedText = { fr: '—', ar: '—', en: '—' };

export function toPlace(value: Prisma.JsonValue): LocalizedText {
  const parsed = localizedTextSchema.safeParse(value);
  return parsed.success ? parsed.data : UNKNOWN_PLACE;
}

export function toVehicle(row: VehicleRow, publicUrl: (key: string) => string): Vehicle {
  return {
    id: row.id,
    brand: row.brand,
    model: row.model,
    year: row.year,
    plateNumber: row.plateNumber,
    category: row.category.slug,
    transmission: row.transmission,
    fuel: row.fuel,
    seats: row.seats,
    airConditioning: row.airConditioning,
    dailyRateMillimes: row.dailyRateMillimes,
    depositMillimes: row.depositMillimes,
    mileageLimitKm: row.mileageLimitKm,
    status: row.status,
    photos: row.photos.map((photo) => toVehiclePhoto(photo, publicUrl)),
    color: row.color,
    mileageKm: row.mileageKm,
    createdAt: row.createdAt.toISOString(),
  };
}

export function toCustomer(row: CustomerRow): Customer {
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

export function toPayment(row: PaymentRow): PaymentRecord {
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

type BookingRefSource = Pick<
  BookingRefRow,
  'id' | 'reference' | 'pickupAt' | 'returnAt' | 'status'
> & {
  customer: { firstName: string; lastName: string };
};

export function nextBookingRef(row: NextBookingRow): BookingRefSource {
  return {
    id: row.id,
    reference: row.reference,
    pickupAt: row.pickup_at,
    returnAt: row.return_at,
    status: row.status,
    customer: { firstName: row.first_name, lastName: row.last_name },
  };
}

export function toBookingRef(row: BookingRefSource): BookingRef {
  return {
    id: row.id,
    reference: row.reference,
    pickupAt: row.pickupAt.toISOString(),
    returnAt: row.returnAt.toISOString(),
    status: row.status,
    customerName: `${row.customer.firstName} ${row.customer.lastName}`,
  };
}

export function toBookingView(
  row: BookingViewRow,
  publicUrl: (key: string) => string,
): BookingView {
  const payments = row.payments.map(toPayment);
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
    vehicle: toVehicle(row.vehicle, publicUrl),
    customer: toCustomer(row.customer),
    payments,
    payment: summarizePayments(row.totalMillimes, payments),
    days: rentalDays(row.pickupAt, row.returnAt),
  };
}

export function toPlanningBooking(row: PlanningBookingRow): PlanningBooking {
  return {
    id: row.id,
    reference: row.reference,
    vehicleId: row.vehicleId,
    status: row.status,
    pickupAt: row.pickupAt.toISOString(),
    returnAt: row.returnAt.toISOString(),
    totalMillimes: row.totalMillimes,
    customer: row.customer,
  };
}

/** Bornes [startsAt, endsAt[ à minuit (Tunis) → premier et dernier jour inclus. */
export function toMaintenance(
  row: Prisma.VehicleMaintenanceGetPayload<object>,
): VehicleMaintenance {
  return {
    id: row.id,
    vehicleId: row.vehicleId,
    from: toDayKey(row.startsAt),
    to: addDays(toDayKey(row.endsAt), -1),
    note: row.note,
  };
}

export function toVehicleView(
  row: VehicleRow,
  stats: Pick<VehicleView, 'occupancyRate' | 'revenue30dMillimes'> & {
    currentBooking: BookingRefSource | null;
    nextBooking: BookingRefSource | null;
  },
  publicUrl: (key: string) => string,
): VehicleView {
  return {
    ...toVehicle(row, publicUrl),
    currentBooking: stats.currentBooking === null ? null : toBookingRef(stats.currentBooking),
    nextBooking: stats.nextBooking === null ? null : toBookingRef(stats.nextBooking),
    occupancyRate: stats.occupancyRate,
    revenue30dMillimes: stats.revenue30dMillimes,
  };
}

export function toCustomerView(row: CustomerPageRow): CustomerView {
  return {
    id: row.id,
    firstName: row.first_name,
    lastName: row.last_name,
    phone: normalizeTunisianPhone(row.phone),
    email: row.email,
    city: row.city ?? '',
    createdAt: row.created_at.toISOString(),
    bookingsCount: row.bookings_count,
    completedCount: row.completed_count,
    totalSpentMillimes: Number(row.total_spent),
    lastBookingAt: row.last_booking_at.toISOString(),
  };
}

export function toReview(row: ReviewRow): Review {
  const { customer, vehicle } = row.booking;
  return {
    id: row.id,
    bookingId: row.bookingId,
    customerName: publicReviewAuthor(customer.firstName, customer.lastName),
    vehicleName: `${vehicle.brand} ${vehicle.model}`,
    rating: row.rating,
    comment: row.comment,
    createdAt: row.createdAt.toISOString(),
    reply: row.reply,
    repliedAt: row.repliedAt?.toISOString() ?? null,
  };
}

export function toSettings(
  agency: Prisma.AgencyGetPayload<object>,
  publicUrl: (key: string) => string,
): AgencySettings {
  return {
    logoUrl: agency.logoKey === null ? null : publicUrl(agency.logoKey),
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
