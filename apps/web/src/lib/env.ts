import { parseClientEnv } from '@attentionawareness/env/client';

export const clientEnv = parseClientEnv({
  VITE_OPEN_DASHBOARD_URL: import.meta.env['VITE_OPEN_DASHBOARD_URL'] as string | undefined,
  VITE_POSTHOG_HOST: import.meta.env['VITE_POSTHOG_HOST'] as string | undefined,
  VITE_POSTHOG_KEY: import.meta.env['VITE_POSTHOG_KEY'] as string | undefined,
  VITE_SENTRY_DSN: import.meta.env['VITE_SENTRY_DSN'] as string | undefined,
});
