import { parseClientEnv } from '@web-starter/env/client';

export const clientEnv = parseClientEnv({
  VITE_API_URL: import.meta.env['VITE_API_URL'] as string | undefined,
  VITE_POSTHOG_KEY: import.meta.env['VITE_POSTHOG_KEY'] as string | undefined,
  VITE_SENTRY_DSN: import.meta.env['VITE_SENTRY_DSN'] as string | undefined,
});
