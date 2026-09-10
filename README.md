# keepyourattention

Opinionated full-stack boilerplate for starting new products. One architecture, every product — so knowledge (yours and your agents') compounds instead of resetting. Everything runs locally against emulators; agents can break and reset anything without touching prod.

Founding decisions live in [docs/adr/0001-stack.md](docs/adr/0001-stack.md). Agent rules and workflow live in [AGENTS.md](AGENTS.md).

## The phone tool

`cli/supervise.py` turns an iPhone into a supervised device without erasing it, by patching a local Finder backup. Supervision is what lets a configuration profile lock the phone down: a Safari allowlist, no App Store, no app installs. It is a standalone Python script with no dependencies, outside the pnpm workspace. See [cli/README.md](cli/README.md).

## Stack

| Layer       | Choice                                                                          |
| ----------- | ------------------------------------------------------------------------------- |
| Monorepo    | pnpm workspaces + Turborepo, Node 24, TypeScript 7                              |
| Web         | TanStack Start (React 19 + Compiler) → Cloudflare Workers                       |
| API         | Fastify + oRPC (OpenAPI + Scalar docs) → Docker on Hetzner via Dokploy          |
| Auth        | Better Auth (email+password + Google), cookie sessions                          |
| Billing     | Stripe subscriptions via `@better-auth/stripe`                                  |
| DB          | Postgres 17 + Prisma 7, committed migrations                                    |
| Styling     | StyleX tokens (black/white, 4px radius) + Base UI components + Storybook        |
| i18n        | Paraglide v2 (en-only structure; error codes → localized messages)              |
| Analytics   | PostHog EU (replay + heatmaps, `/ingest` reverse proxy)                         |
| Errors      | Sentry (web + api)                                                              |
| Logging     | evlog wide events → Axiom drain                                                 |
| Lint/format | oxlint (`@nkzw/oxlint-config`, type-aware) + oxfmt — no ESLint/Prettier         |
| Tests       | Vitest (+ Testcontainers, Storybook stories as tests) + one Playwright smoke    |
| Local mocks | emulate.dev (Stripe, Google OAuth, Resend) — no real credentials needed locally |

## Quickstart

Prereqs: Node 24 (`nvm use`), pnpm 11 (corepack), Docker.

```sh
pnpm install
sudo pnpm exec portless proxy start --https   # one-time: local HTTPS proxy on 443 + trusted CA
pnpm dev        # mprocs: postgres + emulators + api + web + storybook
```

First run: `pnpm db:reset` seeds the database. Open https://keepyourattention.localhost, sign up, subscribe through the emulated Stripe checkout.

Local URLs come from [portless](https://portless.sh) — stable named HTTPS domains instead of ports:

| Service   | URL                                                                    |
| --------- | ---------------------------------------------------------------------- |
| web       | https://keepyourattention.localhost                                    |
| api       | https://api.keepyourattention.localhost                                |
| API docs  | https://api.keepyourattention.localhost/docs                           |
| storybook | https://storybook.keepyourattention.localhost                          |
| postgres  | localhost:5433 (raw TCP, no proxy)                                     |
| emulate   | https://{stripe,google,resend}.emulate.localhost (upstream :5100-5102) |

`pnpm exec portless service install` starts the proxy on boot. Postgres is plain TCP — connect DataGrip/psql to `localhost:5433` (`keepyourattention` / `keepyourattention` / db `keepyourattention`).

## Commands

| Command                                        | What it does                                                       |
| ---------------------------------------------- | ------------------------------------------------------------------ |
| `pnpm dev`                                     | Everything, in mprocs panes                                        |
| `pnpm test`                                    | All unit + integration + story tests (turbo)                       |
| `pnpm e2e`                                     | Playwright smoke against a self-booted full stack                  |
| `pnpm lint` / `pnpm format` / `pnpm typecheck` | Quality gates (same as CI)                                         |
| `pnpm db:reset`                                | Drop volume → migrate → seed                                       |
| `pnpm db:migrate` / `pnpm db:studio`           | Migrations / Prisma Studio                                         |
| `pnpm storybook`                               | Component workshop (standalone, :6006)                             |
| `pnpm bad-day`                                 | Nuke node_modules + all caches, reinstall (`DRY_RUN=1` to preview) |
| `pnpm rename`                                  | Rename the template to your product (`pnpm rename acme-app`)       |
| `pnpm fonts`                                   | Fetch Suisse Intl from private bucket (Inter fallback otherwise)   |
| `pnpm stripe:listen`                           | Opt-in Stripe CLI webhook forwarding (subscription events)         |
| `pnpm skills:check`                            | Warn when dep majors drift from verified agent skills              |

## Starting a new product

```sh
gh repo create yourname/new-product --template mertbuilds/web-starter --private --clone
cd new-product && pnpm install
pnpm rename new-product   # or: bash scripts/rename.sh new-product
pnpm dev
```

Rename rewrites the package scope, worker name, local hosts, Postgres creds, titles and lockfile in one diff; `docs/adr` stays as history. Review, commit, then work through the accounts checklist below as you go live.

## Going to production — accounts checklist

Local dev needs none of these. Production needs:

- [ ] **Cloudflare** — Workers for web; secrets `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` in GitHub
- [ ] **Hetzner + Dokploy** — api container + Postgres; deploy webhook → secret `DOKPLOY_WEBHOOK_URL`; enable Preview Deployments per-app for PR previews
- [ ] **Stripe** — live + test keys; webhook endpoint `/api/auth/stripe/webhook`
- [ ] **PostHog Cloud EU** — project key → `POSTHOG_KEY`
- [ ] **Sentry** — web + api DSNs; `SENTRY_AUTH_TOKEN` for sourcemaps; uptime check on api `/health`
- [ ] **Axiom** — dataset + token for evlog drain
- [ ] **Resend** — API key + verified sending domain
- [ ] **Google OAuth** — client id/secret, redirect `https://api.<domain>/api/auth/callback/google`
- [ ] **cubic** — install the GitHub app for AI review
- [ ] **Branch protection** — PRs only, CI required on `main`
- [ ] **Suisse Intl bucket** — `FONT_BUCKET_URL` secret (private R2); Inter ships as fallback
- [ ] **Turbo remote cache** (optional) — `TURBO_TOKEN` secret + `TURBO_TEAM` var

## Known gaps

- **emulate.dev has no Stripe subscriptions** (`/v1/subscriptions`, `customer.subscription.*`): checkout works locally, but the subscription upgrade flow 500s at `stripe.subscriptions.list`. Fallback: `pnpm stripe:listen` with a Stripe test account. Upstream PR to [vercel-labs/emulate](https://github.com/vercel-labs/emulate) is the real fix.
- **Compose Postgres binds host port 5433** (5432 is commonly taken). Inside the network it's still 5432.

## License

MIT. See [LICENSE](LICENSE).
