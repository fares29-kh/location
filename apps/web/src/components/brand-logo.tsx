import { cn } from '@drivetn/ui/lib/cn';
import { CarFront } from 'lucide-react';

export interface BrandLogoProps {
  /** Masque le nom pour ne garder que le pictogramme (barre latérale réduite). */
  compact?: boolean;
  className?: string;
}

export function BrandLogo({ compact = false, className }: BrandLogoProps) {
  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      <span className="flex size-9 shrink-0 items-center justify-center rounded-control bg-primary text-primary-foreground shadow-sm">
        <CarFront className="size-5" aria-hidden="true" />
      </span>
      <span
        dir="ltr"
        className={cn(
          'font-heading text-lg font-extrabold tracking-tight text-foreground',
          compact && 'sr-only',
        )}
      >
        Drive<span className="text-tn-red">TN</span>
      </span>
    </span>
  );
}
