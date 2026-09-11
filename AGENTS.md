# attentionawareness

Opinionated monorepo boilerplate. Every product starts as a copy of this repo. Keep it minimal: nothing gets added until a product needs it.

## Architecture

```
apps/
  web/    TanStack Start (React 19, React Compiler) → Cloudflare Workers.
          Mostly client-only: SSR, routes, PostHog, Sentry, Paraglide i18n.
          No auth, no database. Server routes: the PostHog ingest proxy and
          `/api/sign`, which signs the profile with the Developer ID key.
packages/
  ui/     StyleX tokens + Base UI wrappers + Storybook. Black/white, 4px radius, Suisse Intl.
  env/    Zod-validated client env schema. All env access goes through here.
  config/ Shared tsconfig base.
cli/      `supervise`, standard-library Python, outside the pnpm workspace (pytest in cli/tests).
e2e/      Playwright smoke spec.
```

## Commands

| Command             | What                                                               |
| ------------------- | ------------------------------------------------------------------ |
| `pnpm dev`          | Web + storybook via mprocs                                         |
| `pnpm lint`         | oxlint, type-aware + TS compiler errors (tsgolint)                 |
| `pnpm format`       | oxfmt (write mode); `pnpm format:check` in CI                      |
| `pnpm typecheck`    | `tsc --noEmit` per package via turbo                               |
| `pnpm test`         | Vitest per package via turbo                                       |
| `pnpm build`        | turbo build                                                        |
| `pnpm bad-day`      | Nuke node_modules + all caches, reinstall (`DRY_RUN=1` to preview) |
| `pnpm rename`       | Rename the template to your product (`pnpm rename acme-app`)       |
| `pnpm skills:check` | Verify installed agent skills match dep majors                     |

Web app (`apps/web`): `pnpm --filter @attentionawareness/web dev` (:3000 standalone, or portless-assigned `PORT` under `pnpm dev`), `build` (Workers bundle), `deploy` (build + `wrangler deploy`), `cf-typegen` (binding types).

## Local URLs (portless)

