import type { z } from 'zod';

import { ApiError, toApiError } from './errors';

const API_BASE = '/api/v1';
const REQUEST_TIMEOUT_MS = 15_000;

/** Routes qui ne doivent jamais déclencher un renouvellement de session. */
const NO_REFRESH_PREFIXES = ['/auth/login', '/auth/refresh', '/auth/logout', '/auth/handoff'];

export interface ApiRequestOptions<T extends z.ZodType> {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  /** Sérialisé en JSON, sauf un `FormData` envoyé tel quel (multipart). */
  body?: unknown;
  /** Schéma de la réponse ; omis pour une réponse vide (204). */
  schema?: T;
  signal?: AbortSignal;
  timeoutMs?: number;
}

let refreshInFlight: Promise<boolean> | null = null;

/** Un seul renouvellement à la fois : les requêtes parallèles attendent le même résultat. */
function refreshSession(): Promise<boolean> {
  refreshInFlight ??= fetch(`${API_BASE}/auth/refresh`, {
    method: 'POST',
    credentials: 'same-origin',
  })
    .then((response) => response.ok)
    .catch(() => false)
    .finally(() => {
      refreshInFlight = null;
    });
  return refreshInFlight;
}

async function send(path: string, options: ApiRequestOptions<z.ZodType>): Promise<Response> {
  const signal = options.signal ?? AbortSignal.timeout(options.timeoutMs ?? REQUEST_TIMEOUT_MS);
  const { body } = options;
  const json = body !== undefined && !(body instanceof FormData);
  try {
    return await fetch(`${API_BASE}${path}`, {
      method: options.method ?? 'GET',
      credentials: 'same-origin',
      headers: json ? { 'Content-Type': 'application/json' } : undefined,
      body: body instanceof FormData ? body : json ? JSON.stringify(body) : undefined,
      signal,
    });
  } catch {
    throw new ApiError(0, 'NETWORK_ERROR', 'Network error');
  }
}

/**
 * Appel de l'API depuis le navigateur (même origine, cookies httpOnly). Sur une réponse 401,
 * la session est renouvelée une fois puis la requête est rejouée.
 */
export async function apiFetch<T extends z.ZodType>(
  path: string,
  options: ApiRequestOptions<T> & { schema: T },
): Promise<z.output<T>>;
export async function apiFetch(path: string, options?: ApiRequestOptions<z.ZodType>): Promise<void>;
export async function apiFetch(
  path: string,
  options: ApiRequestOptions<z.ZodType> = {},
): Promise<unknown> {
  let response = await send(path, options);
  const canRefresh = !NO_REFRESH_PREFIXES.some((prefix) => path.startsWith(prefix));
  if (response.status === 401 && canRefresh && (await refreshSession())) {
    response = await send(path, options);
  }
  if (!response.ok) {
    throw await toApiError(response);
  }
  if (options.schema === undefined) {
    return undefined;
  }
  return options.schema.parse(await response.json());
}
