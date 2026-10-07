import {
  agencyProfileSchema,
  applyBookingAction,
  type BookingStatus,
  bookingTransitionSchema,
  canApplyBookingAction,
  PAYMENT_METHODS,
  type PaymentMethod,
  recordPaymentSchema,
  rentalConditionsSchema,
  rentalDays,
  summarizePayments,
  vehicleInputSchema,
  type VehicleStatus,
} from '@drivetn/types';
import type { z } from 'zod';

import { ApiError } from '@/lib/api/errors';

import type { AgencyApi } from './api';
import { addDays, addMonths, dayKeyToDate, toDayKey, todayKey, toMonthKey } from './dates';
import { type AgencyDataset, createAgencyDataset } from './mock-data';
import type {
  Booking,
  BookingFilter,
  BookingRef,
  BookingView,
  Customer,
  CustomerView,
  Paginated,
  PaymentView,
  ReviewFilter,
  Vehicle,
  VehicleView,
} from './types';

const LATENCY_MS = 320;
const PAGE_SIZE = 10;
const DAY_MS = 86_400_000;

const FILTER_STATUSES: Record<Exclude<BookingFilter, 'all'>, readonly BookingStatus[]> = {
  pending: ['PENDING'],
  confirmed: ['CONFIRMED'],
  ongoing: ['PICKED_UP', 'RETURNED'],
  completed: ['COMPLETED'],
  cancelled: ['CANCELLED', 'REJECTED', 'NO_SHOW', 'EXPIRED'],
};

/** Réservations ayant réellement immobilisé le véhicule (prises en compte pour l'occupation). */
const RENTED_STATUSES: readonly BookingStatus[] = ['PICKED_UP', 'RETURNED', 'COMPLETED'];
const PLANNING_STATUSES: readonly BookingStatus[] = [
  'PENDING',
  'CONFIRMED',
  'PICKED_UP',
  'RETURNED',
  'COMPLETED',
];

const VEHICLE_COLORS = ['#2563EB', '#059669', '#DC2626', '#F59E0B', '#334155', '#7C3AED'];

function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function fullName(customer: Customer): string {
  return `${customer.firstName} ${customer.lastName}`;
}

function paginate<T>(items: T[], page: number, pageSize = PAGE_SIZE): Paginated<T> {
  const pageCount = Math.max(1, Math.ceil(items.length / pageSize));
  const current = Math.min(Math.max(1, page), pageCount);
  return {
    items: items.slice((current - 1) * pageSize, current * pageSize),
    total: items.length,
    page: current,
    pageSize,
    pageCount,
  };
}

function validate<T extends z.ZodType>(schema: T, input: unknown): z.output<T> {
  const result = schema.safeParse(input);
  if (!result.success) {
    throw new ApiError(
      400,
      'VALIDATION_ERROR',
      'Validation failed',
      result.error.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message })),
    );
  }
  return result.data;
}

function overlapMs(startA: number, endA: number, startB: number, endB: number): number {
  return Math.max(0, Math.min(endA, endB) - Math.max(startA, startB));
}

