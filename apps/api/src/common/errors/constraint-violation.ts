import type { ErrorCode } from '@drivetn/types';
import { HttpStatus } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { AppException } from './app.exception';

/** SQLSTATE PostgreSQL : violation d'un CHECK et d'une contrainte d'exclusion. */
const CHECK_VIOLATION = '23514';
const EXCLUSION_VIOLATION = '23P01';

interface ConstraintRule {
  code: ErrorCode;
  message: string;
}

/**
 * Contraintes des migrations `20261008060000_integrity_constraints` et suivante. Le nom de la
 * contrainte (identifiant SQL) ne dépend pas de la langue des messages du serveur.
 */
export const CONSTRAINT_MESSAGES: Readonly<Record<string, ConstraintRule>> = {
  bookings_vehicle_no_overlap: {
    code: 'VEHICLE_UNAVAILABLE',
    message: 'Ce véhicule n’est plus disponible sur ces dates.',
  },
  bookings_return_after_pickup_check: {
    code: 'CONFLICT',
    message: 'La date de retour doit être postérieure à la date de départ.',
  },
  bookings_daily_rate_positive_check: {
    code: 'CONFLICT',
    message: 'Le tarif journalier de la réservation doit être supérieur à zéro.',
  },
  bookings_total_nonnegative_check: {
    code: 'CONFLICT',
    message: 'Le montant total de la réservation ne peut pas être négatif.',
  },
  bookings_deposit_nonnegative_check: {
    code: 'CONFLICT',
    message: 'La caution de la réservation ne peut pas être négative.',
  },
  reviews_rating_check: {
    code: 'CONFLICT',
    message: 'La note d’un avis doit être comprise entre 1 et 5.',
  },
  payments_amount_positive_check: {
    code: 'CONFLICT',
    message: 'Le montant d’un encaissement doit être supérieur à zéro.',
  },
  vehicles_daily_rate_positive_check: {
    code: 'CONFLICT',
    message: 'Le tarif journalier du véhicule doit être supérieur à zéro.',
  },
  vehicles_deposit_nonnegative_check: {
    code: 'CONFLICT',
    message: 'La caution du véhicule ne peut pas être négative.',
  },
  vehicles_mileage_nonnegative_check: {
    code: 'CONFLICT',
    message: 'Le kilométrage du véhicule ne peut pas être négatif.',
  },
  vehicles_mileage_limit_positive_check: {
    code: 'CONFLICT',
    message: 'La limite de kilométrage doit être supérieure à zéro, ou absente si illimitée.',
  },
  vehicles_seats_positive_check: {
    code: 'CONFLICT',
    message: 'Le nombre de places du véhicule doit être supérieur à zéro.',
  },
  invoices_amounts_nonnegative_check: {
    code: 'CONFLICT',
    message: 'Les montants d’une facture ne peuvent pas être négatifs.',
  },
  invoices_vat_rate_check: {
    code: 'CONFLICT',
    message: 'Le taux de TVA d’une facture doit être compris entre 0 et 100 %.',
  },
  invoices_due_after_issue_check: {
    code: 'CONFLICT',
    message: 'L’échéance d’une facture ne peut pas précéder sa date d’émission.',
  },
  invoices_total_check: {
    code: 'CONFLICT',
    message: 'Le total d’une facture doit égaler le sous-total, plus la TVA et le timbre fiscal.',
  },
  agencies_commission_check: {
    code: 'CONFLICT',
    message: 'La commission de l’agence doit être comprise entre 0 et 100 %.',
  },
  agencies_location_check: {
    code: 'CONFLICT',
    message: 'La position de l’agence doit se trouver en Tunisie.',
  },
  agencies_conditions_nonnegative_check: {
    code: 'CONFLICT',
    message:
      'Les conditions de location (âge minimum, ancienneté du permis, délai d’annulation) ne peuvent pas être négatives.',
  },
  vehicle_photos_dimensions_check: {
    code: 'CONFLICT',
    message: 'La position, les dimensions et la taille d’une photo doivent être valides.',
  },
  otp_codes_attempts_check: {
    code: 'CONFLICT',
    message: 'Le nombre de tentatives d’un code ne peut pas être négatif.',
  },
  vehicle_maintenances_end_after_start_check: {
    code: 'CONFLICT',
    message: 'La fin de l’entretien doit être postérieure à son début.',
  },
  vehicle_maintenances_no_overlap: {
    code: 'CONFLICT',
    message: 'Un entretien est déjà planifié sur ces dates pour ce véhicule.',
  },
};

