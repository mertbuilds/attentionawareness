import { Tooltip } from '@base-ui/react/tooltip';
import { PostHogProvider } from '@posthog/react';
import { createRootRoute, HeadContent, Outlet, Scripts } from '@tanstack/react-router';
import { useEffect, type ReactNode } from 'react';
import { SiteBrand } from '../components/site-brand.tsx';
import { clientEnv } from '../lib/env.ts';
import { getLocale } from '../paraglide/runtime.js';
import '@attentionawareness/ui/fonts.css';
import '@attentionawareness/ui/theme.css';
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

/** The brand, in prose. The lowercase "aa" mark is the only lowercase form. */
const SITE_NAME = 'attention awareness';
const SITE_URL = 'https://attentionawareness.com';
const OG_IMAGE = `${SITE_URL}/og.png`;
/** What the site promises, in one line. The share cards lead with it. */
const TAGLINE = 'The website that gives you 5 years of your life back';
const DESCRIPTION = `${SITE_NAME}. ${TAGLINE}. See your number, then take the feeds off your iPhone for good, free and open.`;

export const Route = createRootRoute({
  component: RootComponent,
  head: () => ({
    links: [
      // The SVG first: it inverts with the browser's own theme. The PNG is
      // there for Safari, which takes the first icon it understands.
      { href: '/favicon.svg', rel: 'icon', type: 'image/svg+xml' },
      { href: '/favicon.png', rel: 'icon', sizes: '32x32', type: 'image/png' },
      { href: '/apple-touch-icon.png', rel: 'apple-touch-icon' },
      // Dev-only: link the unplugin's compiled CSS so SSR HTML is styled on
      // first paint (the virtual:stylex:runtime import only injects after
      // hydration — without this link every refresh flashes unstyled).
      // Production CSS is emitted into app.css at build, so the link is
      // dev-only. `precedence` is required: React 19 hoists SSR stylesheets
      // with data-precedence, and a client link without the prop
      // hydration-mismatches (which silently breaks event wiring on the whole
      // tree).
      ...(import.meta.env.DEV
        ? [{ href: '/virtual:stylex.css', precedence: 'default', rel: 'stylesheet' }]
        : []),
    ],
    meta: [
      // oxlint-disable-next-line text-encoding-identifier-case -- HTML meta charset must be "utf-8"
      { charSet: 'utf-8' },
      { content: 'width=device-width, initial-scale=1', name: 'viewport' },
      { title: SITE_NAME },
      { content: DESCRIPTION, name: 'description' },
      { content: SITE_NAME, property: 'og:site_name' },
      { content: TAGLINE, property: 'og:title' },
      { content: DESCRIPTION, property: 'og:description' },
      { content: 'website', property: 'og:type' },
      { content: SITE_URL, property: 'og:url' },
      { content: OG_IMAGE, property: 'og:image' },
      { content: 'summary_large_image', name: 'twitter:card' },
      { content: OG_IMAGE, name: 'twitter:image' },
    ],
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
    </RootDocument>
  );
}

function Providers({ children }: { children: ReactNode }) {
  // Every tooltip on the site opens after the same short pause and closes
  // without one, so a pointer hopping between tips never waits twice.
  const tips = (
    <Tooltip.Provider closeDelay={0} delay={150}>
      {children}
    </Tooltip.Provider>
  );
  if (!clientEnv.VITE_POSTHOG_KEY) {
    return tips;
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
      {tips}
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
        <Providers>
          <SiteBrand />
          {children}
        </Providers>
        <Scripts />
      </body>
    </html>
  );
}
