import { formatMillimes, type Locale, type OtpPurpose } from '@drivetn/types';

import type { InvoiceReminderJob, MessageJob, OtpMessageJob } from './messaging.types';

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

const INVOICE_REMINDER: Record<'upcoming' | 'overdue', Record<Locale, string>> = {
  upcoming: {
    fr: '{app} : la facture {number} ({amount}) arrive à échéance le {due}. Merci de procéder au règlement ou de contacter le support.',
    ar: '{app}: الفاتورة {number} ({amount}) مستحقة بتاريخ {due}. يرجى تسديدها أو الاتصال بالدعم.',
    en: '{app}: invoice {number} ({amount}) is due on {due}. Please settle it or contact support.',
  },
  overdue: {
    fr: '{app} : la facture {number} ({amount}) était à régler avant le {due} et reste impayée. Merci de procéder au règlement ou de contacter le support.',
    ar: '{app}: الفاتورة {number} ({amount}) كانت مستحقة بتاريخ {due} ولم تُسدَّد بعد. يرجى تسديدها أو الاتصال بالدعم.',
    en: '{app}: invoice {number} ({amount}) was due on {due} and remains unpaid. Please settle it or contact support.',
  },
};

function fill(template: string, values: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => values[key] ?? match);
}

/** « AAAA-MM-JJ » → « JJ/MM/AAAA ». */
function formatDay(day: string): string {
  return day.split('-').reverse().join('/');
}

function renderOtp(job: OtpMessageJob, appName: string): string {
  const intro = fill(OTP_INTRO[job.locale][job.purpose], { app: appName });
  const footer = fill(OTP_FOOTER[job.locale], { minutes: String(job.expiresInMinutes) });
  return `${intro} : ${job.code}. ${footer}`;
}

function renderInvoiceReminder(job: InvoiceReminderJob, appName: string): string {
  return fill(INVOICE_REMINDER[job.overdue ? 'overdue' : 'upcoming'][job.locale], {
    app: appName,
    number: job.invoiceNumber,
    amount: formatMillimes(job.totalMillimes, job.locale),
    due: formatDay(job.dueDate),
  });
}

/** Texte du SMS / message WhatsApp, dans la langue du destinataire. */
export function renderMessage(job: MessageJob, appName: string): string {
  switch (job.template) {
    case 'otp':
      return renderOtp(job, appName);
    case 'invoice_reminder':
      return renderInvoiceReminder(job, appName);
  }
}
