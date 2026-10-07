import type { AgencyDataset } from './agency-engine';
import type {
  Booking,
  BookingEvent,
  Customer,
  PaymentRecord,
  Review,
  Vehicle,
} from './agency-portal';
import { type BookingStatus, type PaymentKind, type PaymentMethod, rentalDays } from './booking';
import { rentalPriceMillimes } from './catalog';
import { addDays, type DayKey, todayKey, tunisDateTime } from './dates';
import type { LocalizedText } from './location';
import { createRandom, type Random } from './random';
import type { VehicleCategory } from './vehicle';

const VEHICLE_SPECS: readonly Omit<
  Vehicle,
  'id' | 'createdAt' | 'plateNumber' | 'status' | 'mileageKm'
>[] = [
  vehicle('Kia', 'Picanto', 2023, 'ECONOMY', 'MANUAL', 'PETROL', 4, 70, 300, '#E11D48'),
  vehicle('Hyundai', 'Grand i10', 2024, 'ECONOMY', 'MANUAL', 'PETROL', 5, 75, 300, '#F8FAFC'),
  vehicle('Renault', 'Clio 5', 2023, 'COMPACT', 'MANUAL', 'DIESEL', 5, 95, 500, '#2563EB'),
  vehicle('Peugeot', '208', 2024, 'COMPACT', 'AUTOMATIC', 'PETROL', 5, 110, 500, '#F59E0B'),
  vehicle('Volkswagen', 'Polo', 2022, 'COMPACT', 'MANUAL', 'PETROL', 5, 95, 500, '#64748B'),
  vehicle('Seat', 'Ibiza', 2023, 'COMPACT', 'MANUAL', 'PETROL', 5, 90, 500, '#DC2626'),
  vehicle('Dacia', 'Logan', 2024, 'SEDAN', 'MANUAL', 'DIESEL', 5, 85, 400, '#E2E8F0'),
  vehicle('Hyundai', 'Accent', 2023, 'SEDAN', 'AUTOMATIC', 'PETROL', 5, 120, 600, '#0F172A'),
  vehicle('Peugeot', '301', 2022, 'SEDAN', 'MANUAL', 'DIESEL', 5, 100, 500, '#94A3B8'),
  vehicle('Dacia', 'Duster', 2024, 'SUV', 'MANUAL', 'DIESEL', 5, 150, 800, '#B45309'),
  vehicle('Hyundai', 'Tucson', 2023, 'SUV', 'AUTOMATIC', 'HYBRID', 5, 210, 1000, '#1E3A8A'),
  vehicle('Peugeot', '3008', 2024, 'SUV', 'AUTOMATIC', 'DIESEL', 5, 230, 1200, '#334155'),
  vehicle('Dacia', 'Jogger', 2023, 'MINIVAN', 'MANUAL', 'PETROL', 7, 160, 800, '#059669'),
  vehicle(
    'Mercedes-Benz',
    'Classe C',
    2023,
    'LUXURY',
    'AUTOMATIC',
    'DIESEL',
    5,
    340,
    2000,
    '#111827',
  ),
];

function vehicle(
  brand: string,
  model: string,
  year: number,
  category: VehicleCategory,
  transmission: Vehicle['transmission'],
  fuel: Vehicle['fuel'],
  seats: number,
  dailyRateDinars: number,
  depositDinars: number,
  color: string,
) {
  return {
    brand,
    model,
    year,
    category,
    transmission,
    fuel,
    seats,
    color,
    airConditioning: true,
    dailyRateMillimes: dailyRateDinars * 1000,
    depositMillimes: depositDinars * 1000,
    mileageLimitKm: category === 'LUXURY' ? 250 : null,
  };
}

const FIRST_NAMES = [
  'Amira',
  'Mohamed',
  'Yassine',
  'Sarra',
  'Ahmed',
  'Nour',
  'Skander',
  'Ines',
  'Walid',
  'Rania',
  'Karim',
  'Mariem',
  'Hichem',
  'Salma',
  'Oussama',
  'Fatma',
  'Bilel',
  'Emna',
  'Aymen',
  'Khadija',
  'Youssef',
  'Leila',
  'Mehdi',
  'Hela',
  'Anis',
  'Asma',
  'Firas',
  'Olfa',
  'Hamza',
  'Chaima',
];

