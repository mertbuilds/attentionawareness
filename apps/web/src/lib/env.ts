import { parseClientEnv } from '@keepyourattention/env/client';

export const clientEnv = parseClientEnv({
  VITE_POSTHOG_KEY: import.meta.env['VITE_POSTHOG_KEY'] as string | undefined,
  VITE_SENTRY_DSN: import.meta.env['VITE_SENTRY_DSN'] as string | undefined,
});
