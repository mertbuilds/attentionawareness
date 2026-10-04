import { bindings, defineConfig } from 'cf/config';

export default defineConfig({
  worker: {
    // Static assets answer before the Worker, so a file under public/ would shadow
    // a route of the same path. These paths stay with the Worker whatever lands
    // in public/. `/mac/*` is the Mac app's files, read from R2 below.
    assets: {
      runWorkerFirst: ['/guides', '/guides/*', '/extension/*', '/mac/*'],
    },
    compatibilityDate: '2026-09-01',
    compatibilityFlags: ['nodejs_compat'],
    // The apex is the canonical host. The others are custom domains on this
    // same Worker so `canonicalRedirect` in src/server.ts can 301 them itself.
    domains: [
      'attentionawareness.com',
      'www.attentionawareness.com',
      'keepyourattention.com',
      'www.keepyourattention.com',
      'dikkatfarkindaligi.com',
      'www.dikkatfarkindaligi.com',
    ],
    // Custom entry: wraps @tanstack/react-start/server-entry with paraglide + evlog.
    entrypoint: 'src/server.ts',
    env: {
      // The Mac app's files (the Sparkle feed, `latest.json`, the versioned dmgs),
      // answered by `macFileResponse` in src/lib/mac-files.ts. The key is the URL
      // path without its leading slash: /mac/appcast.xml is `mac/appcast.xml`.
      // `vite dev` reads a local simulation under .cloudflare/state instead.
      MAC_FILES: bindings.r2({ name: 'attentionawareness-mac' }),
      // A write client of the site's OpenPanel project, for the Mac download
      // and feed check events sent by src/lib/mac-analytics.ts. The browser's
      // client id has no secret we hold. Without both, nothing is sent.
      OPENPANEL_CLIENT_ID: bindings.secret(),
      OPENPANEL_CLIENT_SECRET: bindings.secret(),
      // A PostHog personal API key that can only read queries of the site's
      // project, for the numbers on /open (src/lib/open-numbers.server.ts).
      POSTHOG_PERSONAL_API_KEY: bindings.secret(),
      // Profile signing (docs/signing.md). The v2 Vite plugin binds only declared
      // names, and `cf deploy` fails until each declared secret is set.
      SIGNING_CERT_PEM: bindings.secret(),
      SIGNING_CHAIN_PEM: bindings.secret(),
      SIGNING_KEY_PKCS8_PEM: bindings.secret(),
    },
    name: 'attentionawareness-web',
    // evlog drains to Axiom only when AXIOM_TOKEN and AXIOM_DATASET are bound,
    // and they are not declared above, so in production it writes to the
    // console only. Workers observability is what keeps those logs.
    observability: {
      enabled: true,
      logs: {
        enabled: true,
        headSamplingRate: 1,
      },
    },
  },
});