const LAST_NAMES = [
  'Ben Salah',
  'Trabelsi',
  'Jaziri',
  'Gharbi',
  'Hammami',
  'Mejri',
  'Chaabane',
  'Ayari',
  'Dridi',
  'Khelifi',
  'Sassi',
  'Ferchichi',
  'Mansouri',
  'Ben Ammar',
  'Zouari',
  'Baccouche',
  'Masmoudi',
  'Kammoun',
];

const VISITORS = [
  ['Sophie', 'Martin', 'Lyon'],
  ['Lukas', 'Weber', 'Munich'],
  ['Karim', 'Benali', 'Paris'],
  ['Emma', 'Rossi', 'Milan'],
  ['Nadia', 'Bouzid', 'Montréal'],
] as const;

const CITIES = ['Tunis', 'Ariana', 'La Marsa', 'Sousse', 'Sfax', 'Nabeul', 'Monastir', 'Bizerte'];

const PLACES: readonly LocalizedText[] = [
  { fr: 'Aéroport Tunis-Carthage', ar: 'مطار تونس قرطاج', en: 'Tunis-Carthage Airport' },
  {
    fr: 'Agence – Les Berges du Lac',
    ar: 'الوكالة – ضفاف البحيرة',
    en: 'Agency – Les Berges du Lac',
  },
  { fr: 'Aéroport Enfidha-Hammamet', ar: 'مطار النفيضة الحمامات', en: 'Enfidha-Hammamet Airport' },
  {
    fr: 'Livraison – Centre-ville de Tunis',
    ar: 'توصيل – وسط مدينة تونس',
    en: 'Delivery – Tunis city centre',
  },
];

const PICKUP_HOURS = [8, 9, 10, 11, 14, 15, 16, 18] as const;

const RENTAL_METHODS: readonly (readonly [PaymentMethod, number])[] = [
  ['CASH', 45],
  ['CARD_TPE', 25],
  ['BANK_TRANSFER', 12],
  ['CHECK', 8],
  ['MOBILE_PAYMENT', 7],
  ['MONEY_ORDER', 3],
];

const DEPOSIT_METHODS: readonly (readonly [PaymentMethod, number])[] = [
  ['CARD_TPE', 50],
  ['CHECK', 30],
  ['CASH', 20],
];

const REVIEW_COMMENTS: Record<number, readonly string[]> = {
  5: [
    'Voiture impeccable et accueil très chaleureux à l’aéroport. Je recommande !',
    'Service rapide, véhicule propre et récent. Rien à redire.',
    'Great experience: the car was waiting for us at arrivals, very professional team.',
    'خدمة ممتازة وسيارة نظيفة، شكراً على حسن الاستقبال.',
    'Agence sérieuse, réponse WhatsApp en quelques minutes. Parfait pour nos vacances.',
  ],
  4: [
    'Très bonne location, juste un peu d’attente au moment de la remise des clés.',
    'Good car and fair price. The deposit was returned the same day.',
    'Voiture conforme, personnel aimable. Je reviendrai.',
    'سيارة جيدة والسعر مناسب، أنصح بها.',
  ],
  3: [
    'Correct dans l’ensemble, mais le véhicule n’était pas tout à fait propre.',
    'Average experience, the pickup took longer than expected.',
  ],
  2: ['Retard d’une heure à la livraison et peu d’explications.'],
  1: ['Caution restituée avec beaucoup de retard, communication difficile.'],
};

const REVIEW_REPLIES = [
  'Merci beaucoup pour votre confiance, au plaisir de vous revoir !',
  'Thank you for your feedback, we hope to see you again soon.',
  'Merci pour votre retour, nous avons pris note de vos remarques pour améliorer notre service.',
];

const REFERENCE_ALPHABET = Array.from('ABCDEFGHJKLMNPQRSTUVWXYZ23456789');

function reference(random: Random): string {
  return `DTN-${Array.from({ length: 6 }, () => random.pick(REFERENCE_ALPHABET)).join('')}`;
}

function plate(random: Random): string {
  return `${String(random.int(180, 260))} TU ${String(random.int(1000, 9999))}`;
}

function phone(random: Random): string {
  return `${random.pick(['2', '5', '9'])}${String(random.int(1_000_000, 9_999_999))}`;
}

function slug(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z]+/g, '.');
}

function hoursBefore(date: Date, hours: number): Date {
  return new Date(date.getTime() - hours * 3_600_000);
}

