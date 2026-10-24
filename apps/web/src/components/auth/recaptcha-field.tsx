'use client';

import { useLocale } from 'next-intl';
import { useEffect, useState } from 'react';

interface Grecaptcha {
  ready: (callback: () => void) => void;
  execute: (siteKey: string, options: { action: string }) => Promise<string>;
}

declare global {
  interface Window {
    grecaptcha?: Grecaptcha;
  }
}

const SCRIPT_ID = 'drivetn-recaptcha';
const ACTION = 'login';

let loading: Promise<void> | null = null;

function loadScript(siteKey: string, locale: string): Promise<void> {
  if (loading !== null) {
    return loading;
  }
  loading = new Promise((resolve, reject) => {
    if (document.getElementById(SCRIPT_ID) !== null) {
      resolve();
      return;
    }
    const script = document.createElement('script');
    script.id = SCRIPT_ID;
    const params = new URLSearchParams({ render: siteKey, hl: locale });
    script.src = `https://www.google.com/recaptcha/api.js?${params.toString()}`;
    script.async = true;
    script.onload = () => {
      resolve();
    };
    script.onerror = () => {
      loading = null;
      reject(new Error('recaptcha'));
    };
    document.head.appendChild(script);
  });
  return loading;
}

/** Demande un jeton reCAPTCHA v3 au moment de l'envoi du formulaire. */
export async function executeRecaptcha(siteKey: string, locale: string): Promise<string> {
  await loadScript(siteKey, locale);
  const grecaptcha = window.grecaptcha;
  if (grecaptcha === undefined) {
    throw new Error('recaptcha');
  }
  await new Promise<void>((resolve) => {
    grecaptcha.ready(resolve);
  });
  const token = await grecaptcha.execute(siteKey, { action: ACTION });
  if (token.length === 0) {
    throw new Error('recaptcha');
  }
  return token;
}

/** Prépare le jeton au moment de la connexion. Le badge Google s'affiche en bas de page. */
export function useLoginCaptcha(siteKey: string) {
  const locale = useLocale();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (siteKey === '') {
      return;
    }
    const showBadge = (): void => {
      document.querySelectorAll<HTMLElement>('.grecaptcha-badge').forEach((badge) => {
        badge.style.visibility = 'visible';
      });
    };
    const timer = window.setInterval(showBadge, 300);
    return () => {
      window.clearInterval(timer);
      document.querySelectorAll<HTMLElement>('.grecaptcha-badge').forEach((badge) => {
        badge.style.visibility = 'hidden';
      });
    };
  }, [siteKey]);

  const consume = async (): Promise<string | null> => {
    if (siteKey === '') {
      setFailed(false);
      return '';
    }
    try {
      const token = await executeRecaptcha(siteKey, locale);
      setFailed(false);
      return token;
    } catch {
      setFailed(true);
      return null;
    }
  };

  const reset = (): void => {
    setFailed(false);
  };

  return { consume, reset, missing: failed, field: null };
}
