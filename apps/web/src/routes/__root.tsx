import { PostHogProvider } from '@posthog/react';
import { createRootRoute, HeadContent, Outlet, Scripts } from '@tanstack/react-router';
import { useEffect, type ReactNode } from 'react';
import { Preferences } from '../components/preferences.tsx';
import { clientEnv } from '../lib/env.ts';
import { themeScript } from '../lib/theme.ts';
import { getLocale } from '../paraglide/runtime.js';
import '@keepyourattention/ui/fonts.css';
import '@keepyourattention/ui/theme.css';
import '../app.css';

if (import.meta.env.DEV && typeof window !== 'undefined') {
  void import('react-grab');
  // Dev-only: StyleX HMR runtime injects styles; production CSS is emitted into app.css at build.
  void import('virtual:stylex:runtime');
}

if (clientEnv.VITE_SENTRY_DSN && typeof window !== 'undefined') {
  const Sentry = await import('@sentry/tanstackstart-react');
  Sentry.init({ dsn: clientEnv.VITE_SENTRY_DSN });
}

export const Route = createRootRoute({
  component: RootComponent,
  head: () => ({
    // Dev-only: link the unplugin's compiled CSS so SSR HTML is styled on first
    // paint (the virtual:stylex:runtime import only injects after hydration —
    // without this link every refresh flashes unstyled). Production CSS is
    // emitted into app.css at build, so the link is dev-only.
    // `precedence` is required: React 19 hoists SSR stylesheets with
    // data-precedence, and a client link without the prop hydration-mismatches
    // (which silently breaks event wiring on the whole tree).
    // `precedence` is required: React 19 hoists SSR stylesheets with
    // data-precedence, and a client link without the prop hydration-mismatches.
    links: import.meta.env.DEV
      ? [{ href: '/virtual:stylex.css', precedence: 'default', rel: 'stylesheet' }]
      : [],
    meta: [
      // oxlint-disable-next-line text-encoding-identifier-case -- HTML meta charset must be "utf-8"
      { charSet: 'utf-8' },
      { content: 'width=device-width, initial-scale=1', name: 'viewport' },
      { title: 'keepyourattention' },
    ],
    // Head scripts run before the first paint, which is the whole point of this
    // one: it stamps `data-theme` from localStorage so a forced light/dark
    // never flashes the other one.
    scripts: [{ children: themeScript }],
  }),
});

function RootComponent() {
  // Marks hydration completion; forms rely on React handlers (preventDefault),
  // so e2e tests wait for html[data-hydrated] before interacting.
  useEffect(() => {
    document.documentElement.dataset['hydrated'] = 'true';
  }, []);
  return (
    <RootDocument>
      <Outlet />
      <Preferences />
    </RootDocument>
  );
}

function Providers({ children }: { children: ReactNode }) {
  if (!clientEnv.VITE_POSTHOG_KEY) {
    return children;
  }
  return (
    <PostHogProvider
      apiKey={clientEnv.VITE_POSTHOG_KEY}
      options={{
        api_host: '/ingest',
        capture_heatmaps: true,
        defaults: '2026-05-30',
        session_recording: { maskAllInputs: true },
        ui_host: 'https://eu.posthog.com',
      }}
    >
      {children}
    </PostHogProvider>
  );
}

function RootDocument({ children }: { children: ReactNode }) {
  return (
    <html lang={getLocale()}>
      <head>
        <HeadContent />
      </head>
      <body>
        <Providers>{children}</Providers>
        <Scripts />
      </body>
    </html>
  );
}
