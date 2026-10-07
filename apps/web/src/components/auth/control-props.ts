import { fieldDescribedBy } from '@drivetn/ui/field';

/** Attributs d'accessibilité d'un contrôle enveloppé dans `Field` (id, état invalide, aide). */
export function controlProps(id: string, { error, hint }: { error?: string; hint?: string }) {
  return {
    id,
    'aria-invalid': error === undefined ? undefined : true,
    'aria-describedby': fieldDescribedBy(id, { error, hint }),
  };
}
