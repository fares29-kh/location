import type { Locale, OtpPurpose } from '@drivetn/types';

import type { MessageJob } from './messaging.types';

const OTP_INTRO: Record<Locale, Record<OtpPurpose, string>> = {
  fr: {
    SIGNUP: 'Votre code de vérification {app}',
    LOGIN: 'Votre code de connexion {app}',
    PASSWORD_RESET: 'Votre code de réinitialisation {app}',
  },
  ar: {
    SIGNUP: 'رمز التحقق الخاص بك في {app}',
    LOGIN: 'رمز الدخول الخاص بك في {app}',
    PASSWORD_RESET: 'رمز إعادة تعيين كلمة المرور في {app}',
  },
  en: {
    SIGNUP: 'Your {app} verification code',
    LOGIN: 'Your {app} sign-in code',
    PASSWORD_RESET: 'Your {app} password reset code',
  },
};

const OTP_FOOTER: Record<Locale, string> = {
  fr: 'Valable {minutes} min. Ne le communiquez à personne.',
  ar: 'صالح لمدة {minutes} دقائق. لا تشاركه مع أي شخص.',
  en: 'Valid for {minutes} min. Never share it with anyone.',
};

function fill(template: string, values: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => values[key] ?? match);
}

/** Texte du SMS / message WhatsApp, dans la langue du destinataire. */
export function renderMessage(job: MessageJob, appName: string): string {
  const intro = fill(OTP_INTRO[job.locale][job.purpose], { app: appName });
  const footer = fill(OTP_FOOTER[job.locale], { minutes: String(job.expiresInMinutes) });
  return `${intro} : ${job.code}. ${footer}`;
}
