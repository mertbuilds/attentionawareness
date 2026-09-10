# web-starter

Opinionated monorepo boilerplate. Every product starts as a copy of this repo. Keep it minimal: nothing gets added until a product needs it.

## Architecture

```
apps/
  web/    TanStack Start (React 19, React Compiler) → Cloudflare Workers.
          Thin: SSR, routes, oRPC client, PostHog, Sentry, Paraglide i18n.
          NEVER touches the database.
  api/    Fastify + oRPC + Better Auth + Prisma + Stripe → Docker on Hetzner (Dokploy).
          Serves /rpc (oRPC), /api/* (OpenAPI), /docs (Scalar), /api/auth/* (Better Auth), /health.
packages/
  db/     Prisma schema + migrations + generated client (generated/ is gitignored — never edit).
  api/    oRPC contract + router + middlewares. Imported by web for types only.
  ui/     StyleX tokens + Base UI wrappers + Storybook. Black/white, 4px radius, Suisse Intl.
  env/    Zod-validated env schemas. All env access goes through here.
  config/ Shared tsconfig base.
e2e/      Playwright smoke spec.
```

## Commands

| Command             | What                                                                 |
| ------------------- | -------------------------------------------------------------------- |
| `pnpm dev`          | Full local stack via mprocs (postgres, emulate, api, web, storybook) |
| `pnpm lint`         | oxlint, type-aware + TS compiler errors (tsgolint)                   |
| `pnpm format`       | oxfmt (write mode); `pnpm format:check` in CI                        |
| `pnpm typecheck`    | `tsc --noEmit` per package via turbo                                 |
| `pnpm test`         | Vitest per package via turbo                                         |
| `pnpm build`        | turbo build                                                          |
| `pnpm db:reset`     | Drop + migrate + seed local database                                 |
| `pnpm bad-day`      | Nuke node_modules + all caches, reinstall (`DRY_RUN=1` to preview)   |
| `pnpm rename`       | Rename the template to your product (`pnpm rename acme-app`)         |
| `pnpm skills:check` | Verify installed agent skills match dep majors                       |

Web app (`apps/web`): `pnpm --filter @web-starter/web dev` (:3000 standalone, or portless-assigned `PORT` under `pnpm dev`; needs api on `VITE_API_URL`), `build` (Workers bundle), `deploy` (build + `wrangler deploy`), `cf-typegen` (binding types).

## Local URLs (portless)

