import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Fusionne des classes Tailwind en résolvant les conflits (ex. px-2 puis px-4). */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
