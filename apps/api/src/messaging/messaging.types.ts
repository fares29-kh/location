import type { Locale, OtpChannel, OtpPurpose } from '@drivetn/types';

export const MESSAGING_QUEUE = 'messaging';
export const SEND_MESSAGE_JOB = 'send';

/** Message prêt à être remis par un fournisseur SMS ou WhatsApp. */
export interface OutboundMessage {
  channel: OtpChannel;
  /** Destinataire au format E.164. */
  to: string;
  body: string;
}

export interface OtpMessageJob {
  template: 'otp';
  channel: OtpChannel;
  to: string;
  locale: Locale;
  code: string;
  purpose: OtpPurpose;
  expiresInMinutes: number;
}

export type MessageJob = OtpMessageJob;

/**
 * Fournisseur d'envoi pluggable (passerelle SMS tunisienne, WhatsApp Business API,
 * Twilio...). L'implémentation `console` écrit les messages dans les logs du worker.
 */
export interface MessagingProvider {
  readonly name: string;
  send(message: OutboundMessage): Promise<void>;
}

export const MESSAGING_PROVIDER = Symbol('MESSAGING_PROVIDER');
