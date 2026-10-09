import { cn } from '@drivetn/ui/lib/cn';
import { CarFront } from 'lucide-react';

function isLightColor(hex: string): boolean {
  const value = Number.parseInt(hex.replace('#', ''), 16);
  if (Number.isNaN(value)) {
    return false;
  }
  const red = (value >> 16) & 0xff;
  const green = (value >> 8) & 0xff;
  const blue = value & 0xff;
  return (red * 299 + green * 587 + blue * 114) / 1000 > 170;
}

const SIZES = {
  sm: 'size-10 rounded-control [&_svg]:size-5',
  md: 'size-12 rounded-control [&_svg]:size-6',
  lg: 'h-32 w-full rounded-card [&_svg]:size-14',
} as const;

/** Vignette d'un véhicule : sa photo de couverture, sinon un aplat de sa couleur de carrosserie. */
export function VehicleThumb({
  color,
  photoUrl,
  size = 'sm',
  className,
}: {
  color: string;
  photoUrl?: string | null;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  const light = isLightColor(color);
  return (
    <span
      aria-hidden="true"
      className={cn(
        'relative flex shrink-0 items-center justify-center overflow-hidden ring-1 ring-inset ring-black/5',
        light ? 'text-slate-700' : 'text-white',
        SIZES[size],
        className,
      )}
      style={{
        backgroundColor: color,
        backgroundImage:
          'radial-gradient(120% 90% at 85% 0%, rgb(255 255 255 / 0.35), transparent 55%), linear-gradient(160deg, transparent 40%, rgb(0 0 0 / 0.18))',
      }}
    >
      <CarFront strokeWidth={1.75} />
      {photoUrl !== undefined && photoUrl !== null && (
        // eslint-disable-next-line @next/next/no-img-element -- médias déjà redimensionnés en WebP
        <img
          src={photoUrl}
          alt=""
          loading="lazy"
          decoding="async"
          className="absolute inset-0 size-full object-cover"
        />
      )}
    </span>
  );
}
