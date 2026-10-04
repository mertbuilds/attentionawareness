import { z } from 'zod';

const clientSchema = z.object({
  VITE_POSTHOG_HOST: z.url().optional(),
  VITE_POSTHOG_KEY: z.string().min(1).optional(),
  VITE_SENTRY_DSN: z.url().optional(),
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
