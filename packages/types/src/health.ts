import { z } from 'zod';

export const dependencyStatusSchema = z.enum(['up', 'down']);

export type DependencyStatus = z.infer<typeof dependencyStatusSchema>;

/**
 * `ok` : tout fonctionne.
 * `degraded` : une dépendance non critique (worker) est indisponible.
 * `error` : une dépendance critique (base de données, Redis) est indisponible.
 */
export const healthStatusSchema = z.enum(['ok', 'degraded', 'error']);

export type HealthStatus = z.infer<typeof healthStatusSchema>;

export const healthResponseSchema = z.object({
  status: healthStatusSchema,
  uptime: z.number().nonnegative(),
  timestamp: z.iso.datetime(),
  checks: z.object({
    database: dependencyStatusSchema,
    redis: dependencyStatusSchema,
    worker: dependencyStatusSchema,
  }),
});

export type HealthResponse = z.infer<typeof healthResponseSchema>;