`pnpm dev` serves the HTTP apps behind [portless](https://portless.sh) — stable named HTTPS URLs instead of ports:

| Service   | URL                                                                                    | Without portless   |
| --------- | -------------------------------------------------------------------------------------- | ------------------ |
| web       | https://web-starter.localhost                                                          | :3000              |
| api       | https://api.web-starter.localhost                                                      | :3001 (`API_PORT`) |
| storybook | https://storybook.web-starter.localhost                                                | :6006              |
| postgres  | — (raw TCP, not proxyable) localhost:5433                                              | localhost:5433     |
| emulate   | https://{stripe,google,resend}.emulate.localhost (via --portless; upstream :5100-5102) | same               |

- First run needs one-time setup in a terminal: `sudo pnpm exec portless proxy start --https` (binds 443, generates + trusts a local CA). After that the proxy auto-starts. `pnpm exec portless service install` makes it start on boot.
- portless injects `PORT` (4000-4999 pool) into each app; api prefers `PORT` over `API_PORT`, vite reads it in `vite.config.ts`. emulate sits at base 5100 to stay out of that pool and registers https://{stripe,google,resend}.emulate.localhost aliases via --portless. Node processes calling those HTTPS aliases need NODE_EXTRA_CA_CERTS=~/.portless/ca.pem (wired in mprocs.yaml for the api pane); plain http://localhost:510x always works as fallback.
- Agents: check the api with `curl https://api.web-starter.localhost/health`; docs at `https://api.web-starter.localhost/docs`. If TLS is in the way, `--no-tls` on portless or curl `-k`.
- Cookies: web and api are sibling subdomains, so Better Auth sets `Domain=.web-starter.localhost` (see `createAuth` — same mechanism as prod `app.x.com`/`api.x.com`). Plain `localhost:port` dev still works and needs no cookie domain.
- e2e stays port-based (CI has no portless proxy).

Docker: plain `docker compose up -d` starts only Postgres (dev). The `api` container is behind a profile — `docker compose --profile full up -d --build` runs the prod-shaped stack (migrate on start, port 3001).

## Billing

- Stripe via `@better-auth/stripe` (plugin in `apps/api/src/auth.ts`, plans in `apps/api/src/billing/plans.ts`). Plugin only activates when `STRIPE_SECRET_KEY` is set — the starter boots without Stripe.
- Local default: `pnpm emulate` runs the emulate.dev Stripe emulator on :5100 (base port 5100 keeps clear of portless's 4000-4999 PORT pool; ports follow the --service order in the root `emulate` script: stripe :5100, google :5101, resend :5102), seeded from `emulate.config.yaml` (product "Pro Plan", price `price_pro_monthly_local`, webhook → `/api/auth/stripe/webhook` signed with `whsec_local_emulate`). Point the SDK at it with `STRIPE_API_BASE`.
- Switching `STRIPE_API_BASE` between emulate and real test mode strands `stripeCustomerId`s minted on the other backend (upgrade then fails referencing a customer the current backend does not know). Cure: `pnpm db:reset`, or null the user's `stripeCustomerId` so the plugin re-creates it.
- Known gap (verified against emulate 0.10): emulate has no `/v1/subscriptions`, so BOTH halves of the plugin's subscription flow fail locally — `POST /api/auth/subscription/upgrade` 500s (plugin calls `stripe.subscriptions.list` before creating checkout), and a delivered `checkout.session.completed` 400s inside the built-in handler (post-checkout subscription retrieve) before `onEvent` runs. What DOES work against emulate: customer auto-create on signup, products/prices, checkout sessions + hosted page, signed webhook delivery (signature verifies). For the full subscription flow use `pnpm stripe:listen` (Stripe CLI, real test mode) or verify in staging.
- Webhook idempotency: every event id is recorded in `stripe_events` (`recordStripeEvent`); custom `onEvent` logic must check its return value. Built-in plugin handlers run before `onEvent` and are upsert-idempotent.

## UI (`packages/ui`)

- Components come from the [shadcn-cssinjs](https://www.shadcn-cssinjs.com) registry (StyleX on Base UI, copy-paste-own) into `src/ui/`, then adapted to this repo. The shadcn CLI currently fails on this registry's cross-registry deps — fetch item JSON from `https://www.shadcn-cssinjs.com/r/<name>.json` and write the files (see the `shadcn-cssinjs` skill for the exact adaptation checklist: relative imports, named stylex imports, `| undefined` on optional props for exactOptionalPropertyTypes).
- Two token layers, both ours: `src/lib/tokens.stylex.ts` (component tokens — shadcn CSS variables from `src/theme.css`, grayscale, `--radius: 4px`, dark via `prefers-color-scheme`) and `src/tokens.stylex.ts` (app-level layout: `spacing`, `font`, raw `palette`). Components use the lib tokens; app layout uses the app tokens. Never raw color values.
- One radius (4px — the lib radius scale is pinned to it). Black and white plus grays. Font stack `'Suisse Intl', 'Inter Variable', system-ui` — Suisse woff2 files are licensed, gitignored, fetched with `pnpm fonts` (`FONT_BUCKET_URL`); without them Inter Variable is the visual fallback. Components inherit the font from the app body; they set none themselves.
- Current set: Button, Input, Field (label/error composition), Dialog, Select, Table, Label, Separator, Skeleton, Toaster (sonner, next-themes dropped). Grow on demand from the registry.
- A story is the test: every component has colocated `*.stories.tsx` with `play` interaction tests. `pnpm --filter @web-starter/ui test` runs them in real Chromium via the Storybook Vitest addon (Vitest browser mode). `pnpm storybook` serves them on :6006.

## Web (`apps/web`)

- TanStack Start on Cloudflare Workers. Custom entry `src/server.ts` (wrangler `main`) wraps the Start handler with `paraglideMiddleware` and an evlog wide event per request (Axiom drain when `AXIOM_TOKEN`+`AXIOM_DATASET` set); wrangler `observability` stays disabled so logs are not duplicated.
- React Compiler is on (`react({ compiler: true })` via `oxc-transform-react`). react-grab loads in dev only.
- i18n: Paraglide v2, `messages/en.json` only. Generated `src/paraglide/` and `src/routeTree.gen.ts` are gitignored build output — never edit them, they regenerate on `vite dev`/`build`. All user-facing strings go through `m.*()`; server error codes map to messages in `src/lib/errors.ts` (unknown code → generic fallback, never raw codes in UI).
- API access: typed oRPC client in `src/lib/orpc.ts` (`credentials: 'include'`), Better Auth client + Stripe subscription client in `src/lib/auth.ts`.
- Analytics: PostHog only when `VITE_POSTHOG_KEY` is set — provider in `__root.tsx` (defaults `2026-05-30`, heatmaps on, inputs masked), ingest reverse-proxied through the `/ingest/$` server route to PostHog EU so adblockers don't drop events.
- Sentry: client init in `__root.tsx` only when `VITE_SENTRY_DSN` is set.
- Auth-gated routes are client-only (`ssr: false` on `/dashboard`): the session cookie belongs to the api origin and is not forwarded during SSR, so an SSR auth check would bounce logged-in users.
- StyleX in routes: import `../app.css` (build injection target) — there is no importable `virtual:stylex.css` module; in dev the plugin middleware serves the CSS itself.

### Forms

- TanStack Form (`@tanstack/react-form`) is THE form library — no react-hook-form, no hand-rolled FormData handling for anything beyond a single input.
- Pattern (see `login.tsx`/`signup.tsx`, plumbing in `src/lib/form.tsx`): `useAppForm` (via `createFormHook`) with zod schema on `validators.onChange` + `onSubmit`, and the server mutation INSIDE `validators.onSubmitAsync` — on failure it returns `serverErrorToFormErrors(error)` (`{ form?, fields? }`), so server errors render through the SAME per-field channel as zod errors. `onSubmit` handler only navigates; it runs only when everything (including the server call) passed.
- NEVER add a form-level `onBlur` validator: a blur run stamps errors on still-empty sibling fields, and onBlur-cause errors only clear on the NEXT blur — users see stale errors on already-valid fields, and the resulting layout shift between mousedown and mouseup swallows the submit click (found via e2e). `onChange`-cause errors clear live; display is gated on `isTouched` in `TextField`.
- Fields render as `<form.AppField name="email">{(field) => <field.TextField label={m.x()} />}</form.AppField>`; form-level errors and the submit button as `<form.AppForm><form.FormError /><form.SubmitButton label={m.x()} /></form.AppForm>`. Never hand-wire `Input` + error resolution in routes — extend `form.tsx` with new bound field components instead.
- Localization contract: validation messages are Paraglide message KEYS set as zod custom messages (`'error_email_invalid'`), resolved by `messageForValidation`; server errors are stable machine codes mapped in `src/lib/errors.ts` (`messagesByCode` for the text, `fieldByCode` for which input shows it inline). Adding a new error code = message in `messages/en.json` + one entry in each map. Never English prose in schemas or from the server.
- Inline beats toast for field-scoped server errors (NN/g); toasts are reserved for global/system failures.
- Schemas for Better Auth endpoints live in `apps/web/src/lib/schemas.ts` (Better Auth owns those routes, there is no oRPC contract for them). The moment an oRPC procedure shares an input shape, move the schema to `packages/api` and import it in both places.

### i18n lint

- All user-facing strings go through Paraglide (`m.*()`). `react/jsx-no-literals` (oxlint, error) forbids hardcoded JSX text and text-bearing attributes (label/placeholder/title/alt/aria-\*); tests, stories, and scripts are exempt via overrides. `packages/ui` components take all text as props. Inline `oxlint-disable` only with a justification comment.

## Testing

Test pyramid, bottom-up — everything runs with `pnpm test` (turbo) except e2e:

- **Unit** (`*.test.ts` / `*.test.tsx`): api unit tests use a stub `Db` (no Docker); web unit tests run in jsdom (Vitest + Testing Library) with router/auth-client mocked; `src/lib/errors.ts` mapping is covered here.
- **Component** (`packages/ui`): stories are the tests — `play` functions run in real Chromium via `@storybook/addon-vitest` (`pnpm --filter @web-starter/ui test`).
- **Integration** (`apps/api/src/*.int.test.ts`): Vitest project `integration` boots one Testcontainers `postgres:17-alpine` per run (`src/test/global-setup.ts`), applies committed migrations, and truncates all tables between tests (`src/test/db.ts` — Prisma has no per-test rollback). Auth flows go through `app.inject()`; oRPC procedures are called directly with `call()` and a hand-built context. Requires Docker.
- **E2E** (`e2e/`): `pnpm e2e` — Playwright boots emulate Stripe (:4000), api (:3021, compose Postgres on :5433 must be up) and web (:3020) via `webServer`, then runs `smoke.spec.ts`: signup → dashboard → logout → login → subscribe attempt (asserts the documented emulate subscription gap degrades to a localized error, not a crash). Tests wait for `html[data-hydrated]` (set by a root effect) before touching forms — interacting pre-hydration triggers a native GET submit.

Conventions: unique emails per e2e run (`smoke-<timestamp>@…`); never assert on server prose (assert codes or localized messages); new api features get an integration test, new UI components get a story with a `play` test.

## Dev workflow

- `pnpm dev` runs mprocs with five panes: postgres (compose, attached), emulate (Stripe/Google/Resend emulators), api, web, storybook. Quit with `q`; panes restart individually with `r`.
- Emulate state is in-memory — restarting the emulate pane IS the reset; there is no state file to wipe. Database state resets with `pnpm db:reset`.
- When everything is broken for no reason: `pnpm bad-day` (kills dev processes, removes every node_modules/cache/generated dir, prunes the pnpm store, reinstalls). Preview with `DRY_RUN=1 pnpm bad-day`.
- Claude Code hooks (`.claude/settings.json`): every Write/Edit is auto-formatted (oxfmt) and auto-fixed (oxlint) on save; a Stop hook runs `pnpm typecheck` and blocks the stop if types are broken.
- Agent skills for the stack live in `.claude/skills/` (committed, pinned by `skills-lock.json`). Maintenance: `npx skills update` refreshes them; `pnpm skills:check` warns when a dep's installed major drifts from what its skill was last verified against (`skills.versions.json`) — after a major dep bump, update the skill, re-verify, bump `checkedMajor`. MCP servers are pinned by exact version in `.mcp.json`.
- Renovate bumps deps (minor/patch grouped weekly, majors gated behind the dependency dashboard).

## CI/CD

- **CI** (`.github/workflows/ci.yml`, PRs + main): `checks` job = turbo lint/typecheck/build + `format:check` + `skills:check` + react-doctor (warnings shown, errors fail); `test` job = full `pnpm test` (Testcontainers Postgres + Chromium story tests); `e2e` job = compose Postgres + `pnpm e2e`. Turbo remote cache activates when `TURBO_TOKEN`/`TURBO_TEAM` are configured.
- **Deploy** (`deploy.yml`, push to main): web builds and deploys to Cloudflare Workers via wrangler-action (+ optional Sentry sourcemaps); api deploys by POSTing the Dokploy webhook (`DOKPLOY_WEBHOOK_URL` secret — Dokploy pulls the repo, builds `apps/api/Dockerfile`, container entrypoint runs `prisma migrate deploy` before start).
- **Previews** (`preview.yml`): every PR uploads a Workers preview version and comments the URL. api previews are Dokploy's native Preview Deployments (enabled in the Dokploy UI, served at `pr-<n>.<api-domain>`); shared preview Postgres isolates per-PR state in `pr_<n>` schemas, dropped by `preview-cleanup.yml` on close (needs `DATABASE_URL_PREVIEW` secret).
- Required repo config lives in README's "Going to production" checklist. CI must be green before merge; cubic reviews every PR.

## Rules

- Never edit generated directories: `packages/db/generated/`, `apps/web/src/paraglide/`.
- Never run `prisma db push` outside local development (script is guarded; do not bypass).
- Database access only in `apps/api` + `packages/db`. Web goes through oRPC.
- API errors are stable machine codes (oRPC typed errors), never prose. Web maps codes to Paraglide messages.
- Auth lives in `apps/api/src/auth.ts` (Better Auth: email+password + Google). Schema changes to auth tables: edit `packages/db/prisma/schema.prisma` against Better Auth's canonical tables, then `migrate:dev` (the deprecated `@better-auth/cli generate` produces a pre-1.7 schema — do not rerun it blindly).
- Protected oRPC procedures compose `protectedBase`; mutations compose `audited(entity)` (writes `audit_log`). Auth-side audit rows come from Better Auth `databaseHooks`.
- All external services are emulated locally (emulate.dev) — local dev needs no real credentials.
- No new dependencies, components, or abstractions without a concrete current need.
- Secrets never enter git. Local uses `.env` (from `.env.example`); prod uses Dokploy / wrangler secrets.
- Conventional commits, enforced by commitlint. PRs only against `main`; CI must be green.
- Stack decisions are recorded in `docs/adr/`. Change of direction = new ADR.
