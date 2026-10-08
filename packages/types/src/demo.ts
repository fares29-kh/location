import type { Portal } from './portal';

/** Mot de passe commun des comptes de démo (jamais créés en production). */
export const DEMO_PASSWORD = 'Demo2026!';

export interface DemoAccount {
  portal: Portal;
  email: string;
  /** Numéro national à 8 chiffres. */
  phone: string;
}

/** Comptes créés par le seed quand `SEED_DEMO_ACCOUNTS=true`, affichés sur les pages de connexion. */
export const DEMO_ACCOUNTS: readonly DemoAccount[] = [
  { portal: 'admin', email: 'admin@demo.tn', phone: '20000001' },
  { portal: 'admin', email: 'support@demo.tn', phone: '20000004' },
  { portal: 'admin', email: 'finance@demo.tn', phone: '20000005' },
  { portal: 'agency', email: 'agency@demo.tn', phone: '20000002' },
  { portal: 'client', email: 'customer@demo.tn', phone: '20000003' },
];

export function getDemoAccounts(portal: Portal): DemoAccount[] {
  return DEMO_ACCOUNTS.filter((account) => account.portal === portal);
}
