import nodemailer from 'nodemailer';

import type { Env } from '../config/env';

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

/** Envoie le code de confirmation. L'échec remonte pour que la file retente l'envoi. */
export async function sendSmtpEmail(
  config: Env,
  message: { to: string; subject: string; text: string },
): Promise<void> {
  await transportFor(config).sendMail({
    from: config.SMTP_FROM,
    to: message.to,
    subject: message.subject,
    text: message.text,
  });
}
