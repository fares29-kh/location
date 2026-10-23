'use client';

import { cva, type VariantProps } from 'class-variance-authority';
import { X } from 'lucide-react';
import { Dialog as SheetPrimitive } from 'radix-ui';
import type { ComponentProps } from 'react';

import { cn } from '../lib/cn';
import { overlayClassName } from './dialog';

export const Sheet = SheetPrimitive.Root;
export const SheetTrigger = SheetPrimitive.Trigger;
export const SheetClose = SheetPrimitive.Close;

const sheetVariants = cva(
  [
    'fixed z-[80] flex flex-col gap-4 bg-surface p-6 text-foreground shadow-elevated',
    'transition ease-in-out data-[state=open]:animate-in data-[state=closed]:animate-out',
    'data-[state=closed]:duration-200 data-[state=open]:duration-300',
  ],
  {
    variants: {
      side: {
        start: [
          'inset-y-0 start-0 h-full w-4/5 max-w-sm border-e border-border',
          'ltr:data-[state=closed]:slide-out-to-left ltr:data-[state=open]:slide-in-from-left',
          'rtl:data-[state=closed]:slide-out-to-right rtl:data-[state=open]:slide-in-from-right',
        ],
        end: [
          'inset-y-0 end-0 h-full w-4/5 max-w-sm border-s border-border',
          'ltr:data-[state=closed]:slide-out-to-right ltr:data-[state=open]:slide-in-from-right',
          'rtl:data-[state=closed]:slide-out-to-left rtl:data-[state=open]:slide-in-from-left',
        ],
        bottom: [
          'inset-x-0 bottom-0 max-h-[85dvh] overflow-y-auto rounded-t-panel border-t border-border pb-[max(1.5rem,env(safe-area-inset-bottom))]',
          'data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom',
        ],
      },
    },
    defaultVariants: { side: 'end' },
  },
);

export interface SheetContentProps
  extends ComponentProps<typeof SheetPrimitive.Content>, VariantProps<typeof sheetVariants> {
  closeLabel?: string;
}

/** Panneau latéral ou tiroir bas ; `start`/`end` suivent le sens de lecture (RTL inclus). */
export function SheetContent({
  side,
  className,
  children,
  closeLabel,
  ...props
}: SheetContentProps) {
  return (
    <SheetPrimitive.Portal>
      <SheetPrimitive.Overlay className={overlayClassName} />
      <SheetPrimitive.Content className={cn(sheetVariants({ side }), className)} {...props}>
        {children}
        {closeLabel !== undefined && (
          <SheetPrimitive.Close
            className="absolute end-4 top-4 flex size-9 items-center justify-center rounded-control text-muted-foreground transition-colors hover:bg-surface-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label={closeLabel}
          >
            <X className="size-4" aria-hidden="true" />
          </SheetPrimitive.Close>
        )}
      </SheetPrimitive.Content>
    </SheetPrimitive.Portal>
  );
}

export function SheetHeader({ className, ...props }: ComponentProps<'div'>) {
  return <div className={cn('grid gap-1.5 pe-8 text-start', className)} {...props} />;
}

export function SheetTitle({ className, ...props }: ComponentProps<typeof SheetPrimitive.Title>) {
  return (
    <SheetPrimitive.Title
      className={cn('font-heading text-lg font-semibold', className)}
      {...props}
    />
  );
}

export function SheetDescription({
  className,
  ...props
}: ComponentProps<typeof SheetPrimitive.Description>) {
  return (
    <SheetPrimitive.Description
      className={cn('text-sm text-muted-foreground', className)}
      {...props}
    />
  );
}
