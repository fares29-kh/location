import { cn } from '@drivetn/ui/lib/cn';

import { agencyInitials } from './agency-directory';

const AVATAR_GRADIENTS = [
  'from-primary to-info',
  'from-cta to-tn-red',
  'from-success to-info',
  'from-violet-500 to-primary',
  'from-amber-500 to-cta',
] as const;

function avatarGradient(seed: string): string {
  let hash = 0;
  for (const char of seed) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  }
  return AVATAR_GRADIENTS[hash % AVATAR_GRADIENTS.length] ?? AVATAR_GRADIENTS[0];
}

/**
 * Logo de l'agence, ou ses initiales sur un dégradé stable quand elle n'en a pas déposé.
 * Décoratif : le nom de l'agence est toujours affiché à côté.
 */
export function AgencyLogo({
  name,
  logoUrl,
  seed = name,
  className,
}: {
  name: string;
  logoUrl: string | null;
  /** Choisit le dégradé de repli (l'identifiant de l'agence quand il est connu). */
  seed?: string;
  className?: string;
}) {
  const base =
    'flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-xl shadow-sm ring-2 ring-white/70 dark:ring-white/10';
  if (logoUrl !== null) {
    return (
      <span aria-hidden="true" className={cn(base, 'bg-white p-1', className)}>
        {/* eslint-disable-next-line @next/next/no-img-element -- logo déjà redimensionné en WebP par l'API */}
        <img
          src={logoUrl}
          alt=""
          loading="lazy"
          decoding="async"
          className="size-full object-contain"
        />
      </span>
    );
  }
  return (
    <span
      aria-hidden="true"
      className={cn(
        base,
        'bg-gradient-to-br font-heading text-base font-extrabold text-white',
        avatarGradient(seed),
        className,
      )}
    >
      {agencyInitials(name)}
    </span>
  );
}
