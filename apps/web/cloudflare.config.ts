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
      // Profile signing (docs/signing.md). The v2 Vite plugin binds only declared
      // names, and `cf deploy` fails until each declared secret is set.
      SIGNING_CERT_PEM: bindings.secret(),
      SIGNING_CHAIN_PEM: bindings.secret(),
      SIGNING_KEY_PKCS8_PEM: bindings.secret(),
    },
    name: 'attentionawareness-web',
    // evlog ships logs itself; Workers observability would duplicate them.
    observability: {
      enabled: false,
    },
  },
});