const FALLBACK: Record<ConstraintViolation['sqlState'], ConstraintRule> = {
  [CHECK_VIOLATION]: {
    code: 'CONFLICT',
    message: 'Les données envoyées ne respectent pas les règles d’intégrité.',
  },
  [EXCLUSION_VIOLATION]: {
    code: 'CONFLICT',
    message: 'Cette opération entre en conflit avec des données existantes.',
  },
};

export interface ConstraintViolation {
  sqlState: typeof CHECK_VIOLATION | typeof EXCLUSION_VIOLATION;
  /** `null` si la contrainte n'est pas répertoriée. */
  constraint: string | null;
}

interface DatabaseError {
  sqlState: string;
  message: string;
}

const SQL_STATE = /\b(23514|23P01)\b/;
/** Client Prisma : `PostgresError { code: "23514", message: "... \"nom\"", ... }`. */
const POSTGRES_ERROR = /PostgresError \{ code: "([0-9A-Z]{5})", message: "((?:[^"\\]|\\.)*)"/;

/**
 * Code et message renvoyés par PostgreSQL. Le message complet de l'erreur Prisma n'est pas
 * utilisé : il cite le code source de l'appel, qui peut contenir n'importe quel texte.
 */
function databaseError(error: unknown): DatabaseError | null {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    const { code, message, database_error: databaseText } = error.meta ?? {};
    // P2010 (requête brute) : `meta.code` et `meta.message`.
    if (typeof code === 'string' && typeof message === 'string') {
      return { sqlState: code, message };
    }
    // P2004 : `meta.database_error`.
    if (typeof databaseText === 'string') {
      const sqlState = SQL_STATE.exec(databaseText)?.[1];
      return sqlState === undefined ? null : { sqlState, message: databaseText };
    }
    return null;
  }
  if (error instanceof Prisma.PrismaClientUnknownRequestError) {
    const match = POSTGRES_ERROR.exec(error.message);
    return match?.[1] === undefined || match[2] === undefined
      ? null
      : { sqlState: match[1], message: match[2] };
  }
  return null;
}

/** Violation d'un CHECK (23514) ou d'une exclusion (23P01), quelle que soit la forme Prisma. */
export function findConstraintViolation(error: unknown): ConstraintViolation | null {
  const database = databaseError(error);
  if (
    database === null ||
    (database.sqlState !== CHECK_VIOLATION && database.sqlState !== EXCLUSION_VIOLATION)
  ) {
    return null;
  }
  const constraint =
    Object.keys(CONSTRAINT_MESSAGES).find((name) =>
      new RegExp(`\\b${name}\\b`).test(database.message),
    ) ?? null;
  return { sqlState: database.sqlState, constraint };
}

/**
 * Erreur 409 en français. Le détail PostgreSQL (ligne en infraction, données personnelles
 * comprises) n'est jamais exposé : seul le nom de la contrainte figure dans `details`.
 */
export function constraintViolationException(violation: ConstraintViolation): AppException {
  const rule =
    (violation.constraint === null ? undefined : CONSTRAINT_MESSAGES[violation.constraint]) ??
    FALLBACK[violation.sqlState];
  return new AppException(
    HttpStatus.CONFLICT,
    rule.code,
    rule.message,
    violation.constraint === null ? undefined : { constraint: violation.constraint },
  );
}
