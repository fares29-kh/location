import {
  AGENCY_LIST_LIMIT_DEFAULT,
  type AgencySettings,
  type Booking,
  type BookingFilter,
  type BookingList,
  type BookingQuery,
  type BookingRef,
  type BookingView,
  type Customer,
  type CustomerDetail,
  type CustomerQuery,
  type CustomerView,
  type DashboardData,
  type NavCounts,
  type Paginated,
  type PaymentList,
  type PaymentQuery,
  type PaymentRecord,
  type PaymentView,
  type PlanningBooking,
  type PlanningData,
  type Review,
  type ReviewList,
  type ReviewQuery,
  type Vehicle,
  type VehicleView,
} from './agency-portal';
import {
  type BookingStatus,
  PAYMENT_METHODS,
  type PaymentMethod,
  rentalDays,
  summarizePayments,
} from './booking';
import {
  addDays,
  addMonths,
  type DayKey,
  toDayKey,
  todayKey,
  toMonthKey,
  tunisDateTime,
} from './dates';

/** Données d'une agence à partir desquelles toutes les vues du portail sont calculées. */
export interface AgencyDataset {
  vehicles: Vehicle[];
  customers: Customer[];
  bookings: Booking[];
  payments: PaymentRecord[];
  reviews: Review[];
  settings: AgencySettings;
}

export const AGENCY_PAGE_SIZE = 10;
export const AGENCY_PAYMENTS_PAGE_SIZE = 12;
const DAY_MS = 86_400_000;

export const BOOKING_FILTER_STATUSES: Record<
  Exclude<BookingFilter, 'all'>,
  readonly BookingStatus[]
