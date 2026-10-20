import { z } from 'zod';

const booleanString = z
  .enum(['true', 'false'])
  .default('false')
  .transform((value) => value === 'true');

const commaSeparatedList = z
  .string()
  .default('')
  .transform((value) =>
    value
      .split(',')
      .map((item) => item.trim())
      .filter((item) => item.length > 0),
  );

const secret = z.string().min(32, { message: 'Au moins 32 caractères' });

export const MESSAGING_PROVIDERS = ['console'] as const;

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  APP_NAME: z.string().min(1).default('DriveTN'),
  APP_DOMAIN: z.string().min(1).default('localhost'),
  APP_TIMEZONE: z.string().min(1).default('Africa/Tunis'),
  DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
  REDIS_URL: z.url({ protocol: /^rediss?$/ }),
  CORS_ORIGINS: commaSeparatedList,
  SWAGGER_ENABLED: booleanString,
  JWT_ACCESS_SECRET: secret,
  /** Clé HMAC des codes OTP stockés en base. */
  OTP_HASH_SECRET: secret,
  ACCESS_TOKEN_TTL_SECONDS: z.coerce.number().int().min(60).max(3600).default(900),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().min(1).max(90).default(30),
  /** Cookies `Secure` : à activer dès que la plateforme est servie en HTTPS. */
  COOKIE_SECURE: booleanString,
  MESSAGING_PROVIDER: z.enum(MESSAGING_PROVIDERS).default('console'),
  SEED_DEMO_ACCOUNTS: booleanString,
  /** Stockage S3 (MinIO en local, Object Storage Hetzner). Sans point d'accès, voir Azure. */
  S3_ENDPOINT: z.url({ protocol: /^https?$/ }).optional(),
  S3_REGION: z.string().min(1).default('us-east-1'),
  S3_ACCESS_KEY_ID: z.string().default(''),
  S3_SECRET_ACCESS_KEY: z.string().default(''),
  S3_BUCKET_PUBLIC: z.string().min(3).default('drivetn-public'),
  /** Compte du stockage photos Azure. Vide : on reste sur S3. */
  AZURE_STORAGE_ACCOUNT: z.string().default(''),
  AZURE_STORAGE_ACCESS_KEY: z.string().default(''),
  AZURE_STORAGE_CONTAINER: z.string().default(''),
  /** URL publique du bucket public (relative : servie par Traefik sur le même domaine). */
  MEDIA_PUBLIC_URL: z
    .string()
    .min(1)
    .default('/media')
    .transform((value) => value.replace(/\/+$/, '')),
});

export type Env = z.infer<typeof envSchema>;

export function parseEnv(source: Record<string, string | undefined>): Env {
  const normalized = { ...source };
  if (normalized.S3_ENDPOINT === '') {
    delete normalized.S3_ENDPOINT;
  }
  const result = envSchema.safeParse(normalized);
  if (!result.success) {
    throw new Error(`Configuration invalide :\n${z.prettifyError(result.error)}`);
  }
  const env = result.data;
  if (
    env.AZURE_STORAGE_ACCOUNT !== '' &&
    (env.AZURE_STORAGE_ACCESS_KEY === '' || env.AZURE_STORAGE_CONTAINER.length < 3)
  ) {
    throw new Error(
      'Configuration invalide :\nAZURE_STORAGE_ACCESS_KEY et AZURE_STORAGE_CONTAINER sont requis avec AZURE_STORAGE_ACCOUNT',
    );
  }
  return env;
}
