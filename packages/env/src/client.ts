// The mini build: this runs on every page, and the full one adds about 20 KB gzip to each.
import { z } from 'zod/mini';

const clientSchema = z.object({
  VITE_POSTHOG_HOST: z.optional(z.url()),
  VITE_POSTHOG_KEY: z.optional(z.string().check(z.minLength(1))),
  VITE_SENTRY_DSN: z.optional(z.url()),
});

export type ClientEnv = z.infer<typeof clientSchema>;

export function parseClientEnv(source: Record<string, string | undefined>): ClientEnv {
  // An empty value counts as unset: CI passes a repository variable that is not
  // configured as '', and Vite bakes that into the bundle.
  const set = Object.fromEntries(Object.entries(source).filter(([, value]) => value !== ''));
  const result = clientSchema.safeParse(set);
  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(`Invalid client environment:\n${issues}`);
  }
  return result.data;
}
