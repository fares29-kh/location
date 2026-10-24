'use client';

import { useTheme } from 'next-themes';
import { useLocale } from 'next-intl';
import { useEffect, useRef, useState } from 'react';

interface Grecaptcha {
  render: (
    element: HTMLElement,
    options: {
      sitekey: string;
      theme: 'light' | 'dark';
      size: 'compact' | 'normal';
      hl: string;
      callback: (token: string) => void;
      'expired-callback': () => void;
      'error-callback': () => void;
    },
  ) => number;
  reset: (widgetId?: number) => void;
}

declare global {
  interface Window {
    grecaptcha?: Grecaptcha;
  }
}

const SCRIPT_ID = 'drivetn-recaptcha';

function loadScript(): void {
  if (document.getElementById(SCRIPT_ID) !== null) {
    return;
  }
  const script = document.createElement('script');
  script.id = SCRIPT_ID;
  script.src = 'https://www.google.com/recaptcha/api.js?render=explicit';
  script.async = true;
  script.defer = true;
  document.head.appendChild(script);
}

/** Case « Je ne suis pas un robot ». Rien n'est affiché si la clé de site est vide. */
export function RecaptchaField({
  siteKey,
  resetSignal,
  onToken,
}: {
  siteKey: string;
  resetSignal: number;
  onToken: (token: string) => void;
}) {
  const locale = useLocale();
  const { resolvedTheme } = useTheme();
  const host = useRef<HTMLDivElement>(null);
  const widgetId = useRef<number | null>(null);
  const onTokenRef = useRef(onToken);
  useEffect(() => {
    onTokenRef.current = onToken;
  }, [onToken]);

  useEffect(() => {
    if (siteKey === '') {
      return;
    }
    loadScript();
    let cancelled = false;
    const timer = window.setInterval(() => {
      const grecaptcha = window.grecaptcha;
      const element = host.current;
      if (cancelled || grecaptcha === undefined || element === null || widgetId.current !== null) {
        if (widgetId.current !== null) {
          window.clearInterval(timer);
        }
        return;
      }
      widgetId.current = grecaptcha.render(element, {
        sitekey: siteKey,
        theme: resolvedTheme === 'dark' ? 'dark' : 'light',
        size: window.matchMedia('(max-width: 400px)').matches ? 'compact' : 'normal',
        hl: locale,
        callback: (token) => {
          onTokenRef.current(token);
        },
        'expired-callback': () => {
          onTokenRef.current('');
        },
        'error-callback': () => {
          onTokenRef.current('');
        },
      });
      window.clearInterval(timer);
    }, 100);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [siteKey, locale, resolvedTheme]);

  useEffect(() => {
    if (resetSignal === 0 || widgetId.current === null || window.grecaptcha === undefined) {
      return;
    }
    window.grecaptcha.reset(widgetId.current);
  }, [resetSignal]);

  if (siteKey === '') {
    return null;
  }

  return (
    <div className="max-w-full overflow-x-auto">
      <div ref={host} />
    </div>
  );
}

/** Garde le jeton de la case et signale un envoi sans coche. */
export function useLoginCaptcha(siteKey: string) {
  const token = useRef('');
  const [missing, setMissing] = useState(false);
  const [resetSignal, setResetSignal] = useState(0);

  const consume = (): string | null => {
    if (siteKey !== '' && token.current === '') {
      setMissing(true);
      return null;
    }
    setMissing(false);
    return token.current;
  };

  const reset = (): void => {
    token.current = '';
    setResetSignal((current) => current + 1);
  };

  const field = (
    <RecaptchaField
      siteKey={siteKey}
      resetSignal={resetSignal}
      onToken={(value) => {
        token.current = value;
        if (value !== '') {
          setMissing(false);
        }
      }}
    />
  );

  return { consume, reset, missing, field };
}
