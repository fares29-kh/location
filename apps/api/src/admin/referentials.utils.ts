import type { LocalizedText } from '@drivetn/types';
import { HttpStatus } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { AppException } from '../common/errors/app.exception';

export function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

/** Valeur déjà prise par un autre élément du référentiel, signalée sur le champ concerné. */
export function alreadyUsed(path: string): AppException {
  return new AppException(HttpStatus.CONFLICT, 'CONFLICT', 'Cette valeur est déjà utilisée.', [
    { path, message: 'ALREADY_USED' },
  ]);
}

/** Suppression refusée : l'élément est encore utilisé (`details.reason` = « IN_USE »). */
export function inUse(message: string): AppException {
  return new AppException(HttpStatus.CONFLICT, 'CONFLICT', message, { reason: 'IN_USE' });
}

export function localizedName(row: {
  nameFr: string;
  nameAr: string;
  nameEn: string;
}): LocalizedText {
  return { fr: row.nameFr, ar: row.nameAr, en: row.nameEn };
}

export function nameColumns(name: LocalizedText) {
  return { nameFr: name.fr, nameAr: name.ar, nameEn: name.en };
}

/** Détail du journal d'audit : « Catégorie « SUV » », ou « … « A » → « B » » si renommé. */
export function auditLabel(kind: string, name: string, previous?: string): string {
  return previous === undefined || previous === name
    ? `${kind} « ${name} »`
    : `${kind} « ${previous} » → « ${name} »`;
}
