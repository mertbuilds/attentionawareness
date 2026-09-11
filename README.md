# keepyourattention

Opinionated boilerplate for starting new products. One architecture, every product — so knowledge (yours and your agents') compounds instead of resetting. The site is static and client-only: it runs entirely in the browser, so there is nothing to break in prod.

Founding decisions live in [docs/adr/0001-stack.md](docs/adr/0001-stack.md). Agent rules and workflow live in [AGENTS.md](AGENTS.md).

## The phone tool

The `supervise` command turns an iPhone into a supervised device without erasing it, by patching a local Finder backup. Supervision is what lets a configuration profile lock the phone down: a Safari allowlist, no App Store, no app installs. It is standard library Python with no dependencies, in `cli/`, outside the pnpm workspace. Install it with `curl -fsSL https://keepyourattention.com/install.sh | sh`. See [cli/README.md](cli/README.md).

## Stack

| Layer       | Choice                                                                   |
| ----------- | ------------------------------------------------------------------------ |
| Monorepo    | pnpm workspaces + Turborepo, Node 24, TypeScript 7                       |
| Web         | TanStack Start (React 19 + Compiler) → Cloudflare Workers                |
| CLI         | `supervise`, standard-library Python 3.9+, outside the pnpm workspace    |
| Styling     | StyleX tokens (black/white, 4px radius) + Base UI components + Storybook |
| i18n        | Paraglide v2 (English + Turkish catalogs)                                |
| Analytics   | PostHog EU (replay + heatmaps, `/ingest` reverse proxy)                  |
| Errors      | Sentry                                                                   |
| Logging     | evlog wide events → Axiom drain                                          |
| Lint/format | oxlint (`@nkzw/oxlint-config`, type-aware) + oxfmt — no ESLint/Prettier  |
| Tests       | Vitest (+ Storybook stories as tests) + one Playwright smoke             |

## Quickstart

Prereqs: Node 24 (`nvm use`), pnpm 11 (corepack).

```sh
pnpm install
sudo pnpm exec portless proxy start --https   # one-time: local HTTPS proxy on 443 + trusted CA
pnpm dev        # mprocs: web + storybook
```

Open https://keepyourattention.localhost and build a profile.

Local URLs come from [portless](https://portless.sh) — stable named HTTPS domains instead of ports:

| Service   | URL                                           |
| --------- | --------------------------------------------- |
| web       | https://keepyourattention.localhost           |
| storybook | https://storybook.keepyourattention.localhost |

`pnpm exec portless service install` starts the proxy on boot.

## Commands

| Command                                        | What it does                                                       |
| ---------------------------------------------- | ------------------------------------------------------------------ |
| `pnpm dev`                                     | Everything, in mprocs panes                                        |
| `pnpm test`                                    | All unit + story tests (turbo)                                     |
| `pnpm e2e`                                     | Playwright smoke against a self-booted web app                     |
| `pnpm lint` / `pnpm format` / `pnpm typecheck` | Quality gates (same as CI)                                         |
| `pnpm storybook`                               | Component workshop (standalone, :6006)                             |
| `pnpm bad-day`                                 | Nuke node_modules + all caches, reinstall (`DRY_RUN=1` to preview) |
| `pnpm rename`                                  | Rename the template to your product (`pnpm rename acme-app`)       |
| `pnpm fonts`                                   | Fetch Suisse Intl from private bucket (Inter fallback otherwise)   |
| `pnpm skills:check`                            | Warn when dep majors drift from verified agent skills              |

## Starting a new product

```sh
gh repo create yourname/new-product --template mertbuilds/web-starter --private --clone
cd new-product && pnpm install
pnpm rename new-product   # or: bash scripts/rename.sh new-product
pnpm dev
```

Rename rewrites the package scope, worker name, local hosts, titles and lockfile in one diff; `docs/adr` stays as history. Review, commit, then work through the accounts checklist below as you go live.

## Going to production — accounts checklist

Local dev needs none of these. Production needs:

- [ ] **Cloudflare** — Workers for web; secrets `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` in GitHub
- [ ] **PostHog Cloud EU** — project key → `POSTHOG_KEY`
- [ ] **Sentry** — web DSN; `SENTRY_AUTH_TOKEN` for sourcemaps
- [ ] **Axiom** — dataset + token for evlog drain
- [ ] **cubic** — install the GitHub app for AI review
- [ ] **Branch protection** — PRs only, CI required on `main`
- [ ] **Suisse Intl bucket** — `FONT_BUCKET_URL` secret (private R2); Inter ships as fallback
- [ ] **Turbo remote cache** (optional) — `TURBO_TOKEN` secret + `TURBO_TEAM` var

## License

MIT. See [LICENSE](LICENSE).
