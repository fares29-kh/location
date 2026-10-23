import {
  type AdminAgency,
  AGENCY_DOCUMENT_KINDS,
  type AgencyRef,
  type Invoice,
  invoiceStatus,
  type ModeratedReview,
  normalizeTunisianPhone,
  type PersonRef,
  type PlatformBooking,
  type PlatformUser,
  REVIEW_REPORT_REASONS,
  summarizePayments,
} from '@drivetn/types';
import type { Prisma, User } from '@prisma/client';

import { toPlace } from '../agency/agency.mapper';

export const AGENCY_REF_SELECT = {
  id: true,
  name: true,
  governorate: { select: { nameFr: true } },
} satisfies Prisma.AgencySelect;

type AgencyRefRow = Prisma.AgencyGetPayload<{ select: typeof AGENCY_REF_SELECT }>;

export const ADMIN_AGENCY_INCLUDE = {
  owner: true,
  governorate: { select: { nameFr: true } },
  documents: { select: { kind: true, uploadedAt: true } },
  _count: { select: { vehicles: { where: { deletedAt: null } }, bookings: true } },
} satisfies Prisma.AgencyInclude;

type AdminAgencyRow = Prisma.AgencyGetPayload<{ include: typeof ADMIN_AGENCY_INCLUDE }>;

export const PLATFORM_BOOKING_INCLUDE = {
  agency: { select: AGENCY_REF_SELECT },
  customer: true,
  vehicle: { select: { brand: true, model: true, plateNumber: true, retiredPlateNumber: true } },
  payments: { select: { kind: true, amountMillimes: true } },
} satisfies Prisma.BookingInclude;

type PlatformBookingRow = Prisma.BookingGetPayload<{ include: typeof PLATFORM_BOOKING_INCLUDE }>;

export const INVOICE_INCLUDE = {
  agency: { select: AGENCY_REF_SELECT },
} satisfies Prisma.InvoiceInclude;

type InvoiceRow = Prisma.InvoiceGetPayload<{ include: typeof INVOICE_INCLUDE }>;

export const PLATFORM_USER_INCLUDE = {
  agency: { select: AGENCY_REF_SELECT },
  _count: { select: { bookings: true } },
} satisfies Prisma.UserInclude;

type PlatformUserRow = Prisma.UserGetPayload<{ include: typeof PLATFORM_USER_INCLUDE }>;

export const MODERATED_REVIEW_INCLUDE = {
  agency: { select: AGENCY_REF_SELECT },
  customer: { select: { firstName: true, lastName: true } },
  reports: { select: { reason: true } },
} satisfies Prisma.ReviewInclude;

type ModeratedReviewRow = Prisma.ReviewGetPayload<{ include: typeof MODERATED_REVIEW_INCLUDE }>;

/** Indicateurs calculés à part (agrégats), fusionnés dans la fiche agence. */
export interface AgencyStats {
  gmvMonthMillimes: number;
  rating: { average: number; count: number };
}

export const EMPTY_AGENCY_STATS: AgencyStats = {
  gmvMonthMillimes: 0,
  rating: { average: 0, count: 0 },
};

export function toAgencyRef(row: AgencyRefRow): AgencyRef {
  return { id: row.id, name: row.name, city: row.governorate.nameFr };
}

export function toPersonRef(user: User): PersonRef {
  return {
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    phone: normalizeTunisianPhone(user.phone),
    email: user.email,
  };
}

export function toAdminAgency(row: AdminAgencyRow, stats: AgencyStats): AdminAgency {
  const uploaded = new Map(row.documents.map((document) => [document.kind, document.uploadedAt]));
  return {
    id: row.id,
    name: row.name,
    city: row.governorate.nameFr,
    status: row.status,
    owner: toPersonRef(row.owner),
    phone: row.phone,
    email: row.email,
    address: row.address,
    taxId: row.taxId,
    plan: row.plan,
    commissionBps: row.commissionBps,
    vehiclesCount: row._count.vehicles,
    bookingsCount: row._count.bookings,
    gmvMonthMillimes: stats.gmvMonthMillimes,
    rating: stats.rating,
    documents: AGENCY_DOCUMENT_KINDS.map((kind) => ({
      kind,
      uploadedAt: uploaded.get(kind)?.toISOString() ?? null,
    })),
    createdAt: row.createdAt.toISOString(),
    decidedAt: row.decidedAt?.toISOString() ?? null,
    statusReason: row.statusReason,
  };
}

export function toPlatformUser(row: PlatformUserRow): PlatformUser {
  return {
    ...toPersonRef(row),
    role: row.role,
    adminRole: row.adminRole,
    status: row.status,
    agency: row.agency === null ? null : toAgencyRef(row.agency),
    bookingsCount: row._count.bookings,
    createdAt: row.createdAt.toISOString(),
    lastLoginAt: row.lastLoginAt?.toISOString() ?? null,
    statusReason: row.statusReason,
  };
}

export function toPlatformBooking(row: PlatformBookingRow): PlatformBooking {
  return {
    id: row.id,
    reference: row.reference,
    status: row.status,
    paymentStatus: summarizePayments(row.totalMillimes, row.payments).status,
    agency: toAgencyRef(row.agency),
    customer: toPersonRef(row.customer),
    vehicle: {
      brand: row.vehicle.brand,
      model: row.vehicle.model,
      plateNumber: row.vehicle.plateNumber ?? row.vehicle.retiredPlateNumber,
    },
    pickupAt: row.pickupAt.toISOString(),
    returnAt: row.returnAt.toISOString(),
    pickupLocation: toPlace(row.pickupPlace).fr,
    totalMillimes: row.totalMillimes,
    createdAt: row.createdAt.toISOString(),
  };
}

export function toInvoice(row: InvoiceRow, now: Date): Invoice {
  return {
    id: row.id,
    number: row.number,
    agency: toAgencyRef(row.agency),
    period: row.period,
    plan: row.plan,
    subscriptionMillimes: row.subscriptionMillimes,
    commissionMillimes: row.commissionMillimes,
    subtotalMillimes: row.subtotalMillimes,
    vatRateBps: row.vatRateBps,
    vatMillimes: row.vatMillimes,
    fiscalStampMillimes: row.fiscalStampMillimes,
    totalMillimes: row.totalMillimes,
    status: invoiceStatus(row, now),
    issuedAt: row.issuedAt.toISOString(),
    dueAt: row.dueAt.toISOString(),
    paidAt: row.paidAt?.toISOString() ?? null,
    paymentMethod: row.paymentMethod,
    remindedAt: row.remindedAt?.toISOString() ?? null,
  };
}

export function toModeratedReview(row: ModeratedReviewRow): ModeratedReview {
  return {
    id: row.id,
    agency: toAgencyRef(row.agency),
    author: row.customer,
    rating: row.rating,
    comment: row.comment,
    agencyReply: row.reply,
    status: row.moderationStatus,
    reports: REVIEW_REPORT_REASONS.map((reason) => ({
      reason,
      count: row.reports.filter((report) => report.reason === reason).length,
    })).filter((report) => report.count > 0),
    createdAt: row.createdAt.toISOString(),
    moderatedAt: row.moderatedAt?.toISOString() ?? null,
    moderationReason: row.moderationReason,
  };
}
