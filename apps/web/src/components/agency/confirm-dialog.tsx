'use client';

import { Button } from '@drivetn/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@drivetn/ui/dialog';
import type { ReactNode } from 'react';

/** Confirmation d'une action difficile à annuler. Le bouton d'action nomme ce qui va se passer. */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  dismissLabel,
  closeLabel,
  pending = false,
  destructive = false,
  error,
  onOpenChange,
  onConfirm,
}: {
  open: boolean;
  title: string;
  description: ReactNode;
  confirmLabel: string;
  dismissLabel: string;
  closeLabel: string;
  pending?: boolean;
  destructive?: boolean;
  error?: string;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent closeLabel={closeLabel}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {error !== undefined && (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        )}
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="secondary" disabled={pending}>
              {dismissLabel}
            </Button>
          </DialogClose>
          <Button
            type="button"
            variant={destructive ? 'danger' : 'primary'}
            loading={pending}
            onClick={onConfirm}
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
