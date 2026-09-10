import { z } from 'zod';

const clientSchema = z.object({
  VITE_API_URL: z.url(),
  VITE_POSTHOG_KEY: z.string().min(1).optional(),
  VITE_SENTRY_DSN: z.url().optional(),
});

export type ClientEnv = z.infer<typeof clientSchema>;

export function parseClientEnv(source: Record<string, string | undefined>): ClientEnv {
  const result = clientSchema.safeParse(source);
  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(`Invalid client environment:\n${issues}`);
  }
  return result.data;
}