export function createMockAgencyApi(): AgencyApi {
  let dataset: AgencyDataset | null = null;
  const db = (): AgencyDataset => (dataset ??= createAgencyDataset());

  async function respond<T>(compute: () => T): Promise<T> {
    await new Promise((resolve) => setTimeout(resolve, LATENCY_MS * (0.6 + Math.random() * 0.8)));
    return structuredClone(compute());
  }

  function vehicleOf(id: string): Vehicle {
    const found = db().vehicles.find((item) => item.id === id);
    if (found === undefined) {
      throw new ApiError(404, 'NOT_FOUND', 'Vehicle not found');
    }
    return found;
  }

  function customerOf(id: string): Customer {
    const found = db().customers.find((item) => item.id === id);
    if (found === undefined) {
      throw new ApiError(404, 'NOT_FOUND', 'Customer not found');
    }
    return found;
  }

  function bookingOf(id: string): Booking {
    const found = db().bookings.find((item) => item.id === id);
    if (found === undefined) {
      throw new ApiError(404, 'NOT_FOUND', 'Booking not found');
    }
    return found;
  }

  function toView(booking: Booking): BookingView {
    const payments = db()
      .payments.filter((payment) => payment.bookingId === booking.id)
      .sort((a, b) => a.recordedAt.localeCompare(b.recordedAt));
    return {
      ...booking,
      vehicle: vehicleOf(booking.vehicleId),
      customer: customerOf(booking.customerId),
      payments,
      payment: summarizePayments(booking.totalMillimes, payments),
      days: rentalDays(new Date(booking.pickupAt), new Date(booking.returnAt)),
    };
  }

  function toRef(booking: Booking): BookingRef {
    return {
      id: booking.id,
      reference: booking.reference,
      pickupAt: booking.pickupAt,
      returnAt: booking.returnAt,
      status: booking.status,
      customerName: fullName(customerOf(booking.customerId)),
    };
  }

  function matchesBooking(view: BookingView, search: string): boolean {
    if (search.length === 0) {
      return true;
    }
    const digits = search.replace(/\D/g, '');
    const haystack = normalize(
      [
        view.reference,
        fullName(view.customer),
        view.vehicle.brand,
        view.vehicle.model,
        view.vehicle.plateNumber,
      ].join(' '),
    );
    return (
      haystack.includes(search) ||
      haystack.replace(/\s/g, '').includes(search.replace(/\s/g, '')) ||
      (digits.length >= 3 && view.customer.phone.includes(digits))
    );
  }

  function occupancy(vehicleIds: readonly string[], days: number, now: Date): number {
    if (vehicleIds.length === 0) {
      return 0;
    }
    const end = now.getTime();
    const start = end - days * DAY_MS;
    const rentedMs = db()
      .bookings.filter(
        (booking) =>
          vehicleIds.includes(booking.vehicleId) && RENTED_STATUSES.includes(booking.status),
      )
      .reduce(
        (total, booking) =>
          total +
          overlapMs(
            new Date(booking.pickupAt).getTime(),
            Math.min(new Date(booking.returnAt).getTime(), end),
            start,
            end,
          ),
        0,
      );
    return Math.min(1, rentedMs / (vehicleIds.length * days * DAY_MS));
  }

  /** `untilDay` limite au même quantième, pour comparer un mois en cours au précédent. */
  function inMonth(value: string, monthKey: string, untilDay = 31): boolean {
    const day = toDayKey(value);
    return day.startsWith(monthKey) && Number(day.slice(8, 10)) <= untilDay;
  }

  function rentalCollectedIn(monthKey: string, untilDay?: number): number {
    return db().payments.reduce((total, payment) => {
      if (!inMonth(payment.recordedAt, monthKey, untilDay)) {
        return total;
      }
      if (payment.kind === 'RENTAL') {
        return total + payment.amountMillimes;
      }
      return payment.kind === 'REFUND' ? total - payment.amountMillimes : total;
    }, 0);
  }

  function outstanding(): number {
    return db()
      .bookings.filter((booking) => RENTED_STATUSES.includes(booking.status))
      .reduce((total, booking) => total + toView(booking).payment.balanceMillimes, 0);
  }

  function onRentNow(vehicleId: string): Booking | undefined {
    return db().bookings.find(
      (booking) => booking.vehicleId === vehicleId && booking.status === 'PICKED_UP',
    );
  }

  function toVehicleView(vehicle: Vehicle, now: Date): VehicleView {
    const nowIso = now.toISOString();
    const next = db()
      .bookings.filter(
        (booking) =>
          booking.vehicleId === vehicle.id &&
          (booking.status === 'CONFIRMED' || booking.status === 'PENDING') &&
          booking.pickupAt >= nowIso,
      )
      .sort((a, b) => a.pickupAt.localeCompare(b.pickupAt))[0];
    const current = onRentNow(vehicle.id);
    const since = new Date(now.getTime() - 30 * DAY_MS).toISOString();
    return {
      ...vehicle,
      currentBooking: current === undefined ? null : toRef(current),
      nextBooking: next === undefined ? null : toRef(next),
      occupancyRate: occupancy([vehicle.id], 30, now),
      revenue30dMillimes: db()
        .bookings.filter(
          (booking) =>
            booking.vehicleId === vehicle.id &&
            RENTED_STATUSES.includes(booking.status) &&
            booking.pickupAt >= since,
        )
        .reduce((total, booking) => total + booking.totalMillimes, 0),
    };
  }

  function toCustomerView(customer: Customer): CustomerView {
    const bookings = db().bookings.filter((booking) => booking.customerId === customer.id);
    const last = bookings
      .map((booking) => booking.pickupAt)
      .sort()
      .at(-1);
    return {
      ...customer,
      bookingsCount: bookings.length,
      completedCount: bookings.filter((booking) => booking.status === 'COMPLETED').length,
      totalSpentMillimes: bookings.reduce(
        (total, booking) => total + toView(booking).payment.paidMillimes,
        0,
      ),
      lastBookingAt: last ?? null,
    };
  }

  function reviewStats() {
    const { reviews } = db();
    const distribution: [number, number, number, number, number] = [0, 0, 0, 0, 0];
    for (const review of reviews) {
      distribution[review.rating - 1] = (distribution[review.rating - 1] ?? 0) + 1;
    }
    const sum = reviews.reduce((total, review) => total + review.rating, 0);
    return {
      average: reviews.length === 0 ? 0 : sum / reviews.length,
      count: reviews.length,
      unansweredCount: reviews.filter((review) => review.reply === null).length,
      distribution,
    };
  }

  function pendingBookings(): Booking[] {
    return db()
      .bookings.filter((booking) => booking.status === 'PENDING')
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  return {
    isDemo: true,

    getDashboard: () =>
      respond(() => {
        const now = new Date();
        const today = todayKey(now);
        const month = toMonthKey(now);
        const previousMonth = addMonths(month, -1);
        const { bookings, vehicles } = db();
        const activeVehicles = vehicles.filter((vehicle) => vehicle.status === 'ACTIVE');
        const dayOfMonth = Number(today.slice(8, 10));
        const countable = (booking: Booking, monthKey: string) =>
          inMonth(booking.createdAt, monthKey, dayOfMonth) &&
          booking.status !== 'REJECTED' &&
          booking.status !== 'EXPIRED';
        const pending = pendingBookings();
        const onRent = activeVehicles.filter((vehicle) => onRentNow(vehicle.id) !== undefined);

        return {
          kpis: {
            revenueMonthMillimes: rentalCollectedIn(month),
            revenuePreviousMonthMillimes: rentalCollectedIn(previousMonth, dayOfMonth),
            bookingsMonth: bookings.filter((booking) => countable(booking, month)).length,
            bookingsPreviousMonth: bookings.filter((booking) => countable(booking, previousMonth))
              .length,
            occupancyRate: occupancy(
              activeVehicles.map((vehicle) => vehicle.id),
              30,
              now,
            ),
            outstandingMillimes: outstanding(),
          },
          pending: pending.slice(0, 5).map(toView),
          pendingCount: pending.length,
          departuresToday: bookings
            .filter(
              (booking) =>
                toDayKey(booking.pickupAt) === today &&
                (booking.status === 'CONFIRMED' || booking.status === 'PICKED_UP'),
            )
            .sort((a, b) => a.pickupAt.localeCompare(b.pickupAt))
            .map(toView),
          returnsToday: bookings
            .filter(
              (booking) =>
                toDayKey(booking.returnAt) === today &&
                (booking.status === 'PICKED_UP' ||
                  booking.status === 'RETURNED' ||
                  booking.status === 'COMPLETED'),
            )
            .sort((a, b) => a.returnAt.localeCompare(b.returnAt))
            .map(toView),
          revenueByMonth: Array.from({ length: 6 }, (_, index) => {
            const key = addMonths(month, index - 5);
            return { month: key, amountMillimes: rentalCollectedIn(key) };
          }),
          fleet: {
            available: activeVehicles.length - onRent.length,
            onRent: onRent.length,
            maintenance: vehicles.filter((vehicle) => vehicle.status === 'MAINTENANCE').length,
            inactive: vehicles.filter((vehicle) => vehicle.status === 'INACTIVE').length,
          },
          rating: { average: reviewStats().average, count: reviewStats().count },
        };
      }),

    getNavCounts: () =>
      respond(() => {
        const pending = pendingBookings();
        return {
          pendingBookings: pending.length,
          unansweredReviews: reviewStats().unansweredCount,
          latestPending: pending.slice(-5).reverse().map(toView),
        };
      }),

    listBookings: (query) =>
      respond(() => {
        const search = normalize(query.search);
        const matching = db()
          .bookings.map(toView)
          .filter((view) => matchesBooking(view, search));
        const counts = {
          all: matching.length,
          pending: 0,
          confirmed: 0,
          ongoing: 0,
          completed: 0,
          cancelled: 0,
        } satisfies Record<BookingFilter, number>;
        for (const view of matching) {
          for (const [filter, statuses] of Object.entries(FILTER_STATUSES)) {
            if (statuses.includes(view.status)) {
              counts[filter as Exclude<BookingFilter, 'all'>] += 1;
            }
          }
        }
        const { filter } = query;
        const filtered =
          filter === 'all'
            ? matching
            : matching.filter((view) => FILTER_STATUSES[filter].includes(view.status));
        const sorted = [...filtered].sort((a, b) => {
          switch (query.sort) {
            case 'pickup_asc':
              return a.pickupAt.localeCompare(b.pickupAt);
            case 'created_desc':
              return b.createdAt.localeCompare(a.createdAt);
            case 'pickup_desc':
              return b.pickupAt.localeCompare(a.pickupAt);
          }
        });
        return { ...paginate(sorted, query.page), counts };
      }),

    getBooking: (id) => respond(() => toView(bookingOf(id))),

    transitionBooking: (id, input) =>
      respond(() => {
        const { action, reason } = validate(bookingTransitionSchema, input);
        const booking = bookingOf(id);
        if (!canApplyBookingAction(booking.status, action)) {
          throw new ApiError(409, 'CONFLICT', 'Invalid booking transition');
        }
        booking.status = applyBookingAction(booking.status, action);
        booking.history.push({
          status: booking.status,
          at: new Date().toISOString(),
          reason: reason ?? null,
        });
        return toView(booking);
      }),

    recordPayment: (bookingId, input) =>
      respond(() => {
        const payment = validate(recordPaymentSchema, input);
        const booking = bookingOf(bookingId);
        const { payments } = db();
        payments.push({
          id: `pay_${String(payments.length + 1).padStart(4, '0')}`,
          bookingId: booking.id,
          kind: payment.kind,
          method: payment.method,
          amountMillimes: payment.amountMillimes,
          note: payment.note === undefined || payment.note.length === 0 ? null : payment.note,
          recordedAt: new Date().toISOString(),
        });
        return toView(booking);
      }),

    getPlanning: (from, days) =>
      respond(() => {
        const start = dayKeyToDate(from).getTime() - DAY_MS;
        const end = dayKeyToDate(addDays(from, days)).getTime() + DAY_MS;
        const { vehicles, bookings } = db();
        return {
          from,
          days,
          vehicles: vehicles.filter((vehicle) => vehicle.status !== 'INACTIVE'),
          bookings: bookings
            .filter(
              (booking) =>
                PLANNING_STATUSES.includes(booking.status) &&
                overlapMs(
                  new Date(booking.pickupAt).getTime(),
                  new Date(booking.returnAt).getTime(),
                  start,
                  end,
                ) > 0,
            )
            .map(toView),
        };
      }),

    listVehicles: () =>
      respond(() => {
        const now = new Date();
        return [...db().vehicles]
          .sort((a, b) => `${a.brand} ${a.model}`.localeCompare(`${b.brand} ${b.model}`))
          .map((vehicle) => toVehicleView(vehicle, now));
      }),

    createVehicle: (input) =>
      respond(() => {
        const data = validate(vehicleInputSchema, input);
        const { vehicles } = db();
        if (vehicles.some((vehicle) => vehicle.plateNumber === data.plateNumber)) {
          throw new ApiError(409, 'CONFLICT', 'Plate already used', [
            { path: 'plateNumber', message: 'PLATE_ALREADY_USED' },
          ]);
        }
        const vehicle: Vehicle = {
          ...data,
          id: `veh_${String(vehicles.length + 1).padStart(2, '0')}_${Date.now().toString(36)}`,
          status: 'ACTIVE',
          color: VEHICLE_COLORS[vehicles.length % VEHICLE_COLORS.length] ?? '#2563EB',
          mileageKm: 0,
          createdAt: new Date().toISOString(),
        };
        vehicles.push(vehicle);
        return toVehicleView(vehicle, new Date());
      }),

    updateVehicle: (id, input) =>
      respond(() => {
        const data = validate(vehicleInputSchema, input);
        const vehicle = vehicleOf(id);
        if (
          db().vehicles.some((other) => other.id !== id && other.plateNumber === data.plateNumber)
        ) {
          throw new ApiError(409, 'CONFLICT', 'Plate already used', [
            { path: 'plateNumber', message: 'PLATE_ALREADY_USED' },
          ]);
        }
        Object.assign(vehicle, data);
        return toVehicleView(vehicle, new Date());
      }),

    setVehicleStatus: (id, status: VehicleStatus) =>
      respond(() => {
        const vehicle = vehicleOf(id);
        if (status !== 'ACTIVE' && onRentNow(id) !== undefined) {
          throw new ApiError(409, 'CONFLICT', 'Vehicle is on rent');
        }
        vehicle.status = status;
        return toVehicleView(vehicle, new Date());
      }),

    listCustomers: (query) =>
      respond(() => {
        const search = normalize(query.search);
        const digits = search.replace(/\D/g, '');
        const views = db()
          .customers.map(toCustomerView)
          .filter((customer) => {
            if (search.length === 0) {
              return true;
            }
            const haystack = normalize(
              `${fullName(customer)} ${customer.email ?? ''} ${customer.city}`,
            );
            return (
              haystack.includes(search) || (digits.length >= 3 && customer.phone.includes(digits))
            );
          })
          .sort((a, b) => (b.lastBookingAt ?? '').localeCompare(a.lastBookingAt ?? ''));
        return paginate(views, query.page);
      }),

    getCustomer: (id) =>
      respond(() => {
        const customer = customerOf(id);
        return {
          ...toCustomerView(customer),
          bookings: db()
            .bookings.filter((booking) => booking.customerId === id)
            .sort((a, b) => b.pickupAt.localeCompare(a.pickupAt))
            .map(toView),
        };
      }),

    listPayments: (query) =>
      respond(() => {
        const { payments, bookings, customers } = db();
        const month = toMonthKey(new Date());
        const views: PaymentView[] = payments
          .filter(
            (payment) =>
              (query.kind === 'ALL' || payment.kind === query.kind) &&
              (query.method === 'ALL' || payment.method === query.method),
          )
          .sort((a, b) => b.recordedAt.localeCompare(a.recordedAt))
          .map((payment) => {
            const booking = bookings.find((item) => item.id === payment.bookingId);
            const customer = customers.find((item) => item.id === booking?.customerId);
            return {
              ...payment,
              bookingReference: booking?.reference ?? '',
              customerName: customer === undefined ? '' : fullName(customer),
            };
          });
        const thisMonth = payments.filter((payment) => toMonthKey(payment.recordedAt) === month);
        const byMethod = Object.fromEntries(PAYMENT_METHODS.map((method) => [method, 0])) as Record<
          PaymentMethod,
          number
        >;
        for (const payment of thisMonth) {
          if (payment.kind === 'RENTAL') {
            byMethod[payment.method] += payment.amountMillimes;
          }
        }
        const depositsHeld = bookings.reduce(
          (total, booking) => total + toView(booking).payment.depositHeldMillimes,
          0,
        );
        return {
          ...paginate(views, query.page, 12),
          summary: {
            collectedMonthMillimes: rentalCollectedIn(month),
            refundedMonthMillimes: thisMonth
              .filter((payment) => payment.kind === 'REFUND')
              .reduce((total, payment) => total + payment.amountMillimes, 0),
            outstandingMillimes: outstanding(),
            depositsHeldMillimes: depositsHeld,
            byMethod,
          },
        };
      }),

    listReviews: (filter: ReviewFilter) =>
      respond(() => {
        const items = [...db().reviews]
          .filter((review) => {
            switch (filter) {
              case 'unanswered':
                return review.reply === null;
              case 'positive':
                return review.rating >= 4;
              case 'critical':
                return review.rating <= 3;
              case 'all':
                return true;
            }
          })
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
        return { items, ...reviewStats() };
      }),

    replyToReview: (id, reply) =>
      respond(() => {
        const review = db().reviews.find((item) => item.id === id);
        if (review === undefined) {
          throw new ApiError(404, 'NOT_FOUND', 'Review not found');
        }
        const text = reply.trim();
        if (text.length === 0 || text.length > 1000) {
          throw new ApiError(400, 'VALIDATION_ERROR', 'Invalid reply', [
            { path: 'reply', message: text.length === 0 ? 'REQUIRED' : 'TOO_LONG' },
          ]);
        }
        review.reply = text;
        review.repliedAt = new Date().toISOString();
        return review;
      }),

    getSettings: () => respond(() => db().settings),

    updateProfile: (input) =>
      respond(() => {
        db().settings.profile = validate(agencyProfileSchema, input);
        return db().settings;
      }),

    updateConditions: (input) =>
      respond(() => {
        db().settings.conditions = validate(rentalConditionsSchema, input);
        return db().settings;
      }),
  };
}
