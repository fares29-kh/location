import { cn } from '@drivetn/ui/lib/cn';

export function SectionHeading({
  id,
  eyebrow,
  title,
  text,
  align = 'center',
}: {
  id: string;
  eyebrow: string;
  title: string;
  text?: string;
  align?: 'center' | 'start';
}) {
  return (
    <div
      className={cn(
        'grid content-start gap-4',
        align === 'center' && 'mx-auto max-w-2xl justify-items-center text-center',
      )}
    >
      <span className="inline-flex w-fit items-center gap-2 rounded-full border border-primary/20 bg-primary-soft px-3 py-1 text-xs font-semibold uppercase tracking-wider text-primary-soft-foreground">
        <span className="size-1.5 rounded-full bg-primary" aria-hidden="true" />
        {eyebrow}
      </span>
      <h2
        id={id}
        className="text-[1.75rem] font-extrabold leading-tight tracking-tight sm:text-2xl lg:text-[2.5rem] lg:leading-[1.15]"
      >
        {title}
      </h2>
      {text !== undefined && (
        <p className="max-w-xl text-base text-muted-foreground sm:text-lg">{text}</p>
      )}
    </div>
  );
}
