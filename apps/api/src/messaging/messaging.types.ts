import type { DeliveryChannel, Locale, OtpPurpose } from '@drivetn/types';

export const MESSAGING_QUEUE = 'messaging';
export const SEND_MESSAGE_JOB = 'send';

/** Message prêt à être remis par un fournisseur SMS ou WhatsApp. */
export interface OutboundMessage {
  channel: DeliveryChannel;
  /** Numéro E.164, ou adresse email pour un code de confirmation. */
  to: string;
  body: string;
  /** Objet, uniquement pour un email. Le code n'y figure pas. */
  subject?: string;
}

export interface OtpMessageJob {
  template: 'otp';
  channel: DeliveryChannel;
  to: string;
  locale: Locale;
  code: string;
  purpose: OtpPurpose;
  expiresInMinutes: number;
}

/** Relance d'une facture d'abonnement impayée, envoyée par email au gérant de l'agence. */
export interface InvoiceReminderJob {
  template: 'invoice_reminder';
  channel: DeliveryChannel;
  to: string;
  locale: Locale;
  invoiceNumber: string;
  totalMillimes: number;
  /** Échéance « AAAA-MM-JJ » (heure de Tunis). */
  dueDate: string;
  /** Échéance dépassée au moment de la relance. */
  overdue: boolean;
}

export type MessageJob = OtpMessageJob | InvoiceReminderJob;

/**
 * Fournisseur d'envoi pluggable (passerelle SMS tunisienne, WhatsApp Business API,
 * Twilio...). L'implémentation `console` écrit les messages dans les logs du worker.
 */
export interface MessagingProvider {
  readonly name: string;
  send(message: OutboundMessage): Promise<void>;
}

export const MESSAGING_PROVIDER = Symbol('MESSAGING_PROVIDER');
