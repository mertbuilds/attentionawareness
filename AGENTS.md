# attentionawareness

Opinionated monorepo boilerplate. Every product starts as a copy of this repo. Keep it minimal: nothing gets added until a product needs it.

## Architecture

```
apps/
  web/    TanStack Start (React 19, React Compiler) → Cloudflare Workers.
          Mostly client-only: SSR, routes, PostHog, Sentry, Paraglide i18n.
          No auth, no database. Server code: the `/open` numbers read
          from PostHog, the OpenPanel proxy and
          `/api/sign`, which signs the profile with the Developer ID key.
          Callers: the Mac app and the `/build` page.
  extension/
          MV3 browser extension (Chromium first). One content script injects
          per-site CSS from `src/rules/*.css` plus the reader's own rules from
          the options page; `storage` and `scripting`, with host access for a
          custom domain asked for once. Three Vite builds: pages, then the
          content script and the service worker as IIFEs. See its README.
packages/
  ui/     StyleX tokens + Base UI wrappers + Storybook. Black/white, 4px radius, Suisse Intl.
          `@attentionawareness/ui/brand` holds the outlined "aa" mark both apps draw from.
  env/    Zod-validated client env schema. All env access goes through here.
  config/ Shared tsconfig base.
```

`apps/mac` is the Mac app: Swift and SwiftUI, built by Xcode from an xcodegen
`project.yml`. It is not a pnpm workspace package, and turbo, oxlint and oxfmt
all leave it alone. See **Mac app** below.

The product is the site, the extension and the Mac app, and all three live in
this repo. The Mac app is open source under AGPL-3.0 (`apps/mac/LICENSE`); the
rest of the repo is MIT (`LICENSE`). Why: `docs/adr/0008-mac-app-agpl.md`.
The web profile
builder (`/build`) came back on 2026-09-30 as the profile step of the
manual path (`/guide`), which erases the iPhone; the Mac app is the
path that keeps the data. Both are free, and so is the extension: the Mac app
has had no license key step since 0.4.0, and people can support the work on a
pay-what-you-want Polar checkout, which the home page links. The Mac app is
open source under AGPL-3.0 and lives in `apps/mac`. The site, the extension
and the shared packages are MIT. The site names the licences only in the FAQ.
Why: `docs/adr/0006-free-with-support.md`.

## Commands

| Command             | What                                                               |
| ------------------- | ------------------------------------------------------------------ |
| `pnpm dev`          | Web + storybook via mprocs                                         |
| `pnpm lint`         | oxlint, type-aware + TS compiler errors (tsgolint)                 |
| `pnpm format`       | oxfmt (write mode); `pnpm format:check` in CI                      |
| `pnpm typecheck`    | `tsc --noEmit` per package via turbo                               |
| `pnpm build`        | turbo build                                                        |
| `pnpm bad-day`      | Nuke node_modules + all caches, reinstall (`DRY_RUN=1` to preview) |
| `pnpm rename`       | Rename the template to your product (`pnpm rename acme-app`)       |
| `pnpm skills:check` | Verify installed agent skills match dep majors                     |

Web app (`apps/web`): `pnpm --filter @attentionawareness/web dev` (:3000 standalone, or portless-assigned `PORT` under `pnpm dev`), `build` (Workers bundle), `deploy` (build + `cf deploy --prebuilt`), `cf-typegen` (binding types into `.cloudflare/types`).

## Local URLs (portless)

`pnpm dev` serves the HTTP apps behind [portless](https://portless.sh) — stable named HTTPS URLs instead of ports:

| Service   | URL                                            | Without portless |
| --------- | ---------------------------------------------- | ---------------- |
| web       | https://attentionawareness.localhost           | :3000            |
| storybook | https://storybook.attentionawareness.localhost | :6006            |

- First run needs one-time setup in a terminal: `sudo pnpm exec portless proxy start --https` (binds 443, generates + trusts a local CA). After that the proxy auto-starts. `pnpm exec portless service install` makes it start on boot.
- portless injects `PORT` (4000-4999 pool) into each app; vite reads it in `vite.config.ts`, storybook takes it as `--port`. If TLS is in the way, `--no-tls` on portless or curl `-k`.

## UI (`packages/ui`)

- Components come from the [shadcn-cssinjs](https://www.shadcn-cssinjs.com) registry (StyleX on Base UI, copy-paste-own) into `src/ui/`, then adapted to this repo. The shadcn CLI currently fails on this registry's cross-registry deps — fetch item JSON from `https://www.shadcn-cssinjs.com/r/<name>.json` and write the files (see the `shadcn-cssinjs` skill for the exact adaptation checklist: relative imports, named stylex imports, `| undefined` on optional props for exactOptionalPropertyTypes).
- Two token layers, both ours: `src/lib/tokens.stylex.ts` (component tokens — shadcn CSS variables from `src/theme.css`, grayscale, `--radius: 4px`, dark via `prefers-color-scheme`) and `src/tokens.stylex.ts` (app-level layout: `spacing`, `font`, raw `palette`). Components use the lib tokens; app layout uses the app tokens. Never raw color values. `src/accent.stylex.ts` is the one chromatic colour (TE orange), shared by the site and the extension popup. Beside it, `tint` holds three quiet hues (gold, green, sky; set per theme in `src/theme.css`) for the site's drawings only, never for words or controls.
- One radius (4px — the lib radius scale is pinned to it). Black and white plus grays. Font stack `'Suisse Intl', 'Suisse Intl Fallback', 'Inter Variable', system-ui`: Suisse woff2 files are licensed, gitignored, fetched with `pnpm fonts` (`FONT_BUCKET_URL`), and preloaded from `__root.tsx` via `@attentionawareness/ui/fonts`. The site links `@attentionawareness/ui/fonts-optional.css` (`font-display: optional`: Suisse when the files are in by the first paint, else the fallback for the whole visit, never a swap on screen); the extension and Storybook import `fonts.css` (`swap`), since without a preload `optional` would never pick Suisse. "Suisse Intl Fallback" is local Arial with size and line metrics matched to Suisse (`packages/ui/src/fonts-fallback.css`), so either face sets the same lines; without the files it is also the visual fallback. Components inherit the font from the app body; they set none themselves.
- Current set: Button, Input, Field (label/error composition), Dialog, Select, Table, Label, Separator, Skeleton, Toaster (sonner, next-themes dropped). Grow on demand from the registry.
- Every component has a colocated `*.stories.tsx`. `pnpm storybook` serves them on :6006.

## Web (`apps/web`)

- TanStack Start on Cloudflare Workers. Custom entry `src/server.ts` (`worker.entrypoint` in `cloudflare.config.ts`) wraps the Start handler with `paraglideMiddleware` and an evlog wide event per request (Axiom drain when `AXIOM_TOKEN`+`AXIOM_DATASET` are declared in `cloudflare.config.ts` and set; they are not today); with no Axiom drain bound, evlog writes to the console only, so Workers `observability` is on (logs, sampling 1) to keep those logs.
- React Compiler is on (`react({ compiler: true })` via `oxc-transform-react`). devknobs (panel + grab) loads in dev only.
- i18n: Paraglide v2, English only (`locales: ["en"]`, `strategy: ['baseLocale']`). `messages/tr.json` stays on disk, unlisted and uncompiled, for the day Turkish comes back. Generated `src/paraglide/` and `src/routeTree.gen.ts` are gitignored build output — never edit them, they regenerate on `vite dev`/`build`. All user-facing strings go through `m.*()`.
- Blog: a post is a Markdown file, `apps/web/content/blog/<slug>.md` (frontmatter, body, `## Schema` JSON-LD, `## Sources`), compiled to HTML at build by the `vite.blog.ts` plugin (`marked`) and served at `/blog` and `/blog/$slug`. Posts are English only and long-form, so their text does not go through `m.*()`; the page around them does. A new post also goes into `public/sitemap.xml`. Why: `docs/adr/0005-blog-markdown.md`.
- The home page's why section is a letter on paper: `PaperLetter` in `src/components/bill-paper.tsx`. The paper follows the chosen theme (light paper and dark ink, or gray paper and light ink), its torn edge and the printed look of the words and the picture are SVG filters (`BillFilters`, rendered once by `HowItWorks`), and its texture is the `PaperTexture` shader from `@paper-design/shaders-react` (pinned), loaded lazily and drawn only while the letter is near the window, never with reduced motion or without WebGL; the plain paper under it is the fallback and what the server draws. The letter alone is typed in Special Elite (`'Special Elite', 'Courier New', ui-monospace, monospace`, one weight, `font-synthesis: none`): the file is Apache 2.0 and committed (`packages/ui/fonts/SpecialElite-Regular.woff2`, license beside it, entry in `THIRD-PARTY-NOTICES.md`), its `@font-face` is `packages/ui/src/fonts-letter.css` (`swap`, pulled in by `fonts-optional.css`), and it is not preloaded, since the letter is far down the page. It ends with a typed sign-off: the name, and the place and date under it.
- Analytics: PostHog only when `VITE_POSTHOG_KEY` and `VITE_POSTHOG_HOST` are set (`.env` locally; GitHub repository variables for the `deploy.yml` build, since Vite bakes them in at build time; previews and CI build without them). Provider in `__root.tsx` (defaults `2026-05-30`, autocapture, heatmaps, exception capture, logs, replay) sends to `VITE_POSTHOG_HOST`, PostHog's managed reverse proxy `https://e.attentionawareness.com` (a CNAME in the attentionawareness.com Cloudflare zone, DNS only), so blockers that list posthog.com do not drop the events; the GitHub repository variable `VITE_POSTHOG_HOST` holds it. `ui_host` stays `https://eu.posthog.com`, where the project lives. Without the provider, `usePostHog()` returns the uninitialized posthog-js singleton, whose `capture` is a no-op. Events: `mac_download_started` (`placement`: hero, download, closing, header or blog), `mac_download_link_shared` (`share_method`), `support_clicked` (`placement`: support_section, download_popup or footer), `github_clicked` (`placement`: footer), `extension_install_clicked` (`placement`: extension_section or footer), `sponsor_clicked` (`placement`: open), `open_dashboard_clicked` (`placement`: numbers or failed), `support_popup_shown` and `support_popup_dismissed` (`placement`: the download's; the popup opens in the same press as every download that starts on a computer, and keeps no state), `support_popup_share_clicked` (`method`: native or copy), `app_block_added`/`app_block_removed` (`total_blocked_apps`), `web_filter_mode_changed` (`web_filter_mode`), `profile_downloaded` (counts and modes, never the apps or sites themselves). Autocapture names an element by tag, classes and position only. Replay masks inputs everywhere, and text and `alt`/`aria-label`/`title` inside elements marked `data-replay-mask` (`replayMask` in `src/lib/replay.ts`: the `/build` page and its list tip); it drops App Store icons and requests everywhere, so nothing a visitor blocks on `/build` reaches PostHog. Other pages replay with their text readable. Why: `docs/adr/0004-posthog-proxy-domain.md`.
- Open numbers: `/open` shows the site's numbers to everyone, says what is tracked and asks a sponsor to write to `hi@attentionawareness.com` (Cloudflare Email Routing forwards it; the site sends no mail). The site draws the numbers itself (`OpenNumbers` in `src/components/open-numbers.tsx`: totals, a two-line SVG chart, three lists) from one HogQL query the Worker sends to PostHog's query API (`src/lib/open-numbers.server.ts`), with the Worker secret `POSTHOG_PERSONAL_API_KEY` (a personal API key with `query:read` on the site's project only; `.dev.vars` locally). The route's loader calls the server function `getOpenNumbers`, so the server draws the page with its numbers. PostHog is asked at most once in fifteen minutes (isolate memory, then the Cache API), an older answer is served while PostHog fails, and with none the page links to the public dashboard. That dashboard ("attentionawareness open numbers") has the same filters and is linked under the numbers for checking; every insight on it is public, so it holds counts only. Why: `docs/adr/0007-open-numbers.md`.
- Session replay: OpenPanel records one visit in ten, inputs masked and text readable; it leaves out elements marked `data-replay-mask` and App Store icons (`blockSelector`), since it cannot mask attributes. A new element or portal that shows visitor choices takes `{...replayMask}`. The `/op/$` proxy serves the recorder as `/op/op1-replay.js`, pinned from jsDelivr. Why and the version floor: `docs/adr/0003-session-replay.md`.
- Sentry: client init in `__root.tsx` only when `VITE_SENTRY_DSN` is set.
- StyleX in routes: import `../app.css` (build injection target) — there is no importable `virtual:stylex.css` module; in dev the plugin middleware serves the CSS itself.
- Mac app files: `/mac/appcast.xml` (Sparkle feed, baked into the shipped app), `/mac/latest.json` (read by the download button) and `/mac/attention-awareness-<version>.dmg` come from a private R2 bucket (binding `MAC_FILES`, name in `cloudflare.config.ts`, key = path without the leading slash), answered in `src/server.ts` by `src/lib/mac-files.ts`. The stored dmg is `attention-awareness-<version>-<build>.dmg`; it is saved as `attention-awareness-<version>.dmg`, from the route's `Content-Disposition` and from the download link's `download` attribute (`filename` in `latest.json`, else made from `version`: `src/lib/mac-release.ts`). Why: `docs/adr/0002-mac-files-from-r2.md`. `vite dev` reads a local simulated bucket under `apps/web/.cloudflare/state`; seed it from `apps/web` with `pnpm exec cf r2 objects put mac/latest.json --bucket-name <bucket> --file latest.json --content-type application/json --local --persist-to .cloudflare/state`, where `<bucket>` is the `MAC_FILES` name in `cloudflare.config.ts`. Without `--persist-to`, cf writes to `~/.config/cloudflare/state`, which `vite dev` never reads.
- Mac download counts: `src/server.ts` hands each response to `src/lib/mac-analytics.ts`, which sends the OpenPanel events `mac_download` (a dmg GET answered 200, or 206 from byte 0; properties `version`, `build`, `referrer_host`, `source` sparkle or browser) and `mac_appcast_check` (a feed GET answered 200 or 304; `app_version` from the Sparkle agent) through `ctx.waitUntil`, with the visitor's IP and agent forwarded but never logged. It needs the Worker secrets `OPENPANEL_CLIENT_ID` and `OPENPANEL_CLIENT_SECRET` (a write client of the site's OpenPanel project); without them nothing is sent.

### Deploy

- `pnpm --filter @attentionawareness/web deploy` = `pnpm build`, then `cf deploy --prebuilt`. The Cloudflare Vite plugin (v2) reads `cloudflare.config.ts` and writes the Worker, its assets and the deploy-time config to `.cloudflare/output`; `--prebuilt` ships that output instead of letting cf run its own build. Push to main does the same from CI (`deploy.yml`); the command is for a one-off.
- The v2 plugin runs `docker image ls` at the end of every build to clean up container images, even with no containers. A hung Docker daemon hangs the build there, so `pnpm build` sets `WRANGLER_DOCKER_BIN=/usr/bin/false` to skip the step.
- Always build through `pnpm build` (`NODE_ENV=production vite build --mode production`), never a bare `vite build`. `envDir` is the repo root, whose `.env` sets `NODE_ENV=development`, and Vite applies that whenever `NODE_ENV` is unset. `import.meta.env.DEV` follows `NODE_ENV` rather than mode, so a bare build ships dev-only code (devknobs, the `virtual:stylex` dev stylesheet) to production even though mode already defaults to `production`. `vite.config.ts` throws on any `build` where mode or `NODE_ENV` is not `production`, so this cannot happen silently.
- The build needs no network: `project.inlang/settings.json` loads the inlang message-format plugin from `node_modules` (a pinned devDependency), not from a CDN. When that plugin fails to load, paraglide compiles no messages and every page throws at render, so `build.rolldownOptions.onLog` in `vite.config.ts` fails the build on any undefined import in our own code (Rolldown only warns). `deploy.yml` then runs `scripts/smoke-web.sh` before `cf deploy`: the production preview must answer `/`, `/guide`, `/open`, `/blog` and one post with 200 and the brand in the title.
- `worker.domains` in `cloudflare.config.ts` lists the custom domains: `attentionawareness.com` (canonical), `www.attentionawareness.com`, the old name `keepyourattention.com` + its `www`, and `dikkatfarkindaligi.com` + its `www`. The account comes from `CLOUDFLARE_ACCOUNT_ID` in CI and from the `cf auth login` profile locally. With domains set, cf leaves workers.dev and Preview URLs off (as they are live), so `preview.yml` posts no URL until `previewUrls: true` is set. `canonicalRedirect` (`src/lib/canonical.ts`, called from `src/server.ts`) answers every one but the apex with a 301 to the apex, path and query kept.
- Secrets are set on the Worker, never built in: each is declared with `bindings.secret()` in `cloudflare.config.ts` (the v2 Vite plugin binds only declared names, and `cf deploy` fails until every declared secret is set), then set from `apps/web` with `pnpm exec cf workers secrets update SIGNING_CERT_PEM --worker attentionawareness-web --type secret_text --text "$(cat cert.pem)"`, and the same for `SIGNING_CHAIN_PEM` and `SIGNING_KEY_PKCS8_PEM`. `POSTHOG_PERSONAL_API_KEY` (the `/open` numbers) and the two `OPENPANEL_CLIENT_*` secrets are set the same way. Details in `docs/signing.md`.

### Profile signing

- `POST /api/sign` (`src/routes/api.sign.ts`) takes the reader's config, validates it by hand, forces the identifier (`com.attentionawareness.<uuid>`), the display name and the organization, takes `lockRemoval` from the body (locked unless the reader ticks trial mode), builds the XML with `buildProfile` and returns a CMS-signed DER `.mobileconfig`. Every download is a new profile that stacks: none can loosen or replace one already installed.
- `src/lib/sign.ts` does the CMS `SignedData` with pkijs on the Worker's own WebCrypto. The browser never holds the key, and the signed download is the only way a profile leaves the page.
- Bindings `SIGNING_CERT_PEM`, `SIGNING_CHAIN_PEM`, `SIGNING_KEY_PKCS8_PEM` reach the route through `setSigningSecrets(env)` in `src/server.ts`, because a handler cannot see the Worker `env` on its own. Missing secrets answer `503` and the page says signing is unavailable, so local dev works without them. Details in `docs/signing.md`.

### i18n lint

- All user-facing strings go through Paraglide (`m.*()`). `react/jsx-no-literals` (oxlint, error) forbids hardcoded JSX text and text-bearing attributes (label/placeholder/title/alt/aria-\*); stories and scripts are exempt via overrides. `packages/ui` components take all text as props. Inline `oxlint-disable` only with a justification comment.

## Mac app (`apps/mac`)

- Swift and SwiftUI, macOS 14 and later, Apple Silicon only. `project.yml` is the source of truth; `AttentionAwareness.xcodeproj` is generated by xcodegen and gitignored. The full guide is `apps/mac/README.md`.
- License: AGPL-3.0-only, because the fast method (`Sources/Seed/`) holds material adapted from Nugget, which is AGPL-3.0. Never copy code from `apps/mac` into the MIT parts of the repo. Code taken from another project needs an entry in `apps/mac/THIRD_PARTY_NOTICES.md`, its license text in `apps/mac/Resources/Licenses/` and a note at the type or function.
- Build and test, from `apps/mac`: `bash scripts/build-libimobiledevice.sh` and `bash scripts/vendor.sh` fill `Vendor/` once (gitignored; the second one falls back to Homebrew for a dev build), then `xcodegen generate`, then `xcodebuild test -project AttentionAwareness.xcodeproj -scheme AttentionAwareness -destination 'platform=macOS,arch=arm64'`. The tests need no iPhone and open no window.
- Agents never run the app against a real iPhone: no `--backup`, `--restore`, `--seed`, `--probe` or `--devices`, and no opening the window to drive it. The tests, `--ui-smoke` and `--demo` reach no phone.
- `scripts/release.sh` signs, notarizes and uploads a release. Only the owner runs it.
- The app sends one anonymous event, `supervision_finished`, when a supervision finishes, and nothing else, ever. A debug build sends nothing. The body and what is never sent: `docs/adr/0009-mac-app-one-anonymous-event.md` and `apps/mac/README.md`. A new event or a new property needs a new ADR.
- CI does not build the Mac app. The JS checks ignore `apps/mac` (`pnpm-workspace.yaml`, `oxlint.config.ts`, `oxfmt.config.ts`, `lefthook.yml`).

## Testing

Web: `pnpm --filter @attentionawareness/web test` runs `node --test` on `src/**/*.test.ts` (no test library). CI runs it (`pnpm exec turbo run test`). Otherwise the web side has no tests (decision 2026-09-13: iterate on the product first). The one exception is `src/lib/replay.test.ts`, which pins the session replay masking, because it guards visitor privacy.

Test the site in Safari on iOS, not only in Chromium. A change to the header, to a filter or to anything drawn with `filter`, `backdrop-filter`, a mask or a view transition gets a look in the iOS Simulator before it ships: Safari on iOS draws some of these wrong where desktop Chrome, desktop Safari and Playwright's WebKit all draw them right, so no browser test in CI sees it. `node scripts/safari-check.ts <url of a running production preview>` opens the pages in the Simulator's Safari and fails when the top corner of one is black (a Mac with Xcode only, so it is a manual check and CI does not run it). The case it guards: a filter with `feDisplacementMap` on an element drawn in the page's own layer leaves a black box at the top of the page, over the header, while that element is off screen. The letter is a layer of its own for that reason (`rootLetter` in `src/components/bill-paper.tsx`); a new element with such a filter that is in the page from the start needs the same.

## Dev workflow

- `pnpm dev` runs mprocs with two panes: web and storybook. Quit with `q`; panes restart individually with `r`.
- When everything is broken for no reason: `pnpm bad-day` (kills dev processes, removes every node_modules/cache/generated dir, prunes the pnpm store, reinstalls). Preview with `DRY_RUN=1 pnpm bad-day`.
- Claude Code hooks (`.claude/settings.json`): every Write/Edit is auto-formatted (oxfmt) and auto-fixed (oxlint) on save; a Stop hook runs `pnpm typecheck` and blocks the stop if types are broken.
- Agent skills for the stack live in `.claude/skills/` (committed, pinned by `skills-lock.json`). Maintenance: `npx skills update` refreshes them; `pnpm skills:check` warns when a dep's installed major drifts from what its skill was last verified against (`skills.versions.json`) — after a major dep bump, update the skill, re-verify, bump `checkedMajor`. MCP servers are pinned by exact version in `.mcp.json`.
- Renovate bumps deps (minor/patch grouped weekly, majors gated behind the dependency dashboard).

## CI/CD

- **CI** (`.github/workflows/ci.yml`, PRs + main): `checks` job = turbo lint/typecheck/build + `format:check` + `skills:check` + react-doctor (warnings shown, errors fail). Turbo remote cache activates when `TURBO_TOKEN`/`TURBO_TEAM` are configured.
- **Deploy** (`deploy.yml`, push to main): web builds, `scripts/smoke-web.sh` checks that it renders, then `cf deploy --prebuilt` ships it to Cloudflare Workers (+ optional Sentry sourcemaps).
- **Previews** (`preview.yml`): every PR uploads a Workers preview version with `cf workers versions create --prebuilt` and comments the URL (none while Preview URLs are off).
- Required repo config lives in README's "Going to production" checklist. CI must be green before merge; cubic reviews every PR.

## Rules

- Never edit generated directories: `apps/web/src/paraglide/`, `apps/web/src/routeTree.gen.ts`.
- The site stays client-first: no auth, no database, no billing. Server code is the exception, not the pattern: today the OpenPanel proxy, the read of the `/open` numbers, whose PostHog key must stay on the Worker, and the profile signer, which exists only because the signing key must never reach the browser.
- No new dependencies, components, or abstractions without a concrete current need.
- Secrets never enter git. Local uses `.env` (from `.env.example`) and, for Worker bindings, the repo-root `.dev.vars` (from `.dev.vars.example`); prod uses `cf workers secrets update`. The signing certificate and its private key (`SIGNING_CERT_PEM`, `SIGNING_CHAIN_PEM`, `SIGNING_KEY_PKCS8_PEM`) live there and nowhere else.
- Conventional commits, enforced by commitlint. PRs only against `main`; CI must be green.
- Stack decisions are recorded in `docs/adr/`. Change of direction = new ADR.
