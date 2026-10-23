'use client';

import { X } from 'lucide-react';
import { Dialog as DialogPrimitive } from 'radix-ui';
import { type ComponentProps, useLayoutEffect, useRef } from 'react';

import { cn } from '../lib/cn';

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;

export const overlayClassName = cn(
  'fixed inset-0 z-[70] bg-black/50 backdrop-blur-[2px]',
  'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
);

export function DialogOverlay({
  className,
  ...props
}: ComponentProps<typeof DialogPrimitive.Overlay>) {
  return <DialogPrimitive.Overlay className={cn(overlayClassName, className)} {...props} />;
}

export interface DialogContentProps extends ComponentProps<typeof DialogPrimitive.Content> {
  /** Libellé accessible du bouton de fermeture ; le bouton n'est affiché que s'il est fourni. */
  closeLabel?: string;
}

export function DialogContent({
  className,
  children,
  closeLabel,
  onInteractOutside,
  onFocusOutside,
  ...props
}: DialogContentProps) {
  const openedAt = useRef(0);
  useLayoutEffect(() => {
    openedAt.current = performance.now();
  }, []);
  // Le clic qui ouvre la fenêtre (souvent depuis un menu) ne doit pas la refermer aussitôt.
  const keepThroughOpeningClick = (event: {
    preventDefault: () => void;
    defaultPrevented: boolean;
  }) => {
    if (performance.now() - openedAt.current < 500) {
      event.preventDefault();
    }
  };

  return (
    <DialogPrimitive.Portal>
      <DialogOverlay />
      <DialogPrimitive.Content
        onInteractOutside={(event) => {
          keepThroughOpeningClick(event);
          if (!event.defaultPrevented) {
            onInteractOutside?.(event);
          }
        }}
        onFocusOutside={(event) => {
          keepThroughOpeningClick(event);
          if (!event.defaultPrevented) {
            onFocusOutside?.(event);
          }
        }}
        className={cn(
          'fixed inset-0 z-[70] m-auto grid h-fit max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-lg gap-4 overflow-y-auto',
          'rounded-panel border border-border bg-surface p-6 text-foreground shadow-elevated',
          'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
          'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
          className,
        )}
        {...props}
      >
        {children}
        {closeLabel !== undefined && (
          <DialogPrimitive.Close
            className="absolute end-4 top-4 flex size-9 items-center justify-center rounded-control text-muted-foreground transition-colors hover:bg-surface-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label={closeLabel}
          >
            <X className="size-4" aria-hidden="true" />
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

export function DialogHeader({ className, ...props }: ComponentProps<'div'>) {
  return <div className={cn('grid gap-1.5 pe-8 text-start', className)} {...props} />;
}

export function DialogFooter({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      className={cn('flex flex-col-reverse gap-2 sm:flex-row sm:justify-end', className)}
      {...props}
    />
  );
}

export function DialogTitle({ className, ...props }: ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      className={cn('font-heading text-lg font-semibold leading-tight', className)}
      {...props}
    />
  );
}

export function DialogDescription({
  className,
  ...props
}: ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      className={cn('text-sm text-muted-foreground', className)}
      {...props}
    />
  );
}
