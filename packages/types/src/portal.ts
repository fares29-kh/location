import { z } from 'zod';

export const PORTALS = ['client', 'agency', 'admin'] as const;

export const portalSchema = z.enum(PORTALS);

export type Portal = z.infer<typeof portalSchema>;
