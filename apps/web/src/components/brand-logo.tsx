import { cn } from '@drivetn/ui/lib/cn';

export interface BrandLogoProps {
  /** Masque le nom pour ne garder que le pictogramme (barre latérale réduite). */
  compact?: boolean;
  className?: string;
}

/**
 * Épingle rouge et voiture blanche, alignées sur le logo DriveTn.
 * La voiture reste blanche sur le rouge, y compris en thème sombre.
 */
function BrandMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 48 64"
      className={cn('h-10 w-[1.875rem] shrink-0 text-tn-red', className)}
      aria-hidden="true"
    >
      <path
        fill="currentColor"
        d="M24 1.6C12.4 1.6 3 10.8 3 22.2 3 36.8 24 62.4 24 62.4S45 36.8 45 22.2C45 10.8 35.6 1.6 24 1.6z"
      />
      <path
        fill="#fff"
        d="M16.2 12.2h15.6c1.6 0 2.85 1.15 3.05 2.65l1.25 4.85H11.9l1.25-4.85c.2-1.5 1.45-2.65 3.05-2.65z"
      />
      <rect x="9.2" y="18.6" width="29.6" height="10.2" rx="3.1" fill="#fff" />
      <circle cx="15.3" cy="29.8" r="3.65" fill="#fff" />
      <circle cx="32.7" cy="29.8" r="3.65" fill="#fff" />
      <circle cx="15.3" cy="29.8" r="1.5" fill="currentColor" />
      <circle cx="32.7" cy="29.8" r="1.5" fill="currentColor" />
    </svg>
  );
}

export function BrandLogo({ compact = false, className }: BrandLogoProps) {
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <BrandMark />
      <span
        dir="ltr"
        className={cn(
          'font-heading text-xl font-extrabold leading-none tracking-tight text-foreground',
          compact && 'sr-only',
        )}
      >
        Drive<span className="text-tn-red">Tn</span>
      </span>
    </span>
  );
}
