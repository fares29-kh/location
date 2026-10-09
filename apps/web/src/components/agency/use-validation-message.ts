'use client';

import { useTranslations } from 'next-intl';
import { useCallback } from 'react';
import type { FieldValues, Path, UseFormSetError } from 'react-hook-form';

import { ApiError } from '@/lib/api/errors';

const AGENCY_VALIDATION_CODES = [
  'REQUIRED',
  'TOO_LONG',
  'INVALID_TUNISIAN_PHONE',
  'INVALID_EMAIL',
  'INVALID_PLATE',
  'PLATE_ALREADY_USED',
  'INVALID_BRAND',
  'INVALID_MODEL',
  'INVALID_CATEGORY',
  'INVALID_SLUG',
  'INVALID_CODE',
  'ALREADY_USED',
  'OUT_OF_RANGE',
  'INVALID_AMOUNT',
  'PAYMENT_METHOD_REQUIRED',
] as const;
type AgencyValidationCode = (typeof AGENCY_VALIDATION_CODES)[number];

function isAgencyValidationCode(value: string): value is AgencyValidationCode {
  return (AGENCY_VALIDATION_CODES as readonly string[]).includes(value);
}

/** Traduit les codes de validation (Zod ou API) des formulaires de l'espace agence. */
export function useValidationMessage() {
  const t = useTranslations('agency.validation');
  return useCallback(
    (code: string | undefined): string | undefined => {
      if (code === undefined) {
        return undefined;
      }
      return isAgencyValidationCode(code) ? t(code) : t('generic');
    },
    [t],
  );
}

/** Reporte sur les champs les problèmes renvoyés par l'API (validation ou conflit). */
export function applyFieldIssues<T extends FieldValues>(
  error: unknown,
  setError: UseFormSetError<T>,
  fields: readonly Path<T>[],
): boolean {
  if (!(error instanceof ApiError)) {
    return false;
  }
  let applied = false;
  for (const issue of error.validationIssues) {
    const field = fields.find((name) => name === issue.path);
    if (field !== undefined) {
      setError(field, { type: 'server', message: issue.message });
      applied = true;
    }
  }
  return applied;
}
