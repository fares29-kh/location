import type { Locale, OtpPurpose } from '@drivetn/types';

import type { OtpMessageJob } from './messaging.types';

/** Identifiant de la pièce jointe inline (épingle DriveTN). */
export const EMAIL_LOGO_CID = 'drivetn-logo';

const FONT = "'Segoe UI', Helvetica, Arial, sans-serif";
const MONO = "Consolas, 'Courier New', monospace";

const RED = '#E60013';
const INK = '#0F172A';
const MUTED = '#64748B';
const FAINT = '#94A3B8';
const LINE = '#E2E8F0';
const PAGE = '#F8FAFC';
const SOFT = '#FFF1F2';

interface EmailCopy {
  headline: string;
  lead: string;
  validity: string;
  caution: string;
  ignore: string;
  footer: string;
}

const COPY: Record<Locale, Record<OtpPurpose, Pick<EmailCopy, 'headline' | 'lead'>>> = {
  fr: {
    SIGNUP: {
      headline: 'Confirmez votre adresse email',
      lead: 'Voici votre code pour activer votre compte {app}.',
    },
    LOGIN: {
      headline: 'Connectez-vous à votre compte',
      lead: 'Voici votre code pour vous connecter à {app}.',
    },
    PASSWORD_RESET: {
      headline: 'Réinitialisez votre mot de passe',
      lead: 'Voici votre code pour choisir un nouveau mot de passe.',
    },
  },
  en: {
    SIGNUP: {
      headline: 'Confirm your email address',
      lead: 'Use this code to activate your {app} account.',
    },
    LOGIN: {
      headline: 'Sign in to your account',
      lead: 'Use this code to sign in to {app}.',
    },
    PASSWORD_RESET: {
      headline: 'Reset your password',
      lead: 'Use this code to choose a new password.',
    },
  },
  ar: {
    SIGNUP: {
      headline: 'أكّد بريدك الإلكتروني',
      lead: 'استخدم هذا الرمز لتفعيل حسابك في {app}.',
    },
    LOGIN: {
      headline: 'سجّل الدخول إلى حسابك',
      lead: 'استخدم هذا الرمز للدخول إلى {app}.',
    },
    PASSWORD_RESET: {
      headline: 'أعد تعيين كلمة المرور',
      lead: 'استخدم هذا الرمز لاختيار كلمة مرور جديدة.',
    },
  },
};

const SHARED: Record<Locale, Omit<EmailCopy, 'headline' | 'lead'>> = {
  fr: {
    validity: 'Valable {minutes} minutes',
    caution: 'Ne communiquez ce code à personne. {app} ne vous le demandera jamais.',
    ignore: 'Si vous n’êtes pas à l’origine de cette demande, ignorez cet email.',
    footer: 'Location de voitures en Tunisie',
  },
  en: {
    validity: 'Valid for {minutes} minutes',
    caution: 'Never share this code. {app} will never ask you for it.',
    ignore: 'If you did not request this code, ignore this email.',
    footer: 'Car rental in Tunisia',
  },
  ar: {
    validity: 'صالح لمدة {minutes} دقائق',
    caution: 'لا تشارك هذا الرمز مع أي شخص. لن يطلبه منك {app} أبدًا.',
    ignore: 'إذا لم تطلب هذا الرمز، تجاهل هذه الرسالة.',
    footer: 'تأجير سيارات في تونس',
  },
};

function fill(template: string, values: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => values[key] ?? match);
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function codeCells(code: string): string {
  const cells: string[] = [];
  for (let index = 0; index < code.length; index += 1) {
    const digit = escapeHtml(code.charAt(index));
    cells.push(
      `<td style="width:44px;height:52px;background:${PAGE};border:1px solid ${LINE};border-radius:12px;text-align:center;font-family:${MONO};font-size:26px;font-weight:700;color:${INK};">${digit}</td>`,
    );
  }
  return cells.join('<td style="width:8px;font-size:0;line-height:0;">&nbsp;</td>');
}

/** Email HTML du code, aux couleurs du site. Le code n'est pas dans l'aperçu masqué. */
export function renderOtpEmailHtml(job: OtpMessageJob, appName: string): string {
  const locale = job.locale;
  const dir = locale === 'ar' ? 'rtl' : 'ltr';
  const align = dir === 'rtl' ? 'right' : 'left';
  const values = { app: escapeHtml(appName), minutes: String(job.expiresInMinutes) };
  const purpose = COPY[locale][job.purpose];
  const shared = SHARED[locale];
  const headline = escapeHtml(purpose.headline);
  const lead = fill(purpose.lead, values);
  const validity = fill(shared.validity, values);
  const caution = fill(shared.caution, values);
  const ignore = escapeHtml(shared.ignore);
  const footer = escapeHtml(shared.footer);
  const wordGap = dir === 'rtl' ? 'padding-right:12px;' : 'padding-left:12px;';

  return `<!DOCTYPE html>
<html lang="${locale}" dir="${dir}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light">
<title>${headline}</title>
</head>
<body style="margin:0;padding:0;background:${PAGE};">
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">${lead}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${PAGE};">
<tr>
<td align="center" style="padding:32px 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border:1px solid ${LINE};border-radius:16px;">
<tr><td bgcolor="${RED}" style="height:4px;background:${RED};font-size:0;line-height:0;border-radius:16px 16px 0 0;">&nbsp;</td></tr>
<tr>
<td style="padding:28px 32px 0;" align="${align}">
<table role="presentation" cellpadding="0" cellspacing="0" dir="${dir}">
<tr>
<td style="vertical-align:middle;"><img src="cid:${EMAIL_LOGO_CID}" width="36" height="36" alt="" style="display:block;border:0;"></td>
<td style="vertical-align:middle;${wordGap}font-family:${FONT};font-size:22px;font-weight:800;letter-spacing:-0.03em;color:${INK};" dir="ltr">Drive<span style="color:${RED};">Tn</span></td>
</tr>
</table>
</td>
</tr>
<tr>
<td style="padding:24px 32px 0;font-family:${FONT};font-size:22px;line-height:1.3;font-weight:700;color:${INK};text-align:${align};">${headline}</td>
</tr>
<tr>
<td style="padding:8px 32px 0;font-family:${FONT};font-size:15px;line-height:1.6;color:${MUTED};text-align:${align};">${lead}</td>
</tr>
<tr>
<td align="center" style="padding:28px 32px 0;">
<table role="presentation" cellpadding="0" cellspacing="0" dir="ltr">
<tr>${codeCells(job.code)}</tr>
</table>
</td>
</tr>
<tr>
<td style="padding:12px 32px 0;font-family:${FONT};font-size:13px;line-height:1.5;color:${MUTED};text-align:center;">${validity}</td>
</tr>
<tr>
<td style="padding:24px 32px 8px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${SOFT};border-radius:12px;">
<tr>
<td style="padding:14px 16px;font-family:${FONT};font-size:13px;line-height:1.6;color:${INK};text-align:${align};">${caution}<br>${ignore}</td>
</tr>
</table>
</td>
</tr>
<tr>
<td style="padding:8px 32px 28px;font-family:${FONT};font-size:12px;line-height:1.5;color:${FAINT};text-align:${align};">${footer}</td>
</tr>
</table>
</td>
</tr>
</table>
</body>
</html>`;
}
