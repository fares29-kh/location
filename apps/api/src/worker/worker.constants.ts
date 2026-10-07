export const MAINTENANCE_QUEUE = 'maintenance';
export const HEARTBEAT_JOB = 'heartbeat';

export const WORKER_HEARTBEAT_KEY = 'drivetn:worker:heartbeat';
export const WORKER_HEARTBEAT_INTERVAL_MS = 15_000;
/** Le worker est considéré hors service s'il n'a pas battu depuis 3 intervalles. */
export const WORKER_HEARTBEAT_TTL_SECONDS = 45;
