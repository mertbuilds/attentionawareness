# attention awareness

Block distraction from your iPhone. Permanently. A free Mac app, a browser extension and the site, all open source. <https://attentionawareness.com>

The product is three parts: the site, the browser extension and the Mac app.
All three live here. The Mac app ships from the site.

## What is here

### `apps/web`

The site. A landing page, the download for the Mac app, the manual guide, the
profile builder, the blog and the open numbers page. It also signs the configuration profile: `POST /api/sign` is what
the Mac app asks for the profile it installs. TanStack Start on Cloudflare
Workers; the founding stack decisions are in
[docs/adr/0001-stack.md](docs/adr/0001-stack.md).

### `apps/extension`

A Chromium extension that hides the addictive feeds on YouTube, Instagram and
X with CSS, plus custom CSS of your own per domain. It is free. It is in the
[Chrome Web Store](https://chromewebstore.google.com/detail/attention-awareness/lgcijcijcndmggjiioibfcmppndfakee).
See [apps/extension/README.md](apps/extension/README.md).

### `apps/mac`

The Mac app. Native Swift and SwiftUI, macOS 14 and later, Apple silicon. It
supervises a connected iPhone on iOS 26 or older over USB without erasing it,
and installs the restrictions. It does not support iOS 27 yet. It is free, with no account and no key. It is
not part of the pnpm workspace: Xcode builds it. See
[apps/mac/README.md](apps/mac/README.md).

## How the phone part works

- Supervision is a device mode Apple gives to phones that a school or a company
  owns.
- A configuration profile on a supervised phone can hide apps by bundle id and
  block sites. On a normal phone it can still filter websites, but it cannot
  hide or block apps, and it can be removed in Settings.
- Apple's own path to supervision is Apple Configurator's Prepare action, which
  erases the phone first.
- The Mac app supervises the phone without erasing it, on iOS 26 and older.
  The guide uses Apple Configurator, which erases it, and is the way on iOS 27.
  Both are free.
- Profiles are signed on the server with a Developer ID certificate and carry a
  unique identifier per install, so a second profile stacks on the first
  instead of replacing it. Nothing on the phone takes one off: that takes an
  erase, or Apple Configurator on a Mac. Trial mode is the
  exception and stays removable in Settings. See
  [docs/signing.md](docs/signing.md).

## Stack

| Layer       | Choice                                                                   |
| ----------- | ------------------------------------------------------------------------ |
| Monorepo    | pnpm workspaces + Turborepo, Node 24, TypeScript 7                       |
| Web         | TanStack Start (React 19 + Compiler) on Cloudflare Workers               |
| Extension   | Chromium MV3, React 19 popup, three Vite builds                          |
| Styling     | StyleX tokens (black/white, 4px radius) + Base UI components + Storybook |
| i18n        | Paraglide v2 (English + Turkish catalogs)                                |
| Analytics   | PostHog EU (replay + heatmaps) and OpenPanel (`/op` proxy)               |
| Errors      | Sentry                                                                   |
| Logging     | evlog wide events to an Axiom drain                                      |
| Lint/format | oxlint (`@nkzw/oxlint-config`, type-aware) + oxfmt, no ESLint/Prettier   |

## Develop

Prereqs: pnpm 11 (corepack), Node 24 (`nvm use`).

```sh
pnpm install
pnpm dev   # mprocs: web + storybook
```

`pnpm dev` serves the app on https://aa.localhost through
[portless](https://portless.sh). The proxy is a one-time setup:
`sudo pnpm exec portless proxy start --https`.

| Command             | What it does               |
| ------------------- | -------------------------- |
| `pnpm lint`         | oxlint, type-aware         |
| `pnpm format:check` | oxfmt, the CI check        |
| `pnpm typecheck`    | `tsc --noEmit` per package |

**Fonts.** Suisse Intl is licensed and not in the repo. Without
`packages/ui/fonts/*.woff2` the site falls back to Inter and everything else
works. `pnpm fonts` fetches them from a private bucket; see
[scripts/fetch-fonts.sh](scripts/fetch-fonts.sh).

**Signing secrets.** Signing is off until they exist, and `/api/sign` answers 503. To sign locally, copy `.dev.vars.example` to
`.dev.vars` at the repo root and fill in the three values.

**Deploy.** `pnpm --filter @attentionawareness/web deploy` builds and ships to
Cloudflare Workers; a push to main does the same from CI. Agent rules, the
repo layout and the full workflow live in [AGENTS.md](AGENTS.md).

## Honesty

- These sites change their markup, and a changed selector is a rule that
  silently stops hiding anything. Every rule file carries the date it was last
  checked against the live DOM.
- There are no accounts. The profile is built on your own machine and signed on
  the way out; what you block is not stored and not tracked.

## Licenses

There are two licenses in this repo.

- The Mac app, everything in `apps/mac`, is under the GNU Affero General
  Public License, version 3 (`AGPL-3.0-only`). See
  [apps/mac/LICENSE](apps/mac/LICENSE) and
  [apps/mac/THIRD_PARTY_NOTICES.md](apps/mac/THIRD_PARTY_NOTICES.md).
- Everything else, the site, the extension and the packages, is under the MIT
  license. See [LICENSE](LICENSE).

Files in the site and the packages that are not ours are listed, with their
licenses, in [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md).

Made by Mert Duzgun. <https://mertbuilds.com>