interface Slot {
  start: DayKey;
  days: number;
}

/** Situation de chaque véhicule autour d'aujourd'hui, pour une démo réaliste du tableau de bord. */
const ANCHORS = ['departure', 'return', 'ongoing', 'soon', 'returned'] as const;

export function createAgencyDataset(now: Date = new Date()): AgencyDataset {
  const random = createRandom(20_261_007);
  const today = todayKey(now);
  const historyStart = addDays(today, -150);
  const horizon = addDays(today, 40);

  const vehicles: Vehicle[] = VEHICLE_SPECS.map((spec, index) => ({
    ...spec,
    id: `veh_${String(index + 1).padStart(2, '0')}`,
    plateNumber: plate(random),
    status: index === 9 ? 'MAINTENANCE' : index === 6 ? 'INACTIVE' : 'ACTIVE',
    mileageKm: random.int(8_000, 95_000),
    createdAt: tunisDateTime(addDays(historyStart, -random.int(10, 200)), 10).toISOString(),
  }));

  const customers: Customer[] = [
    ...Array.from({ length: 34 }, (_, index) => {
      const firstName = FIRST_NAMES[index % FIRST_NAMES.length] ?? 'Amira';
      const lastName = random.pick(LAST_NAMES);
      return {
        firstName,
        lastName,
        city: random.pick(CITIES),
        email: random.chance(0.7) ? `${slug(firstName)}.${slug(lastName)}@gmail.com` : null,
      };
    }),
    ...VISITORS.map(([firstName, lastName, city]) => ({
      firstName,
      lastName,
      city,
      email: `${slug(firstName)}.${slug(lastName)}@mail.com`,
    })),
  ].map((person, index) => ({
    ...person,
    id: `cus_${String(index + 1).padStart(3, '0')}`,
    phone: phone(random),
    createdAt: tunisDateTime(addDays(historyStart, random.int(-120, 120)), 12).toISOString(),
  }));

  const bookings: Booking[] = [];
  const payments: PaymentRecord[] = [];
  const reviews: Review[] = [];

  function addPayment(
    booking: Booking,
    kind: PaymentKind,
    amountMillimes: number,
    at: Date,
    method: PaymentMethod = random.weighted(
      kind.startsWith('DEPOSIT') ? DEPOSIT_METHODS : RENTAL_METHODS,
    ),
  ) {
    if (amountMillimes <= 0 || at.getTime() > now.getTime()) {
      return;
    }
    payments.push({
      id: `pay_${String(payments.length + 1).padStart(4, '0')}`,
      bookingId: booking.id,
      kind,
      method,
      amountMillimes,
      recordedAt: at.toISOString(),
      note: null,
    });
  }

  function statusFor(pickupAt: Date, returnAt: Date): BookingStatus {
    if (returnAt.getTime() <= now.getTime()) {
      if (now.getTime() - returnAt.getTime() < 20 * 3_600_000) {
        return 'RETURNED';
      }
      return random.weighted<BookingStatus>([
        ['COMPLETED', 84],
        ['CANCELLED', 5],
        ['REJECTED', 4],
        ['NO_SHOW', 3],
        ['EXPIRED', 4],
      ]);
    }
    if (pickupAt.getTime() <= now.getTime()) {
      return 'PICKED_UP';
    }
    const daysAhead = (pickupAt.getTime() - now.getTime()) / 86_400_000;
    return random.chance(daysAhead < 3 ? 0.15 : 0.1) ? 'PENDING' : 'CONFIRMED';
  }

  function createBooking(target: Vehicle, slot: Slot, forced?: BookingStatus) {
    const pickupAt = tunisDateTime(slot.start, random.pick(PICKUP_HOURS));
    const returnAt = tunisDateTime(addDays(slot.start, slot.days), random.pick(PICKUP_HOURS));
    const status = forced ?? statusFor(pickupAt, returnAt);
    const customer = random.pick(customers);
    const days = rentalDays(pickupAt, returnAt);
    const createdAt =
      status === 'PENDING'
        ? hoursBefore(now, random.int(1, 30))
        : hoursBefore(pickupAt, random.int(24, 24 * 20));
    const place = random.pick(PLACES);

    const history: BookingEvent[] = [
      { status: 'PENDING', at: createdAt.toISOString(), reason: null },
    ];
    const push = (eventStatus: BookingStatus, at: Date, reason: string | null = null) => {
      history.push({ status: eventStatus, at: at.toISOString(), reason });
    };
    const confirmedAt = new Date(createdAt.getTime() + random.int(5, 120) * 60_000);
    if (
      ['CONFIRMED', 'PICKED_UP', 'RETURNED', 'COMPLETED', 'CANCELLED', 'NO_SHOW'].includes(status)
    ) {
      push('CONFIRMED', confirmedAt);
    }
    if (['PICKED_UP', 'RETURNED', 'COMPLETED'].includes(status)) {
      push('PICKED_UP', pickupAt);
    }
    if (['RETURNED', 'COMPLETED'].includes(status)) {
      push('RETURNED', returnAt);
    }
    if (status === 'COMPLETED') {
      push('COMPLETED', new Date(returnAt.getTime() + random.int(1, 6) * 3_600_000));
    }
    if (status === 'REJECTED') {
      push('REJECTED', confirmedAt, 'Véhicule indisponible sur ces dates.');
    }
    if (status === 'CANCELLED') {
      push(
        'CANCELLED',
        hoursBefore(pickupAt, random.int(12, 96)),
        'Annulation à la demande du client.',
      );
    }
    if (status === 'NO_SHOW') {
      push('NO_SHOW', new Date(pickupAt.getTime() + 3 * 3_600_000));
    }
    if (status === 'EXPIRED') {
      push('EXPIRED', new Date(createdAt.getTime() + 24 * 3_600_000));
    }

    const booking: Booking = {
      id: `bkg_${String(bookings.length + 1).padStart(4, '0')}`,
      reference: reference(random),
      vehicleId: target.id,
      customerId: customer.id,
      pickupAt: pickupAt.toISOString(),
      returnAt: returnAt.toISOString(),
      pickupLocation: place,
      returnLocation: random.chance(0.85) ? place : random.pick(PLACES),
      status,
      dailyRateMillimes: target.dailyRateMillimes,
      totalMillimes: rentalPriceMillimes(target.dailyRateMillimes, days),
      depositMillimes: target.depositMillimes,
      customerNote: random.chance(0.25)
        ? random.pick([
            'Arrivée par le vol TU 745, merci de m’attendre au terminal.',
            'Besoin d’un siège bébé si possible.',
            'Could you please deliver the car to my hotel?',
            'نحتاج السيارة باكراً إن أمكن.',
          ])
        : null,
      createdAt: createdAt.toISOString(),
      history,
    };
    bookings.push(booking);

    const advance = Math.round((booking.totalMillimes * 0.3) / 1000) * 1000;
    switch (status) {
      case 'COMPLETED':
      case 'RETURNED': {
        if (random.chance(0.4)) {
          addPayment(booking, 'RENTAL', advance, confirmedAt);
          addPayment(booking, 'RENTAL', booking.totalMillimes - advance, pickupAt);
        } else {
          addPayment(booking, 'RENTAL', booking.totalMillimes, pickupAt);
        }
        addPayment(booking, 'DEPOSIT_HELD', booking.depositMillimes, pickupAt);
        if (status === 'COMPLETED') {
          addPayment(booking, 'DEPOSIT_RETURNED', booking.depositMillimes, returnAt);
        }
        break;
      }
      case 'PICKED_UP': {
        addPayment(
          booking,
          'RENTAL',
          random.chance(0.7) ? booking.totalMillimes : advance,
          pickupAt,
        );
        addPayment(booking, 'DEPOSIT_HELD', booking.depositMillimes, pickupAt);
        break;
      }
      case 'CONFIRMED': {
        if (random.chance(0.4)) {
          addPayment(booking, 'RENTAL', advance, confirmedAt);
        }
        break;
      }
      case 'CANCELLED': {
        if (random.chance(0.5)) {
          addPayment(booking, 'RENTAL', advance, confirmedAt);
          addPayment(booking, 'REFUND', advance, hoursBefore(pickupAt, 6));
        }
        break;
      }
      default:
        break;
    }

    if (status === 'COMPLETED' && random.chance(0.55)) {
      const rating = random.weighted<number>([
        [5, 55],
        [4, 28],
        [3, 10],
        [2, 5],
        [1, 2],
      ]);
      const createdReviewAt = new Date(returnAt.getTime() + random.int(4, 72) * 3_600_000);
      const replied = random.chance(0.55);
      if (createdReviewAt.getTime() < now.getTime()) {
        reviews.push({
          id: `rev_${String(reviews.length + 1).padStart(3, '0')}`,
          bookingId: booking.id,
          customerName: `${customer.firstName} ${customer.lastName.charAt(0)}.`,
          vehicleName: `${target.brand} ${target.model}`,
          rating,
          comment: random.pick(REVIEW_COMMENTS[rating] ?? REVIEW_COMMENTS[5] ?? ['']),
          createdAt: createdReviewAt.toISOString(),
          reply: replied ? random.pick(REVIEW_REPLIES) : null,
          repliedAt: replied
            ? new Date(createdReviewAt.getTime() + random.int(2, 30) * 3_600_000).toISOString()
            : null,
        });
      }
    }
  }

  /** Remplit [from, to[ de locations successives séparées par des jours libres. */
  function fill(target: Vehicle, from: DayKey, to: DayKey) {
    let cursor = addDays(from, random.int(0, 3));
    for (;;) {
      const days = random.weighted<number>([
        [1, 6],
        [2, 14],
        [3, 20],
        [4, 18],
        [5, 14],
        [7, 12],
        [10, 6],
      ]);
      if (addDays(cursor, days + 1) > to) {
        return;
      }
      createBooking(target, { start: cursor, days });
      cursor = addDays(
        cursor,
        days +
          random.weighted<number>([
            [0, 3],
            [1, 4],
            [2, 3],
            [4, 2],
            [7, 1],
          ]) +
          1,
      );
    }
  }

  vehicles.forEach((target, index) => {
    if (target.status === 'INACTIVE') {
      fill(target, historyStart, addDays(today, -60));
      return;
    }
    if (target.status === 'MAINTENANCE') {
      fill(target, historyStart, addDays(today, -6));
      return;
    }
    const anchor = ANCHORS[index % ANCHORS.length] ?? 'soon';
    let anchorSlot: Slot;
    let forced: BookingStatus | undefined;
    switch (anchor) {
      case 'departure':
        anchorSlot = { start: today, days: random.int(3, 6) };
        forced = 'CONFIRMED';
        break;
      case 'return': {
        const days = random.int(3, 6);
        anchorSlot = { start: addDays(today, -days), days };
        forced = 'PICKED_UP';
        break;
      }
      case 'ongoing':
        anchorSlot = { start: addDays(today, -2), days: random.int(4, 7) };
        forced = 'PICKED_UP';
        break;
      case 'soon':
        anchorSlot = { start: addDays(today, random.int(1, 3)), days: random.int(2, 5) };
        break;
      case 'returned':
        anchorSlot = { start: addDays(today, -4), days: 3 };
        forced = 'RETURNED';
        break;
    }

    fill(target, historyStart, addDays(anchorSlot.start, -1));
    createBooking(target, anchorSlot, forced);
    fill(target, addDays(anchorSlot.start, anchorSlot.days + 1), horizon);
  });

  // Les départs et retours du jour doivent tomber à des heures encore à venir.
  for (const booking of bookings) {
    if (booking.status === 'CONFIRMED' && booking.pickupAt.startsWith(today)) {
      booking.pickupAt = tunisDateTime(today, 17).toISOString();
    }
    if (booking.status === 'PICKED_UP' && booking.returnAt.startsWith(today)) {
      booking.returnAt = tunisDateTime(today, 19).toISOString();
    }
  }

  return {
    vehicles,
    customers,
    bookings,
    payments,
    reviews,
    settings: {
      profile: {
        name: 'Carthage Auto Location',
        phone: '71234567',
        whatsappPhone: '98123456',
        email: 'contact@carthage-auto.tn',
        address: 'Rue du Lac Biwa, Les Berges du Lac, 1053 Tunis',
        governorateCode: '11',
        description:
          'Agence familiale depuis 2009 : livraison à l’aéroport Tunis-Carthage 7j/7, véhicules récents et entretenus, assistance WhatsApp.',
      },
      conditions: {
        minDriverAge: 21,
        minLicenseYears: 2,
        freeCancellationHours: 48,
        instantConfirmation: false,
        acceptedPaymentMethods: ['CASH', 'CARD_TPE', 'BANK_TRANSFER'],
      },
    },
  };
}
