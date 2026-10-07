import type { DependencyStatus, HealthStatus, Portal } from '@drivetn/types';
import type { CSSProperties } from 'react';

import { getServerEnv } from '@/env';
import { fetchApiHealth } from '@/lib/api-health';
import { PORTAL_CONFIG } from '@/lib/portal';

import styles from './portal-hello.module.css';

const STATUS_LABELS: Record<HealthStatus, string> = {
  ok: 'Opérationnelle',
  degraded: 'Dégradée',
  error: 'En erreur',
};

const DEPENDENCY_LABELS = {
  database: 'Base de données',
  redis: 'Redis',
  worker: 'Worker (tâches de fond)',
} as const;

function StatusDot({ status }: { status: DependencyStatus | HealthStatus | 'unreachable' }) {
  return <span className={styles.dot} data-status={status} aria-hidden="true" />;
}

export async function PortalHello({ portal }: { portal: Portal }) {
  const { APP_NAME } = getServerEnv();
  const config = PORTAL_CONFIG[portal];
  const health = await fetchApiHealth();

  const accentStyle = {
    '--primary': config.accent,
    '--primary-soft': config.accentSoft,
  } as CSSProperties;

  return (
    <main className={styles.page} style={accentStyle}>
      <section className={styles.card} aria-labelledby="portal-title">
        <p className={styles.badge}>{config.label}</p>
        <h1 id="portal-title" className={styles.title}>
          Bonjour, {APP_NAME}
        </h1>
        <p className={styles.subtitle}>{config.audience}</p>

        <div className={styles.status} role="status">
          <h2 className={styles.statusTitle}>
            <StatusDot status={health?.status ?? 'unreachable'} />
            API : {health === null ? 'Injoignable' : STATUS_LABELS[health.status]}
          </h2>
          {health !== null && (
            <ul className={styles.checks}>
              {(Object.keys(DEPENDENCY_LABELS) as (keyof typeof DEPENDENCY_LABELS)[]).map((key) => (
                <li key={key} className={styles.check}>
                  <StatusDot status={health.checks[key]} />
                  <span>{DEPENDENCY_LABELS[key]}</span>
                  <span className={styles.checkValue}>
                    {health.checks[key] === 'up' ? 'Disponible' : 'Indisponible'}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <p className={styles.footnote}>
          Aucun paiement en ligne : vous payez directement à l’agence.
        </p>
      </section>
    </main>
  );
}
