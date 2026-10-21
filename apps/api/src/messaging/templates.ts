import { formatMillimes, type Locale, type OtpPurpose } from '@drivetn/types';

import { renderOtpEmailHtml } from './email-otp';
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

/** Corps d'email. Le code reste dans le corps, jamais dans l'objet. */
const EMAIL_OTP_BODY: Record<Locale, string> = {
  fr: '{intro}\n\n{code}\n\nCe code est valable {minutes} minutes. Ne le communiquez à personne.\n\nSi vous n’êtes pas à l’origine de cette demande, ignorez cet email.',
  ar: '{intro}\n\n{code}\n\nهذا الرمز صالح لمدة {minutes} دقائق. لا تشاركه مع أي شخص.\n\nإذا لم تطلب هذا الرمز، تجاهل هذه الرسالة.',
  en: '{intro}\n\n{code}\n\nThis code is valid for {minutes} minutes. Never share it with anyone.\n\nIf you did not request this code, ignore this email.',
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
  const minutes = String(job.expiresInMinutes);
  if (job.channel === 'EMAIL') {
    return fill(EMAIL_OTP_BODY[job.locale], { intro, code: job.code, minutes });
  }
  const footer = fill(OTP_FOOTER[job.locale], { minutes });
  return `${intro} : ${job.code}. ${footer}`;
}

/** Version HTML d'un code email. Les SMS et WhatsApp restent en texte. */
export function renderEmailHtml(job: MessageJob, appName: string): string | undefined {
  if (job.template !== 'otp' || job.channel !== 'EMAIL') {
    return undefined;
  }
  return renderOtpEmailHtml(job, appName);
}

/** Objet d'un email de code. Le code lui-même n'y figure pas (aperçu de notification). */
export function renderEmailSubject(job: MessageJob, appName: string): string | undefined {
  if (job.template !== 'otp' || job.channel !== 'EMAIL') {
    return undefined;
  }
  return fill(OTP_INTRO[job.locale][job.purpose], { app: appName });
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
