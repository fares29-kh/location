'use client';

import {
  formatNationalPhone,
  OTP_LENGTH,
  type OtpDispatch,
  TUNISIA_DIAL_CODE,
} from '@drivetn/types';
import { Alert } from '@drivetn/ui/alert';
import { Button } from '@drivetn/ui/button';
import { OtpInput } from '@drivetn/ui/otp-input';
import { ArrowLeft } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { type SyntheticEvent, useState } from 'react';

import { ResendCode } from './resend-code';

export interface OtpStepProps {
  dispatch: OtpDispatch;
  pending: boolean;
  /** Message d'erreur déjà traduit (code incorrect, expiré…). */
  error: string | null;
  onVerify: (code: string) => void;
  onResend: () => Promise<OtpDispatch>;
  onBack: () => void;
}

/** Numéro isolé (LRI … PDI) pour rester lisible de gauche à droite dans une phrase en arabe. */
export function displayPhone(nationalPhone: string): string {
  return `\u2066+${TUNISIA_DIAL_CODE} ${formatNationalPhone(nationalPhone)}\u2069`;
}

/** Saisie du code reçu par SMS / WhatsApp, avec renvoi et retour au numéro. */
export function OtpStep({ dispatch, pending, error, onVerify, onResend, onBack }: OtpStepProps) {
  const t = useTranslations('auth.otp');
  const [code, setCode] = useState('');
  const complete = code.length === OTP_LENGTH;

  function submit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    if (complete) {
      onVerify(code);
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-5" noValidate>
      <div className="grid gap-1">
        <h2 className="font-heading text-lg font-semibold">{t('title')}</h2>
        <p className="text-sm text-muted-foreground">
          {t('description', { phone: displayPhone(dispatch.phone) })}
        </p>
      </div>

      <OtpInput
        value={code}
        onValueChange={setCode}
        onComplete={onVerify}
        disabled={pending}
        invalid={error !== null}
        getInputLabel={(index, length) => t('digitLabel', { index: index + 1, length })}
        className="justify-center"
      />

      {error !== null && <Alert tone="danger">{error}</Alert>}

      <Button type="submit" disabled={!complete} loading={pending}>
        {t('verify')}
      </Button>

      <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
        <Button
          type="button"
          variant="link"
          className="h-auto px-0 text-muted-foreground"
          onClick={onBack}
        >
          <ArrowLeft className="rtl:rotate-180" aria-hidden="true" />
          {t('back')}
        </Button>
        <ResendCode initialSeconds={dispatch.resendInSeconds} onResend={onResend} />
      </div>
    </form>
  );
}
