import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Page introuvable' };

export default function NotFound() {
  return (
    <main
      style={{
        display: 'grid',
        placeItems: 'center',
        minBlockSize: '100dvh',
        padding: 24,
        textAlign: 'center',
      }}
    >
      <div>
        <h1 style={{ fontSize: 32, margin: '0 0 8px' }}>Page introuvable</h1>
        <p style={{ color: 'var(--text-muted)', margin: 0 }}>
          La page demandée n’existe pas ou a été déplacée.
        </p>
      </div>
    </main>
  );
}
