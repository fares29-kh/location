'use client';

import { useTranslations } from 'next-intl';
import { useCallback } from 'react';
import type { FieldValues, Path, UseFormSetError } from 'react-hook-form';

import { ApiError } from '@/lib/api/errors';

const VALIDATION_CODES = [
  'REQUIRED',
  'TOO_LONG',
  'INVALID_TUNISIAN_PHONE',
  'INVALID_EMAIL',
  'INVALID_IDENTIFIER',
  'INVALID_OTP_FORMAT',
  'PASSWORD_TOO_SHORT',
  'PASSWORD_TOO_LONG',
  'PASSWORD_TOO_WEAK',
] as const;
type ValidationCode = (typeof VALIDATION_CODES)[number];

const SIMPLE_ERROR_CODES = [
  'NETWORK_ERROR',
  'INVALID_CREDENTIALS',
  'CAPTCHA_FAILED',
  'OTP_EXPIRED',
  'OTP_TOO_MANY_ATTEMPTS',
  'PHONE_ALREADY_USED',
  'EMAIL_ALREADY_USED',
  'PHONE_NOT_VERIFIED',
  'EMAIL_NOT_VERIFIED',
  'ACCOUNT_SUSPENDED',
  'FORBIDDEN',
  'UNAUTHORIZED',
] as const;
type SimpleErrorCode = (typeof SIMPLE_ERROR_CODES)[number];

function isValidationCode(value: string): value is ValidationCode {
  return (VALIDATION_CODES as readonly string[]).includes(value);
}

function isSimpleErrorCode(value: string): value is SimpleErrorCode {
  return (SIMPLE_ERROR_CODES as readonly string[]).includes(value);
}

/** Traduit les codes de validation Zod et les codes d'erreur de l'API des formulaires d'auth. */
export function useAuthMessages() {
  const t = useTranslations('auth');

  /** Message d'un champ : code de validation Zod, ou code d'erreur API posé sur le champ. */
  const validationMessage = useCallback(
    (code: string | undefined): string | undefined => {
      if (code === undefined) {
        return undefined;
      }
      if (isValidationCode(code)) {
        return t(`validation.${code}`);
      }
      return isSimpleErrorCode(code) ? t(`errors.${code}`) : t('validation.generic');
    },
    [t],
  );

  const errorMessage = useCallback(
    (error: unknown): string => {
      if (!(error instanceof ApiError)) {
        return t('errors.generic');
      }
      if (error.code === 'OTP_INVALID') {
        return t('errors.OTP_INVALID', { attempts: error.detailNumber('attemptsLeft') ?? 0 });
      }
      if (error.code === 'TOO_MANY_REQUESTS') {
        return t('errors.TOO_MANY_REQUESTS', {
          seconds: error.detailNumber('retryAfterSeconds') ?? 60,
        });
      }
      return isSimpleErrorCode(error.code) ? t(`errors.${error.code}`) : t('errors.generic');
    },
    [t],
  );

  return { validationMessage, errorMessage };
}

/**
 * Reporte sur les champs du formulaire les erreurs de validation renvoyées par l'API.
 * Renvoie `true` si au moins un champ a été marqué.
 */
export function applyServerIssues<T extends FieldValues>(
  error: unknown,
  setError: UseFormSetError<T>,
  fields: readonly Path<T>[],
): boolean {
  if (!(error instanceof ApiError) || error.code !== 'VALIDATION_ERROR') {
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
