import { fontUrls } from '@attentionawareness/ui/fonts';
import { Tooltip } from '@base-ui/react/tooltip';
import { PostHogProvider } from '@posthog/react';
import { createRootRoute, HeadContent, Outlet, Scripts } from '@tanstack/react-router';
import type { ReactNode } from 'react';
import { NotFound } from '../components/not-found.tsx';
import { SiteHeader } from '../components/site-header.tsx';
import { SupportPopup } from '../components/support-popup.tsx';
import { WipBanner } from '../components/wip-banner.tsx';
import { clientEnv } from '../lib/env.ts';
import { openPanelReplay, posthogReplay } from '../lib/replay.ts';
import { THEME_GROUND, THEME_SCRIPT } from '../lib/theme.ts';
import { m } from '../paraglide/messages.js';
import fontsStylesheet from '@attentionawareness/ui/fonts-optional.css?url';
import '@attentionawareness/ui/theme.css';
import '../app.css';

if (import.meta.env.DEV && typeof window !== 'undefined') {
  // Dev-only: the knobs panel emulates scheme, motion, locale and width in place. It also
  // provides grab: hold cmd+C to pick an element and copy its context.
  const knobs = await import('devknobs');
  knobs.mount();
  // Dev-only: StyleX HMR runtime injects styles; production CSS is emitted into app.css at build.
  void import('virtual:stylex:runtime');
}

if (clientEnv.VITE_SENTRY_DSN && typeof window !== 'undefined') {
  const Sentry = await import('@sentry/tanstackstart-react');
  Sentry.init({ dsn: clientEnv.VITE_SENTRY_DSN });
}

/** The brand, in prose. The lowercase "aa" mark is the only lowercase form. */
const SITE_NAME = 'attention awareness';
/**
 * Takes the work-in-progress strip off the page before it paints, for a reader
 * who has already put it away. Same key as the strip's own button.
 */
const WIP_SCRIPT =
  "try{if(localStorage.getItem('aa-wip-dismissed'))document.documentElement.setAttribute('data-aa-wip-off','')}catch(e){}";
/**
 * Takes the support checkout's own marks off the address before anything
 * reads it: the checkout comes back with the id of the payment and a token of
 * the reader's session, and neither is for the analytics or for a link the
 * reader shares. `thanks` stays, for the home page to answer.
 */
const CHECKOUT_SCRIPT =
  "try{var u=new URL(location.href),p=u.searchParams;if(p.has('checkout_id')||p.has('customer_session_token')){" +
  "p.delete('checkout_id');p.delete('customer_session_token');history.replaceState(history.state,'',u.pathname+u.search+u.hash)}}catch(e){}";
const SITE_URL = 'https://attentionawareness.com';
const ICON_SUFFIX = import.meta.env.DEV ? '-dev' : '';
/** The site's own OpenPanel project. The id is public by design. */
const ANALYTICS_CLIENT_ID = '7969381f-4a54-484b-abe4-79148bce2206';
/**
 * Loads the analytics through the site's own proxy. Page views, no link or
 * attribute tracking, and nothing at all from an automated browser.
 * Session replay records one visit in ten, every input masked and nothing
 * a visitor chose recorded (`../lib/replay.ts`).
 */
const ANALYTICS_SCRIPT =
  'if(!navigator.webdriver){window.op=window.op||function(){(window.op.q=window.op.q||[]).push(arguments)};' +
  `window.op('init',{clientId:'${ANALYTICS_CLIENT_ID}',apiUrl:'/op',trackScreenViews:true,trackOutgoingLinks:false,trackAttributes:false,` +
  `sessionReplay:${JSON.stringify(openPanelReplay)}});` +
  "var s=document.createElement('script');s.src='/op/op1.js';s.async=true;document.head.appendChild(s)}";
const OG_IMAGE = `${SITE_URL}/og.png`;

