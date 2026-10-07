import {
  type AgencyProfile,
  type AgencySettings,
  applyBookingAction,
  type BookingList,
  type BookingQuery,
  type BookingTransitionInput,
  type BookingView,
  canApplyBookingAction,
  createAgencyQueries,
  type CustomerDetail,
  type CustomerQuery,
  type CustomerView,
  type DashboardData,
  type DayKey,
  type NavCounts,
  normalizeTunisianPhone,
  type Paginated,
  type PaymentList,
  type PaymentQuery,
  type PlanningData,
  type RecordPaymentInput,
  type RentalConditions,
  type Review,
  type ReviewFilter,
  type ReviewList,
  type VehicleInput,
  type VehicleStatus,
  type VehicleView,
} from '@drivetn/types';
import { HttpStatus, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { AuditService } from '../audit/audit.service';
import { AppException } from '../common/errors/app.exception';
import { PrismaService } from '../prisma/prisma.service';
import { AGENCY_DATASET_INCLUDE, toAgencyDataset, toSettings } from './agency.mapper';

const VEHICLE_COLORS = ['#2563EB', '#059669', '#DC2626', '#F59E0B', '#334155', '#7C3AED'];
const DEFAULT_GOVERNORATE = '11';

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

function plateAlreadyUsed(): AppException {
  return new AppException(HttpStatus.CONFLICT, 'CONFLICT', 'Immatriculation déjà utilisée.', [
    { path: 'plateNumber', message: 'PLATE_ALREADY_USED' },
  ]);
}

/**
 * Portail agence : chaque requête charge les données de l'agence du propriétaire connecté,
 * puis les vues sont calculées par `createAgencyQueries` (logique partagée avec la démo).
 */
@Injectable()
export class AgencyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /** Agence du propriétaire, créée à la première connexion à partir de son compte. */
  async agencyIdFor(ownerId: string): Promise<string> {
    const existing = await this.prisma.agency.findUnique({
      where: { ownerId },
      select: { id: true },
    });
    if (existing !== null) {
      return existing.id;
    }
    const owner = await this.prisma.user.findUniqueOrThrow({ where: { id: ownerId } });
    const phone = normalizeTunisianPhone(owner.phone);
    try {
      const agency = await this.prisma.agency.create({
        data: {
          ownerId,
          name: `${owner.firstName} ${owner.lastName}`,
          phone,
          whatsappPhone: phone,
          email: owner.email,
          address: '',
          governorateCode: DEFAULT_GOVERNORATE,
        },
        select: { id: true },
      });
      await this.audit.log({
        action: 'agency.created',
        actorId: ownerId,
        entityType: 'agency',
        entityId: agency.id,
      });
      return agency.id;
    } catch (error) {
      if (isUniqueViolation(error)) {
        return (await this.prisma.agency.findUniqueOrThrow({ where: { ownerId } })).id;
      }
      throw error;
    }
  }

  private async load(ownerId: string) {
    const agencyId = await this.agencyIdFor(ownerId);
    const agency = await this.prisma.agency.findUniqueOrThrow({
      where: { id: agencyId },
      include: AGENCY_DATASET_INCLUDE,
    });
    return { agencyId, queries: createAgencyQueries(toAgencyDataset(agency)) };
  }

  private async bookingView(ownerId: string, bookingId: string): Promise<BookingView> {
    const { queries } = await this.load(ownerId);
    const view = queries.getBooking(bookingId);
    if (view === undefined) {
      throw new NotFoundException('Réservation introuvable.');
    }
    return view;
  }

  private async vehicleView(ownerId: string, vehicleId: string): Promise<VehicleView> {
    const { queries } = await this.load(ownerId);
    const view = queries.getVehicle(vehicleId);
    if (view === undefined) {
      throw new NotFoundException('Véhicule introuvable.');
    }
    return view;
  }

  private async ownedBooking(ownerId: string, bookingId: string) {
    const agencyId = await this.agencyIdFor(ownerId);
    const booking = await this.prisma.booking.findFirst({ where: { id: bookingId, agencyId } });
    if (booking === null) {
      throw new NotFoundException('Réservation introuvable.');
    }
    return booking;
  }

  private async ownedVehicle(ownerId: string, vehicleId: string) {
    const agencyId = await this.agencyIdFor(ownerId);
    const vehicle = await this.prisma.vehicle.findFirst({ where: { id: vehicleId, agencyId } });
    if (vehicle === null) {
      throw new NotFoundException('Véhicule introuvable.');
    }
    return vehicle;
  }

  // --- Lectures -------------------------------------------------------------------

  async getDashboard(ownerId: string): Promise<DashboardData> {
    return (await this.load(ownerId)).queries.getDashboard();
  }

  async getNavCounts(ownerId: string): Promise<NavCounts> {
    return (await this.load(ownerId)).queries.getNavCounts();
  }

  async listBookings(ownerId: string, query: BookingQuery): Promise<BookingList> {
    return (await this.load(ownerId)).queries.listBookings(query);
  }

  getBooking(ownerId: string, bookingId: string): Promise<BookingView> {
    return this.bookingView(ownerId, bookingId);
  }

  async getPlanning(ownerId: string, from: DayKey, days: number): Promise<PlanningData> {
    return (await this.load(ownerId)).queries.getPlanning(from, days);
  }

  async listVehicles(ownerId: string): Promise<VehicleView[]> {
    return (await this.load(ownerId)).queries.listVehicles();
  }

  async listCustomers(ownerId: string, query: CustomerQuery): Promise<Paginated<CustomerView>> {
    return (await this.load(ownerId)).queries.listCustomers(query);
  }

  async getCustomer(ownerId: string, customerId: string): Promise<CustomerDetail> {
    const customer = (await this.load(ownerId)).queries.getCustomer(customerId);
    if (customer === undefined) {
      throw new NotFoundException('Client introuvable.');
    }
    return customer;
  }

  async listPayments(ownerId: string, query: PaymentQuery): Promise<PaymentList> {
    return (await this.load(ownerId)).queries.listPayments(query);
  }

  async listReviews(ownerId: string, filter: ReviewFilter): Promise<ReviewList> {
    return (await this.load(ownerId)).queries.listReviews(filter);
  }

  async getSettings(ownerId: string): Promise<AgencySettings> {
    const agencyId = await this.agencyIdFor(ownerId);
    return toSettings(await this.prisma.agency.findUniqueOrThrow({ where: { id: agencyId } }));
  }

  // --- Réservations et encaissements ----------------------------------------------

  async transitionBooking(
    ownerId: string,
    bookingId: string,
    input: BookingTransitionInput,
    ip: string | null,
  ): Promise<BookingView> {
    const booking = await this.ownedBooking(ownerId, bookingId);
    if (!canApplyBookingAction(booking.status, input.action)) {
      throw new AppException(
        HttpStatus.CONFLICT,
        'CONFLICT',
        'Cette action n’est plus possible pour cette réservation.',
      );
    }
    const status = applyBookingAction(booking.status, input.action);
    const updated = await this.prisma.booking.updateMany({
      where: { id: booking.id, status: booking.status },
      data: { status },
    });
    if (updated.count === 0) {
      throw new AppException(
        HttpStatus.CONFLICT,
        'CONFLICT',
        'La réservation a été modifiée entre-temps.',
      );
    }
    await this.prisma.bookingEvent.create({
      data: { bookingId: booking.id, status, reason: input.reason ?? null, actorId: ownerId },
    });
    await this.audit.log({
      action: 'booking.status_changed',
      actorId: ownerId,
      entityType: 'booking',
      entityId: booking.id,
      metadata: { from: booking.status, to: status, action: input.action },
      ip,
    });
    return this.bookingView(ownerId, booking.id);
  }

  async recordPayment(
    ownerId: string,
    bookingId: string,
    input: RecordPaymentInput,
    ip: string | null,
  ): Promise<BookingView> {
    const booking = await this.ownedBooking(ownerId, bookingId);
    const payment = await this.prisma.payment.create({
      data: {
        bookingId: booking.id,
        kind: input.kind,
        method: input.method,
        amountMillimes: input.amountMillimes,
        note: input.note === undefined || input.note.length === 0 ? null : input.note,
        recordedById: ownerId,
      },
    });
    await this.audit.log({
      action: 'payment.recorded',
      actorId: ownerId,
      entityType: 'payment',
      entityId: payment.id,
      metadata: { bookingId: booking.id, kind: input.kind, amountMillimes: input.amountMillimes },
      ip,
    });
    return this.bookingView(ownerId, booking.id);
  }

  // --- Flotte ---------------------------------------------------------------------

  async createVehicle(ownerId: string, input: VehicleInput): Promise<VehicleView> {
    const agencyId = await this.agencyIdFor(ownerId);
    const count = await this.prisma.vehicle.count({ where: { agencyId } });
    try {
      const vehicle = await this.prisma.vehicle.create({
        data: {
          ...input,
          agencyId,
          color: VEHICLE_COLORS[count % VEHICLE_COLORS.length] ?? '#2563EB',
        },
      });
      return await this.vehicleView(ownerId, vehicle.id);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw plateAlreadyUsed();
      }
      throw error;
    }
  }

  async updateVehicle(
    ownerId: string,
    vehicleId: string,
    input: VehicleInput,
  ): Promise<VehicleView> {
    const vehicle = await this.ownedVehicle(ownerId, vehicleId);
    try {
      await this.prisma.vehicle.update({ where: { id: vehicle.id }, data: input });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw plateAlreadyUsed();
      }
      throw error;
    }
    return this.vehicleView(ownerId, vehicle.id);
  }

  async setVehicleStatus(
    ownerId: string,
    vehicleId: string,
    status: VehicleStatus,
  ): Promise<VehicleView> {
    const vehicle = await this.ownedVehicle(ownerId, vehicleId);
    if (status !== 'ACTIVE') {
      const onRent = await this.prisma.booking.count({
        where: { vehicleId: vehicle.id, status: 'PICKED_UP' },
      });
      if (onRent > 0) {
        throw new AppException(HttpStatus.CONFLICT, 'CONFLICT', 'Le véhicule est en location.');
      }
    }
    await this.prisma.vehicle.update({ where: { id: vehicle.id }, data: { status } });
    return this.vehicleView(ownerId, vehicle.id);
  }

  // --- Avis et paramètres ---------------------------------------------------------

  async replyToReview(ownerId: string, reviewId: string, reply: string): Promise<Review> {
    const agencyId = await this.agencyIdFor(ownerId);
    const review = await this.prisma.review.findFirst({ where: { id: reviewId, agencyId } });
    if (review === null) {
      throw new NotFoundException('Avis introuvable.');
    }
    await this.prisma.review.update({
      where: { id: review.id },
      data: { reply, repliedAt: new Date() },
    });
    const updated = (await this.load(ownerId)).queries
      .listReviews('all')
      .items.find((item) => item.id === review.id);
    if (updated === undefined) {
      throw new NotFoundException('Avis introuvable.');
    }
    return updated;
  }

  async updateProfile(ownerId: string, profile: AgencyProfile): Promise<AgencySettings> {
    const agencyId = await this.agencyIdFor(ownerId);
    const agency = await this.prisma.agency.update({
      where: { id: agencyId },
      data: { ...profile, email: profile.email ?? null },
    });
    return toSettings(agency);
  }

  async updateConditions(ownerId: string, conditions: RentalConditions): Promise<AgencySettings> {
    const agencyId = await this.agencyIdFor(ownerId);
    const agency = await this.prisma.agency.update({ where: { id: agencyId }, data: conditions });
    return toSettings(agency);
  }
}
