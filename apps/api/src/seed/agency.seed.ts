import { type AgencyDataset, createAgencyDataset, getDemoAccounts, toE164 } from '@drivetn/types';
import type { PrismaClient } from '@prisma/client';

import { categoryIdsBySlug } from './categories';

export interface DemoAgencySeedResult {
  created: boolean;
  vehicles: number;
  bookings: number;
}

function demoEmail(portal: 'agency' | 'client'): string {
  const [account] = getDemoAccounts(portal);
  if (account === undefined) {
    throw new Error(`Aucun compte de démo pour le portail ${portal}`);
  }
  return account.email;
}

/**
 * Agence de démo du compte agence : flotte, clients, réservations, encaissements et avis
 * générés par `createAgencyDataset`. Le premier client du jeu est le client de démo, pour
 * que ses réservations apparaissent dans l'espace client. Idempotent : ne fait rien si
 * l'agence existe déjà.
 */
export async function seedDemoAgency(
  prisma: PrismaClient,
  dataset: AgencyDataset = createAgencyDataset(),
): Promise<DemoAgencySeedResult> {
  const owner = await prisma.user.findUnique({ where: { email: demoEmail('agency') } });
  const demoCustomer = await prisma.user.findUnique({ where: { email: demoEmail('client') } });
  if (owner === null || demoCustomer === null) {
    return { created: false, vehicles: 0, bookings: 0 };
  }
  if ((await prisma.agency.findUnique({ where: { ownerId: owner.id } })) !== null) {
    return { created: false, vehicles: 0, bookings: 0 };
  }

  const { profile, conditions } = dataset.settings;
  const agency = await prisma.agency.create({
    data: {
      ownerId: owner.id,
      status: 'ACTIVE',
      ...profile,
      email: profile.email ?? null,
      ...conditions,
    },
  });

  const customerIds = new Map<string, string>();
  for (const [index, customer] of dataset.customers.entries()) {
    if (index === 0) {
      customerIds.set(customer.id, demoCustomer.id);
      continue;
    }
    const phone = toE164(customer.phone);
    const existing = await prisma.user.findUnique({ where: { phone } });
    if (existing !== null) {
      customerIds.set(customer.id, existing.id);
      continue;
    }
    const emailTaken =
      customer.email !== null &&
      (await prisma.user.findUnique({ where: { email: customer.email } })) !== null;
    const user = await prisma.user.create({
      data: {
        role: 'CUSTOMER',
        status: 'ACTIVE',
        firstName: customer.firstName,
        lastName: customer.lastName,
        phone,
        phoneVerifiedAt: new Date(customer.createdAt),
        email: emailTaken ? null : customer.email,
        city: customer.city,
        createdAt: new Date(customer.createdAt),
      },
    });
    customerIds.set(customer.id, user.id);
  }

  const categoryId = await categoryIdsBySlug(prisma);
  const vehicleIds = new Map<string, string>();
  for (const vehicle of dataset.vehicles) {
    const { id, createdAt, photos: _photos, category, ...data } = vehicle;
    const row = await prisma.vehicle.create({
      data: {
        ...data,
        categoryId: categoryId(category),
        agencyId: agency.id,
        createdAt: new Date(createdAt),
      },
    });
    vehicleIds.set(id, row.id);
  }

  const reviewsByBooking = new Map(dataset.reviews.map((review) => [review.bookingId, review]));
  for (const booking of dataset.bookings) {
    const customerId = customerIds.get(booking.customerId);
    const vehicleId = vehicleIds.get(booking.vehicleId);
    if (customerId === undefined || vehicleId === undefined) {
      continue;
    }
    const review = reviewsByBooking.get(booking.id);
    await prisma.booking.create({
      data: {
        reference: booking.reference,
        agencyId: agency.id,
        vehicleId,
        customerId,
        pickupAt: new Date(booking.pickupAt),
        returnAt: new Date(booking.returnAt),
        pickupPlace: booking.pickupLocation,
        returnPlace: booking.returnLocation,
        status: booking.status,
        dailyRateMillimes: booking.dailyRateMillimes,
        totalMillimes: booking.totalMillimes,
        depositMillimes: booking.depositMillimes,
        customerNote: booking.customerNote,
        createdAt: new Date(booking.createdAt),
        events: {
          create: booking.history.map((event) => ({
            status: event.status,
            reason: event.reason,
            createdAt: new Date(event.at),
          })),
        },
        payments: {
          create: dataset.payments
            .filter((payment) => payment.bookingId === booking.id)
            .map((payment) => ({
              kind: payment.kind,
              method: payment.method,
              amountMillimes: payment.amountMillimes,
              note: payment.note,
              recordedById: owner.id,
              recordedAt: new Date(payment.recordedAt),
            })),
        },
        ...(review === undefined
          ? {}
          : {
              review: {
                create: {
                  agencyId: agency.id,
                  customerId,
                  rating: review.rating,
                  comment: review.comment,
                  reply: review.reply,
                  repliedAt: review.repliedAt === null ? null : new Date(review.repliedAt),
                  createdAt: new Date(review.createdAt),
                },
              },
            }),
      },
    });
  }

  return { created: true, vehicles: vehicleIds.size, bookings: dataset.bookings.length };
}
