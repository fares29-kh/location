'use client';

import type { AuthResult, OtpDispatch } from '@drivetn/types';
import { useMutation } from '@tanstack/react-query';

import { authApi } from '@/lib/api/auth';

import { OtpStep } from './otp-step';
import { useAuthMessages } from './use-auth-messages';

/** Code envoyé, en attente de saisie : confirmation d'email ou connexion sans mot de passe. */
export interface PendingVerification {
  flow: 'signup' | 'login';
  dispatch: OtpDispatch & { email: string };
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
  const { flow, dispatch } = verification;

  const verify = useMutation({
    mutationFn: (code: string) =>
      flow === 'signup'
        ? authApi.verifySignup({ email: dispatch.email, code })
        : authApi.loginWithOtp({ email: dispatch.email, code }),
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
          purpose: flow === 'signup' ? 'SIGNUP' : 'LOGIN',
          email: dispatch.email,
        })
      }
      onBack={onBack}
    />
  );
}
