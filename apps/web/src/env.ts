import { z } from 'zod';

const serverEnvSchema = z.object({
  APP_NAME: z.string().min(1).default('DriveTN'),
  APP_DOMAIN: z.string().min(1).default('localhost'),
  API_INTERNAL_URL: z.url().default('http://localhost:4000'),
  /** Expose la vitrine du design system (`/design`) ; à désactiver en production. */
  DESIGN_PAGE_ENABLED: z.stringbool().default(false),
  /** Affiche les comptes de démo sous les formulaires de connexion ; jamais en production. */
  DEMO_ACCOUNTS_ENABLED: z.stringbool().default(false),
  /** Clé de site reCAPTCHA v3. Vide : aucune vérification n'est lancée. */
  RECAPTCHA_SITE_KEY: z.string().default(''),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

let cachedEnv: ServerEnv | undefined;

/** Lu à l'exécution (et non au build) pour que la même image serve tous les environnements. */
export function getServerEnv(): ServerEnv {
  if (cachedEnv === undefined) {
    const result = serverEnvSchema.safeParse(process.env);
    if (!result.success) {
      throw new Error(`Configuration invalide :\n${z.prettifyError(result.error)}`);
    }
    cachedEnv = result.data;
  }
  return cachedEnv;
}