export const Route = createRootRoute({
  component: RootComponent,
  head: ({ match, matches }) => {
    // The address a page is known by: the site's own host and the path of the
    // deepest match, which is the page itself. A path no route answers is
    // marked on the root match and has no address of its own. An index route
    // under a path names itself with a closing slash (`/blog/`), which the
    // address does not have. Cut by hand: a lookbehind in a pattern stops
    // the whole script from parsing in Safari before 16.4.
    const named = matches.at(-1)?.pathname ?? '/';
    const path = named.length > 1 && named.endsWith('/') ? named.slice(0, -1) : named;
    const url = match._notFound ? undefined : `${SITE_URL}${path}`;
    // What the site promises, in the hero's own words. The share cards lead with it.
    const tagline = m.home_hero_title({ permanently: m.home_hero_title_accent() });
    const description = `${SITE_NAME}. ${m.home_meta_description()}`;
    return {
      links: [
        // The SVG first: it inverts with the browser's own theme. The PNG is
        // there for Safari, which takes the first icon it understands.
        // The dev build wears a blue mark, so a dev tab is never taken for the site.
        { href: `/favicon${ICON_SUFFIX}.svg`, rel: 'icon', type: 'image/svg+xml' },
        { href: `/favicon${ICON_SUFFIX}.png`, rel: 'icon', sizes: '32x32', type: 'image/png' },
        { href: `/apple-touch-icon${ICON_SUFFIX}.png`, rel: 'apple-touch-icon' },
        // The fonts load with the document instead of after the stylesheet
        // asks for them, so they are in by the first paint, which
        // `font-display: optional` needs to use them at all.
        // Fonts are fetched in CORS mode, so the preload has to be as well
        // or the stylesheet cannot reuse it.
        // The @font-face rules are linked rather than imported: in dev an
        // imported stylesheet is applied a second time around hydration, and
        // the second copy's faces, new after the first paint, would draw the
        // rest of the visit in the fallback. `precedence` for the same reason
        // as the dev StyleX link below.
        { href: fontsStylesheet, precedence: 'default', rel: 'stylesheet' },
        ...fontUrls.map((href) => ({
          as: 'font',
          crossOrigin: 'anonymous' as const,
          href,
          rel: 'preload',
          type: 'font/woff2',
        })),
        // Every page names its own address, so a query string or a trailing
        // slash is never indexed as a page of its own.
        ...(url ? [{ href: url, rel: 'canonical' }] : []),
        // Dev-only: link the unplugin's compiled CSS so SSR HTML is styled on
        // first paint (the virtual:stylex:runtime import only injects after
        // hydration: without this link every refresh flashes unstyled).
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
        // A path no route answers is marked on the root match, and the tab says so.
        { title: match._notFound ? `${m.not_found_head_title()} · ${SITE_NAME}` : SITE_NAME },
        { content: description, name: 'description' },
        { content: SITE_NAME, property: 'og:site_name' },
        { content: tagline, property: 'og:title' },
        { content: description, property: 'og:description' },
        { content: 'website', property: 'og:type' },
        { content: url ?? SITE_URL, property: 'og:url' },
        { content: OG_IMAGE, property: 'og:image' },
        { content: 'summary_large_image', name: 'twitter:card' },
        { content: OG_IMAGE, name: 'twitter:image' },
      ],
    };
  },
  notFoundComponent: NotFound,
});

function RootComponent() {
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
  if (!clientEnv.VITE_POSTHOG_KEY || !clientEnv.VITE_POSTHOG_HOST) {
    return tips;
  }
  return (
    <PostHogProvider
      apiKey={clientEnv.VITE_POSTHOG_KEY}
      options={{
        api_host: clientEnv.VITE_POSTHOG_HOST,
        capture_exceptions: {
          capture_console_errors: false,
          capture_unhandled_errors: true,
          capture_unhandled_rejections: true,
        },
        capture_heatmaps: true,
        defaults: '2026-05-30',
        logs: {
          environment: import.meta.env.MODE,
          serviceName: 'attentionawareness-web',
        },
        // /build shows the apps and sites a visitor blocks; autocapture keeps
        // no text or attributes anywhere, and replay masks the marked parts.
        mask_all_element_attributes: true,
        mask_all_text: true,
        session_recording: posthogReplay,
        // The project lives in PostHog EU; api_host may be our own proxy domain.
        ui_host: 'https://eu.posthog.com',
      }}
    >
      {tips}
    </PostHogProvider>
  );
}

function RootDocument({ children }: { children: ReactNode }) {
  return (
    // The theme's script and the strip's mark the element before the page comes alive.
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
        {/* The page's ground, for the browser's own chrome and what it shows
        behind the page: one per system theme, written here because the head's
        list keeps one meta per name. A theme chosen on the site rewrites both
        (`lib/theme.ts`), and the script under them does it for a kept choice. */}
        <meta
          content={THEME_GROUND.light}
          media="(prefers-color-scheme: light)"
          name="theme-color"
          suppressHydrationWarning
        />
        <meta
          content={THEME_GROUND.dark}
          media="(prefers-color-scheme: dark)"
          name="theme-color"
          suppressHydrationWarning
        />
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
        <script dangerouslySetInnerHTML={{ __html: WIP_SCRIPT }} />
        <script dangerouslySetInnerHTML={{ __html: CHECKOUT_SCRIPT }} />
        <script dangerouslySetInnerHTML={{ __html: ANALYTICS_SCRIPT }} />
      </head>
      <body>
        <Providers>
          <WipBanner />
          <SiteHeader />
          {children}
          <SupportPopup />
        </Providers>
        <Scripts />
      </body>
    </html>
  );
}
