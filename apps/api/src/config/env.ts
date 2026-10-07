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
});

export type Env = z.infer<typeof envSchema>;

export function parseEnv(source: Record<string, string | undefined>): Env {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    throw new Error(`Configuration invalide :\n${z.prettifyError(result.error)}`);
  }
  return result.data;
}
