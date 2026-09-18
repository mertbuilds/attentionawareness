# attention awareness

Free, open-source tools to take your attention back. <https://attentionawareness.com>

The product is three parts and nothing else: the site, the browser extension
and the Mac app.

## What is here

### `apps/web`

The site. A math-first landing page that prices a scrolling habit in years,
the download for the Mac app, and the guide to the extension. It also signs
the configuration profile: `POST /api/sign` is what the Mac app asks for the
profile it installs. TanStack Start on Cloudflare Workers; the founding stack
decisions are in [docs/adr/0001-stack.md](docs/adr/0001-stack.md).

### `apps/mac`

The Mac app. Plug the iPhone in with a cable and it backs the phone up,
patches one flag inside the backup and restores it, then installs the profile
over USB. The phone comes back supervised with everything still on it.
Unsupervising is the same app run the other way. See
[apps/mac/README.md](apps/mac/README.md).

### `apps/extension`

A Chromium extension that hides the feeds on X, YouTube, Instagram and TikTok
with CSS, plus custom CSS of your own per domain. It is in the
[Chrome Web Store](https://chromewebstore.google.com/detail/attention-awareness/lgcijcijcndmggjiioibfcmppndfakee).
See [apps/extension/README.md](apps/extension/README.md).

## How the phone part works

- Supervision is a device mode Apple gives to phones that a school or a company
  owns.
- A configuration profile on a supervised phone can hide apps by bundle id and
  block sites. On a normal phone it cannot, and Screen Time is all that is left.
- Apple's own path to supervision is Apple Configurator's Prepare action, which
  erases the phone first.
- The Mac app flips one flag inside a local backup instead, so a restore yields
  a supervised phone with the data still on it. Restore verified on iOS 26.6.1
  (unencrypted backup) and iOS 26.2.1 (encrypted backup).
- Profiles are signed on the server with a Developer ID certificate and carry a
  unique identifier per install, so a second profile stacks on the first
  instead of replacing it and only an erase takes one off. Trial mode is the
  exception and stays removable in Settings. See
  [docs/signing.md](docs/signing.md).

## Stack

| Layer       | Choice                                                                   |
| ----------- | ------------------------------------------------------------------------ |
| Monorepo    | pnpm workspaces + Turborepo, Node 24, TypeScript 7                       |
| Web         | TanStack Start (React 19 + Compiler) on Cloudflare Workers               |
| Mac app     | SwiftUI, macOS 14+, Apple Silicon, outside the pnpm workspace            |
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

- Patching a backup is not an Apple-supported procedure. It works today on iOS 26. A future release can close it, so keep the untouched copies the app saves
  beside the backup.
- These sites change their markup, and a changed selector is a rule that
  silently stops hiding anything. Every rule file carries the date it was last
  checked against the live DOM.
- There are no accounts. The profile is built on your own machine and signed on
  the way out; what you block is not stored and not tracked.

## License

MIT. See [LICENSE](LICENSE).

Made by Mert Duzgun. <https://mertbuilds.com>
