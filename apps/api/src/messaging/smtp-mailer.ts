import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import nodemailer from 'nodemailer';

import type { Env } from '../config/env';
import { EMAIL_LOGO_CID } from './email-otp';

type Mailer = ReturnType<typeof nodemailer.createTransport>;

const transports = new WeakMap<Env, Mailer>();

function transportFor(config: Env): Mailer {
  const existing = transports.get(config);
  if (existing !== undefined) {
    return existing;
  }
  const created = nodemailer.createTransport({
    host: config.SMTP_HOST,
    port: config.SMTP_PORT,
    secure: config.SMTP_SECURE,
    auth:
      config.SMTP_USER === '' ? undefined : { user: config.SMTP_USER, pass: config.SMTP_PASSWORD },
  });
  transports.set(config, created);
  return created;
}

function emailLogo(): Buffer {
  return readFileSync(join(__dirname, 'email-logo.png'));
}

/** Envoie le code de confirmation. L'échec remonte pour que la file retente l'envoi. */
export async function sendSmtpEmail(
  config: Env,
  message: { to: string; subject: string; text: string; html?: string },
): Promise<void> {
  await transportFor(config).sendMail({
    from: config.SMTP_FROM,
    to: message.to,
    subject: message.subject,
    text: message.text,
    html: message.html,
    attachments:
      message.html === undefined
        ? undefined
        : [{ filename: 'logo.png', content: emailLogo(), cid: EMAIL_LOGO_CID }],
  });
}
