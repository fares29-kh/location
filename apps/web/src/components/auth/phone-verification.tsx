'use client';

import type { AuthResult, OtpChannel, OtpDispatch } from '@drivetn/types';
import { useMutation } from '@tanstack/react-query';

import { authApi } from '@/lib/api/auth';

import { OtpStep } from './otp-step';
import { useAuthMessages } from './use-auth-messages';

/** Code envoyé, en attente de saisie : vérification d'inscription ou connexion sans mot de passe. */
export interface PendingVerification {
  flow: 'signup' | 'login';
  channel: OtpChannel;
  dispatch: OtpDispatch;
}

export function PhoneVerification({
  verification,
  redirecting,
  onAuthenticated,
  onBack,
}: {
  verification: PendingVerification;
  redirecting: boolean;
  onAuthenticated: (result: AuthResult) => void;
  onBack: () => void;
}) {
  const { errorMessage } = useAuthMessages();
  const { flow, channel, dispatch } = verification;

  const verify = useMutation({
    mutationFn: (code: string) =>
      flow === 'signup'
        ? authApi.verifySignup({ phone: dispatch.phone, code })
        : authApi.loginWithOtp({ phone: dispatch.phone, code }),
    onSuccess: onAuthenticated,
  });

  return (
    <OtpStep
      dispatch={dispatch}
      pending={verify.isPending || redirecting}
      error={verify.isError ? errorMessage(verify.error) : null}
      onVerify={(code) => {
        verify.mutate(code);
      }}
      onResend={() =>
        authApi.requestOtp({
          phone: dispatch.phone,
          purpose: flow === 'signup' ? 'SIGNUP' : 'LOGIN',
          channel,
        })
      }
      onBack={onBack}
    />
  );
}
