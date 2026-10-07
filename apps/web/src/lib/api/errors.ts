import { type ErrorCode, errorResponseSchema } from '@drivetn/types';
import { z } from 'zod';

const validationIssuesSchema = z.array(z.object({ path: z.string(), message: z.string() }));

export type ValidationIssue = z.infer<typeof validationIssuesSchema>[number];

/** Erreur normalisée de l'API (`{ code, message, details }`), ou erreur réseau. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: ErrorCode | 'NETWORK_ERROR',
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }

  /** Problèmes de validation par champ (codes traduisibles), si l'API en renvoie. */
  get validationIssues(): ValidationIssue[] {
    const result = validationIssuesSchema.safeParse(this.details);
    return result.success ? result.data : [];
  }

  /** Valeur numérique dans `details` (ex. `retryAfterSeconds`, `attemptsLeft`). */
  detailNumber(key: string): number | undefined {
    if (typeof this.details !== 'object' || this.details === null) {
      return undefined;
    }
    const value = (this.details as Record<string, unknown>)[key];
    return typeof value === 'number' ? value : undefined;
  }

  detailString(key: string): string | undefined {
    if (typeof this.details !== 'object' || this.details === null) {
      return undefined;
    }
    const value = (this.details as Record<string, unknown>)[key];
    return typeof value === 'string' ? value : undefined;
  }
}

export async function toApiError(response: Response): Promise<ApiError> {
  try {
    const body = errorResponseSchema.parse(await response.json());
    return new ApiError(response.status, body.code, body.message, body.details);
  } catch {
    return new ApiError(response.status, 'INTERNAL_ERROR', response.statusText);
  }
}
