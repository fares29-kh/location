export const MAINTENANCE_QUEUE = 'maintenance';
export const HEARTBEAT_JOB = 'heartbeat';

export const PLATFORM_QUEUE = 'platform';
export const EXPIRE_BOOKINGS_JOB = 'expire-bookings';
export const EXPIRE_BOOKINGS_INTERVAL_MS = 15 * 60_000;
export const ISSUE_INVOICES_JOB = 'issue-invoices';
/** Chaque jour à 7 h (Tunis) : les factures du mois écoulé manquantes sont émises. */
export const ISSUE_INVOICES_CRON = '0 7 * * *';

export const WORKER_HEARTBEAT_KEY = 'drivetn:worker:heartbeat';
export const WORKER_HEARTBEAT_INTERVAL_MS = 15_000;
/** Le worker est considéré hors service s'il n'a pas battu depuis 3 intervalles. */
export const WORKER_HEARTBEAT_TTL_SECONDS = 45;
