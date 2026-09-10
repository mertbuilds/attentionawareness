import { z } from 'zod';

const serverSchema = z.object({
  API_PORT: z.coerce.number().int().positive().default(3001),
  // Injected by portless when the api runs behind the local HTTPS proxy; wins over API_PORT.
  AXIOM_DATASET: z.string().min(1).optional(),
  AXIOM_TOKEN: z.string().min(1).optional(),
  BETTER_AUTH_SECRET: z.string().min(1).optional(),
  BETTER_AUTH_URL: z.url().optional(),
  DATABASE_URL: z.url(),
  GOOGLE_CLIENT_ID: z.string().min(1).optional(),
  GOOGLE_CLIENT_SECRET: z.string().min(1).optional(),
  GOOGLE_ISSUER_BASE: z.url().optional(),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().optional(),
  POSTHOG_KEY: z.string().min(1).optional(),
  RESEND_API_BASE: z.url().optional(),
  RESEND_API_KEY: z.string().min(1).optional(),
  SENTRY_DSN: z.url().optional(),
  STRIPE_API_BASE: z.url().optional(),
  STRIPE_PRICE_PRO_MONTHLY: z.string().min(1).optional(),
  STRIPE_SECRET_KEY: z.string().min(1).optional(),
  STRIPE_WEBHOOK_SECRET: z.string().min(1).optional(),
  WEB_URL: z.url().optional(),
});

export type ServerEnv = z.infer<typeof serverSchema>;

export function parseServerEnv(
  source: Record<string, string | undefined> = process.env,
): ServerEnv {
  const result = serverSchema.safeParse(source);
  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(`Invalid server environment:\n${issues}`);
  }
  return result.data;
}