`pnpm dev` serves the HTTP apps behind [portless](https://portless.sh) — stable named HTTPS URLs instead of ports:

| Service   | URL                                            | Without portless |
| --------- | ---------------------------------------------- | ---------------- |
| web       | https://attentionawareness.localhost           | :3000            |
| storybook | https://storybook.attentionawareness.localhost | :6006            |

- First run needs one-time setup in a terminal: `sudo pnpm exec portless proxy start --https` (binds 443, generates + trusts a local CA). After that the proxy auto-starts. `pnpm exec portless service install` makes it start on boot.
- portless injects `PORT` (4000-4999 pool) into each app; vite reads it in `vite.config.ts`, storybook takes it as `--port`. If TLS is in the way, `--no-tls` on portless or curl `-k`.
- e2e stays port-based (CI has no portless proxy).

## UI (`packages/ui`)

- Components come from the [shadcn-cssinjs](https://www.shadcn-cssinjs.com) registry (StyleX on Base UI, copy-paste-own) into `src/ui/`, then adapted to this repo. The shadcn CLI currently fails on this registry's cross-registry deps — fetch item JSON from `https://www.shadcn-cssinjs.com/r/<name>.json` and write the files (see the `shadcn-cssinjs` skill for the exact adaptation checklist: relative imports, named stylex imports, `| undefined` on optional props for exactOptionalPropertyTypes).
- Two token layers, both ours: `src/lib/tokens.stylex.ts` (component tokens — shadcn CSS variables from `src/theme.css`, grayscale, `--radius: 4px`, dark via `prefers-color-scheme`) and `src/tokens.stylex.ts` (app-level layout: `spacing`, `font`, raw `palette`). Components use the lib tokens; app layout uses the app tokens. Never raw color values.
- One radius (4px — the lib radius scale is pinned to it). Black and white plus grays. Font stack `'Suisse Intl', 'Inter Variable', system-ui` — Suisse woff2 files are licensed, gitignored, fetched with `pnpm fonts` (`FONT_BUCKET_URL`); without them Inter Variable is the visual fallback. Components inherit the font from the app body; they set none themselves.
- Current set: Button, Input, Field (label/error composition), Dialog, Select, Table, Label, Separator, Skeleton, Toaster (sonner, next-themes dropped). Grow on demand from the registry.
- A story is the test: every component has colocated `*.stories.tsx` with `play` interaction tests. `pnpm --filter @attentionawareness/ui test` runs them in real Chromium via the Storybook Vitest addon (Vitest browser mode). `pnpm storybook` serves them on :6006.

## Web (`apps/web`)

- TanStack Start on Cloudflare Workers. Custom entry `src/server.ts` (wrangler `main`) wraps the Start handler with `paraglideMiddleware` and an evlog wide event per request (Axiom drain when `AXIOM_TOKEN`+`AXIOM_DATASET` set); wrangler `observability` stays disabled so logs are not duplicated.
- React Compiler is on (`react({ compiler: true })` via `oxc-transform-react`). react-grab loads in dev only.
- i18n: Paraglide v2, `messages/en.json` + `messages/tr.json` (a unit test enforces key parity). Generated `src/paraglide/` and `src/routeTree.gen.ts` are gitignored build output — never edit them, they regenerate on `vite dev`/`build`. All user-facing strings go through `m.*()`.
- Analytics: PostHog only when `VITE_POSTHOG_KEY` is set — provider in `__root.tsx` (defaults `2026-05-30`, heatmaps on, inputs masked), ingest reverse-proxied through the `/ingest/$` server route to PostHog EU so adblockers don't drop events.
- Sentry: client init in `__root.tsx` only when `VITE_SENTRY_DSN` is set.
- StyleX in routes: import `../app.css` (build injection target) — there is no importable `virtual:stylex.css` module; in dev the plugin middleware serves the CSS itself.

### Profile signing

- `POST /api/sign` (`src/routes/api.sign.ts`) takes the reader's config, validates it by hand, forces the identifier (`com.attentionawareness.<uuid>`), the display name and the organization, takes `lockRemoval` from the body (locked unless the reader ticks trial mode), builds the XML with `buildProfile` and returns a CMS-signed DER `.mobileconfig`. Every download is a new profile that stacks: none can loosen or replace one already installed.
- `src/lib/sign.ts` does the CMS `SignedData` with pkijs on the Worker's own WebCrypto. The browser never holds the key, and the signed download is the only way a profile leaves the page.
- Bindings `SIGNING_CERT_PEM`, `SIGNING_CHAIN_PEM`, `SIGNING_KEY_PKCS8_PEM` reach the route through `setSigningSecrets(env)` in `src/server.ts`, because a handler cannot see the Worker `env` on its own. Missing secrets answer `503` and the page says signing is unavailable, so local dev works without them. Details in `docs/signing.md`.

### i18n lint

- All user-facing strings go through Paraglide (`m.*()`). `react/jsx-no-literals` (oxlint, error) forbids hardcoded JSX text and text-bearing attributes (label/placeholder/title/alt/aria-\*); tests, stories, and scripts are exempt via overrides. `packages/ui` components take all text as props. Inline `oxlint-disable` only with a justification comment.

## Testing

Test pyramid, bottom-up — everything runs with `pnpm test` (turbo) except e2e:

- **Unit** (`*.test.ts` / `*.test.tsx`): web unit tests run in jsdom (Vitest + Testing Library) with the router mocked; the generator page, profile builder, app search, share links and message-catalog parity are covered here.
- **Component** (`packages/ui`): stories are the tests — `play` functions run in real Chromium via `@storybook/addon-vitest` (`pnpm --filter @attentionawareness/ui test`).
- **E2E** (`e2e/`): `pnpm e2e` — Playwright boots the web app (:3020) via `webServer` and runs `smoke.spec.ts`: the landing page loads, hydrates and shows the hero line. Tests wait for `html[data-hydrated]` (set by a root effect) before asserting.
- **CLI** (`cli/tests`): pytest, standard library only — `python3 -m pytest cli/tests`. Outside turbo.

Conventions: assert localized messages, never raw keys; new web logic gets a colocated unit test, new UI components get a story with a `play` test.

## Dev workflow

- `pnpm dev` runs mprocs with two panes: web and storybook. Quit with `q`; panes restart individually with `r`.
- When everything is broken for no reason: `pnpm bad-day` (kills dev processes, removes every node_modules/cache/generated dir, prunes the pnpm store, reinstalls). Preview with `DRY_RUN=1 pnpm bad-day`.
- Claude Code hooks (`.claude/settings.json`): every Write/Edit is auto-formatted (oxfmt) and auto-fixed (oxlint) on save; a Stop hook runs `pnpm typecheck` and blocks the stop if types are broken.
- Agent skills for the stack live in `.claude/skills/` (committed, pinned by `skills-lock.json`). Maintenance: `npx skills update` refreshes them; `pnpm skills:check` warns when a dep's installed major drifts from what its skill was last verified against (`skills.versions.json`) — after a major dep bump, update the skill, re-verify, bump `checkedMajor`. MCP servers are pinned by exact version in `.mcp.json`.
- Renovate bumps deps (minor/patch grouped weekly, majors gated behind the dependency dashboard).

## CI/CD

- **CI** (`.github/workflows/ci.yml`, PRs + main): `checks` job = turbo lint/typecheck/build + `format:check` + `skills:check` + react-doctor (warnings shown, errors fail); `test` job = full `pnpm test` (Chromium story tests); `e2e` job = `pnpm e2e`. Turbo remote cache activates when `TURBO_TOKEN`/`TURBO_TEAM` are configured.
- **Deploy** (`deploy.yml`, push to main): web builds and deploys to Cloudflare Workers via wrangler-action (+ optional Sentry sourcemaps).
- **Previews** (`preview.yml`): every PR uploads a Workers preview version and comments the URL.
- Required repo config lives in README's "Going to production" checklist. CI must be green before merge; cubic reviews every PR.

## Rules

- Never edit generated directories: `apps/web/src/paraglide/`, `apps/web/src/routeTree.gen.ts`.
- The site stays client-first: no auth, no database, no billing. Server code is the exception, not the pattern: today the PostHog ingest proxy and the profile signer, which exists only because the signing key must never reach the browser.
- No new dependencies, components, or abstractions without a concrete current need.
- Secrets never enter git. Local uses `.env` (from `.env.example`) and, for Worker bindings, `apps/web/.dev.vars` (from `.dev.vars.example`); prod uses `wrangler secret put`. The signing certificate and its private key (`SIGNING_CERT_PEM`, `SIGNING_CHAIN_PEM`, `SIGNING_KEY_PKCS8_PEM`) live there and nowhere else.
- Conventional commits, enforced by commitlint. PRs only against `main`; CI must be green.
- Stack decisions are recorded in `docs/adr/`. Change of direction = new ADR.
