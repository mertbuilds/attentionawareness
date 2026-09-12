# Attention Awareness

Free, open-source tools to take your attention back. <https://attentionawareness.com>

## What is here

### `apps/web`

The site. A math-first landing page that prices a scrolling habit in years, a
generator that builds a signed iOS configuration profile blocking the apps and
sites you choose, enforced by iOS supervision, and the supervision guide at
[/supervise](https://attentionawareness.com/supervise). TanStack Start on
Cloudflare Workers; the founding stack decisions are in
[docs/adr/0001-stack.md](docs/adr/0001-stack.md).

### `cli/`

`supervise`, a standard-library Python tool that turns an iPhone into a
supervised device without erasing it. It patches a Finder backup, encrypted or
not, and the restore hands back the same phone with supervision on. Install it
with `curl -fsSL https://attentionawareness.com/install.sh | sh` and read
[cli/README.md](cli/README.md) before you run it.

### `apps/extension`

A Chromium extension that hides the feeds on X, YouTube, Instagram and TikTok
with CSS, plus custom CSS of your own per domain. It is not in the Chrome Web
Store yet, so build it and load unpacked from `apps/extension/dist` for now.
See [apps/extension/README.md](apps/extension/README.md).

## How the phone part works

- Supervision is a device mode Apple gives to phones that a school or a company
  owns.
- A configuration profile on a supervised phone can hide apps by bundle id and
  block sites. On a normal phone it cannot, and Screen Time is all that is left.
- Apple's own path to supervision is Apple Configurator's Prepare action, which
  erases the phone first.
- `supervise` flips one flag inside a Finder backup instead, so a restore yields
  a supervised phone with the data still on it. Restore verified on iOS 26.6.1.
  An encrypted iOS 26.2.1 backup patches and reads back; its restore is being
  tested.
- Profiles are signed on the server with a Developer ID certificate and carry a
  unique identifier per download, so a second profile stacks on the first
  instead of replacing it and only an erase takes one off. Trial mode is the
  exception and stays removable in Settings. See
  [docs/signing.md](docs/signing.md).

## Stack

| Layer       | Choice                                                                   |
| ----------- | ------------------------------------------------------------------------ |
| Monorepo    | pnpm workspaces + Turborepo, Node 24, TypeScript 7                       |
| Web         | TanStack Start (React 19 + Compiler) on Cloudflare Workers               |
| CLI         | `supervise`, standard-library Python 3.9+, outside the pnpm workspace    |
| Extension   | Chromium MV3, React 19 popup, three Vite builds                          |
| Styling     | StyleX tokens (black/white, 4px radius) + Base UI components + Storybook |
| i18n        | Paraglide v2 (English + Turkish catalogs)                                |
| Analytics   | PostHog EU (replay + heatmaps, `/ingest` reverse proxy)                  |
| Errors      | Sentry                                                                   |
| Logging     | evlog wide events to an Axiom drain                                      |
| Lint/format | oxlint (`@nkzw/oxlint-config`, type-aware) + oxfmt, no ESLint/Prettier   |
| Tests       | Vitest (+ Storybook stories as tests) + Playwright smoke tests           |

## Develop

Prereqs: pnpm 11 (corepack), Node 24 (`nvm use`).

```sh
pnpm install
pnpm dev   # mprocs: web + storybook
```

`pnpm dev` serves the app on https://attentionawareness.localhost through
[portless](https://portless.sh). The proxy is a one-time setup:
`sudo pnpm exec portless proxy start --https`.

| Command             | What it does                              |
| ------------------- | ----------------------------------------- |
| `pnpm test`         | Unit and story tests across the workspace |
| `pnpm e2e`          | Playwright smoke against a booted web app |
| `pnpm lint`         | oxlint, type-aware                        |
| `pnpm format:check` | oxfmt, the CI check                       |
| `pnpm typecheck`    | `tsc --noEmit` per package                |

**Fonts.** Suisse Intl is licensed and not in the repo. Without
`packages/ui/fonts/*.woff2` the site falls back to Inter and everything else
works. `pnpm fonts` fetches them from a private bucket; see
[scripts/fetch-fonts.sh](scripts/fetch-fonts.sh).

**Signing secrets.** Signing is off until they exist, and `/api/sign` answers 503. To sign locally, copy `apps/web/.dev.vars.example` to
`apps/web/.dev.vars` and fill in the three values.

**Deploy.** `pnpm --filter @attentionawareness/web deploy` builds and ships to
Cloudflare Workers; a push to main does the same from CI. Agent rules, the
repo layout and the full workflow live in [AGENTS.md](AGENTS.md).

## Honesty

- Patching a backup is not an Apple-supported procedure. It works today on iOS 26. A future release can close it, so keep the untouched copies that `patch`
  saves.
- These sites change their markup, and a changed selector is a rule that
  silently stops hiding anything. Every rule file carries the date it was last
  checked against the live DOM.
- There are no accounts. The profile is built in your browser and signed on the
  way out; what you block is not stored and not tracked.

## License

MIT. See [LICENSE](LICENSE).

Made by Mert Duzgun. <https://mertbuilds.com>
