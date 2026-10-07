'use client';

import type { OtpDispatch } from '@drivetn/types';
import { Button } from '@drivetn/ui/button';
import { toast } from '@drivetn/ui/toaster';
import { useMutation } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

import { useAuthMessages } from './use-auth-messages';

/** Bouton « Renvoyer le code » avec compte à rebours (délai imposé par l'API). */
export function ResendCode({
  initialSeconds,
  onResend,
}: {
  initialSeconds: number;
  onResend: () => Promise<OtpDispatch>;
}) {
  const t = useTranslations('auth.otp');
  const { errorMessage } = useAuthMessages();
  const [seconds, setSeconds] = useState(initialSeconds);

  useEffect(() => {
    if (seconds <= 0) {
      return;
    }
    const timer = setTimeout(() => {
      setSeconds((value) => value - 1);
    }, 1000);
    return () => {
      clearTimeout(timer);
    };
  }, [seconds]);

  const resend = useMutation({
    mutationFn: onResend,
    onSuccess: (dispatch) => {
      setSeconds(dispatch.resendInSeconds);
      toast.success(t('resent'));
    },
    onError: (error) => {
      toast.error(errorMessage(error));
    },
  });

  return (
    <Button
      type="button"
      variant="link"
      className="h-auto px-0"
      disabled={seconds > 0}
      loading={resend.isPending}
      onClick={() => {
        resend.mutate();
      }}
    >
      {seconds > 0 ? t('resendIn', { seconds }) : t('resend')}
    </Button>
  );
}