> = {
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

export function normalizeSearch(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function fullName(customer: Customer): string {
  return `${customer.firstName} ${customer.lastName}`;
}

export function paginate<T>(items: T[], page: number, pageSize = AGENCY_PAGE_SIZE): Paginated<T> {
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

function overlapMs(startA: number, endA: number, startB: number, endB: number): number {
  return Math.max(0, Math.min(endA, endB) - Math.max(startA, startB));
}

/** `untilDay` limite au même quantième, pour comparer un mois en cours au précédent. */
function inMonth(value: string, monthKey: string, untilDay = 31): boolean {
  const day = toDayKey(value);
  return day.startsWith(monthKey) && Number(day.slice(8, 10)) <= untilDay;
}

/**
 * Vues du portail agence calculées à partir d'un jeu de données. Les mêmes calculs servent
 * à l'API (données PostgreSQL) et aux tests ; les lectures inconnues renvoient `undefined`.
 */
export function createAgencyQueries(data: AgencyDataset, now: Date = new Date()) {
  const vehiclesById = new Map(data.vehicles.map((vehicle) => [vehicle.id, vehicle]));
  const customersById = new Map(data.customers.map((customer) => [customer.id, customer]));
  const paymentsByBooking = new Map<string, PaymentRecord[]>();
  for (const payment of data.payments) {
    const list = paymentsByBooking.get(payment.bookingId) ?? [];
    list.push(payment);
    paymentsByBooking.set(payment.bookingId, list);
  }

  function vehicleOf(id: string): Vehicle {
    const found = vehiclesById.get(id);
    if (found === undefined) {
      throw new Error(`Véhicule inconnu : ${id}`);
    }
    return found;
  }

  function customerOf(id: string): Customer {
    const found = customersById.get(id);
    if (found === undefined) {
      throw new Error(`Client inconnu : ${id}`);
    }
    return found;
  }

  function toView(booking: Booking): BookingView {
    const payments = [...(paymentsByBooking.get(booking.id) ?? [])].sort((a, b) =>
      a.recordedAt.localeCompare(b.recordedAt),
    );
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
    const haystack = normalizeSearch(
      [
        view.reference,
        fullName(view.customer),
        view.vehicle.brand,
        view.vehicle.model,
        view.vehicle.plateNumber ?? '',
      ].join(' '),
    );
    return (
      haystack.includes(search) ||
      haystack.replace(/\s/g, '').includes(search.replace(/\s/g, '')) ||
      (digits.length >= 3 && view.customer.phone.includes(digits))
    );
  }

  function occupancy(vehicleIds: readonly string[], days: number): number {
    if (vehicleIds.length === 0) {
      return 0;
    }
    const end = now.getTime();
    const start = end - days * DAY_MS;
    const rentedMs = data.bookings
      .filter(
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

  function rentalCollectedIn(monthKey: string, untilDay?: number): number {
    return data.payments.reduce((total, payment) => {
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
    return data.bookings
      .filter((booking) => RENTED_STATUSES.includes(booking.status))
      .reduce((total, booking) => total + toView(booking).payment.balanceMillimes, 0);
  }

  function onRentNow(vehicleId: string): Booking | undefined {
    return data.bookings.find(
      (booking) => booking.vehicleId === vehicleId && booking.status === 'PICKED_UP',
    );
  }

  function toVehicleView(vehicle: Vehicle): VehicleView {
    const nowIso = now.toISOString();
    const next = data.bookings
      .filter(
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
      occupancyRate: occupancy([vehicle.id], 30),
      revenue30dMillimes: data.bookings
        .filter(
          (booking) =>
            booking.vehicleId === vehicle.id &&
            RENTED_STATUSES.includes(booking.status) &&
            booking.pickupAt >= since,
        )
        .reduce((total, booking) => total + booking.totalMillimes, 0),
    };
  }

  function toCustomerView(customer: Customer): CustomerView {
    const bookings = data.bookings.filter((booking) => booking.customerId === customer.id);
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
    const { reviews } = data;
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
    return data.bookings
      .filter((booking) => booking.status === 'PENDING')
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  return {
    isOnRent: (vehicleId: string): boolean => onRentNow(vehicleId) !== undefined,

    getDashboard(): DashboardData {
      const today = todayKey(now);
      const month = toMonthKey(now);
      const previousMonth = addMonths(month, -1);
      const { bookings, vehicles } = data;
      const activeVehicles = vehicles.filter((vehicle) => vehicle.status === 'ACTIVE');
      const dayOfMonth = Number(today.slice(8, 10));
      const countable = (booking: Booking, monthKey: string) =>
        inMonth(booking.createdAt, monthKey, dayOfMonth) &&
        booking.status !== 'REJECTED' &&
        booking.status !== 'EXPIRED';
      const pending = pendingBookings();
      const onRent = activeVehicles.filter((vehicle) => onRentNow(vehicle.id) !== undefined);
      const stats = reviewStats();

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
        rating: { average: stats.average, count: stats.count },
      };
    },

    getNavCounts(): NavCounts {
      const pending = pendingBookings();
      return {
        pendingBookings: pending.length,
        unansweredReviews: reviewStats().unansweredCount,
        latestPending: pending.slice(-5).reverse().map(toView),
      };
    },

    listBookings(query: BookingQuery): BookingList {
      const search = normalizeSearch(query.search);
      const matching = data.bookings.map(toView).filter((view) => matchesBooking(view, search));
      const counts = {
        all: matching.length,
        pending: 0,
        confirmed: 0,
        ongoing: 0,
        completed: 0,
        cancelled: 0,
      } satisfies Record<BookingFilter, number>;
      for (const view of matching) {
        for (const [filter, statuses] of Object.entries(BOOKING_FILTER_STATUSES)) {
          if (statuses.includes(view.status)) {
            counts[filter as Exclude<BookingFilter, 'all'>] += 1;
          }
        }
      }
      const { filter } = query;
      const filtered =
        filter === 'all'
          ? matching
          : matching.filter((view) => BOOKING_FILTER_STATUSES[filter].includes(view.status));
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
      return { ...paginate(sorted, query.page, query.limit), counts };
    },

    getBooking(id: string): BookingView | undefined {
      const booking = data.bookings.find((item) => item.id === id);
      return booking === undefined ? undefined : toView(booking);
    },

    /** Réservations qui chevauchent [from, to[, bornes à minuit heure de Tunis. */
    getPlanning(from: DayKey, days: number): PlanningData {
      const to = addDays(from, days);
      const start = tunisDateTime(from, 0).getTime();
      const end = tunisDateTime(to, 0).getTime();
      return {
        from,
        to,
        days,
        vehicles: data.vehicles.filter((vehicle) => vehicle.status !== 'INACTIVE'),
        bookings: data.bookings
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
          .map((booking): PlanningBooking => {
            const customer = customerOf(booking.customerId);
            return {
              id: booking.id,
              reference: booking.reference,
              vehicleId: booking.vehicleId,
              status: booking.status,
              pickupAt: booking.pickupAt,
              returnAt: booking.returnAt,
              totalMillimes: booking.totalMillimes,
              customer: {
                id: customer.id,
                firstName: customer.firstName,
                lastName: customer.lastName,
              },
            };
          }),
      };
    },

    listVehicles(): VehicleView[] {
      return [...data.vehicles]
        .sort((a, b) => `${a.brand} ${a.model}`.localeCompare(`${b.brand} ${b.model}`))
        .map(toVehicleView);
    },

    getVehicle(id: string): VehicleView | undefined {
      const vehicle = vehiclesById.get(id);
      return vehicle === undefined ? undefined : toVehicleView(vehicle);
    },

    listCustomers(query: CustomerQuery): Paginated<CustomerView> {
      const search = normalizeSearch(query.search);
      const digits = search.replace(/\D/g, '');
      const views = data.customers
        .map(toCustomerView)
        .filter((customer) => {
          if (search.length === 0) {
            return true;
          }
          const haystack = normalizeSearch(
            `${fullName(customer)} ${customer.email ?? ''} ${customer.city}`,
          );
          return (
            haystack.includes(search) || (digits.length >= 3 && customer.phone.includes(digits))
          );
        })
        .sort((a, b) => (b.lastBookingAt ?? '').localeCompare(a.lastBookingAt ?? ''));
      return paginate(views, query.page, query.limit);
    },

    getCustomer(id: string): CustomerDetail | undefined {
      const customer = customersById.get(id);
      if (customer === undefined) {
        return undefined;
      }
      return {
        ...toCustomerView(customer),
        bookings: data.bookings
          .filter((booking) => booking.customerId === id)
          .sort((a, b) => b.pickupAt.localeCompare(a.pickupAt))
          .map(toView),
      };
    },

    listPayments(query: PaymentQuery): PaymentList {
      const { payments, bookings } = data;
      const month = toMonthKey(now);
      const bookingsById = new Map(bookings.map((booking) => [booking.id, booking]));
      const views: PaymentView[] = payments
        .filter(
          (payment) =>
            (query.kind === 'ALL' || payment.kind === query.kind) &&
            (query.method === 'ALL' || payment.method === query.method),
        )
        .sort((a, b) => b.recordedAt.localeCompare(a.recordedAt))
        .map((payment) => {
          const booking = bookingsById.get(payment.bookingId);
          const customer =
            booking === undefined ? undefined : customersById.get(booking.customerId);
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
      return {
        ...paginate(views, query.page, query.limit ?? AGENCY_PAYMENTS_PAGE_SIZE),
        summary: {
          collectedMonthMillimes: rentalCollectedIn(month),
          refundedMonthMillimes: thisMonth
            .filter((payment) => payment.kind === 'REFUND')
            .reduce((total, payment) => total + payment.amountMillimes, 0),
          outstandingMillimes: outstanding(),
          depositsHeldMillimes: bookings.reduce(
            (total, booking) => total + toView(booking).payment.depositHeldMillimes,
            0,
          ),
          byMethod,
        },
      };
    },

    listReviews(query: ReviewQuery): ReviewList {
      const items = [...data.reviews]
        .filter((review) => {
          switch (query.filter) {
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
      return {
        ...paginate(items, query.page, query.limit ?? AGENCY_LIST_LIMIT_DEFAULT),
        ...reviewStats(),
      };
    },
  };
}

export type AgencyQueries = ReturnType<typeof createAgencyQueries>;
