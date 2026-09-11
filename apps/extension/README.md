# @attentionawareness/extension

The browser extension. It removes the surfaces that farm attention: the "For
you" tab on X, every Shorts shelf on YouTube, Reels and Explore on Instagram,
all of TikTok. Nothing else goes. Feeds you chose, messages, notifications and
profiles stay where they are.

Chromium (MV3) first, because that is what Brave is. Nothing here is
Chromium-only, so Firefox stays possible.

## Load it

```sh
pnpm --filter @attentionawareness/extension build
```

Then, in Brave (`brave://extensions`) or Chrome (`chrome://extensions`):

1. Turn on **Developer mode**, top right.
2. **Load unpacked**, and choose `apps/extension/dist`.
3. Open x.com or youtube.com. The rules apply at `document_start`, so there is
   nothing to reload.

After a rebuild, hit **Reload** on the extension card. Settings live in
`chrome.storage.sync`, so they survive the reload and follow the profile.

## How it works

One content script, no background service worker, no `scripting` permission.
It reads the settings, picks the rule file for the host, and injects a single
`<style id="aa-rules">` into `document.documentElement`. Turning a switch off
removes that element; nothing is undone, because nothing was done to the page.

- `src/rules/*.css`, one file per site, plain CSS, `!important` throughout.
  Each file opens with what it hides, why its selectors are the ones that
  survive the site's churn, and the date it was last checked against the live
  DOM. These sites change their markup; the date is how you know what to
  re-check.
- Rules that depend on the path (Instagram's `/reels`, YouTube's `/shorts`)
  read `html[data-aa-path]`, which the content script keeps in step with
  `location.pathname`. All four sites are single page apps, and a content
  script runs in an isolated world where patching `history` would only patch
  its own copy, so the path is polled twice a second alongside `popstate`.
- The rule files are bundled as strings (`?raw`), not fetched. A fetch races
  the first paint, and a fetchable file has to be web accessible, which hands
  every page a way to ask whether the extension is installed.
- `src/lib/storage.ts` is the only thing that touches `chrome.storage.sync`.
  Everything read back is checked key by key against the defaults, because
  storage is shared with every other version of the extension the profile has
  ever run.

## Build

Two Vite builds, because a content script is not a module: it has to arrive as
one self-contained IIFE, and Vite takes one output format per build.

- `vite.config.ts` builds `popup.html` and `options.html`, plus the manifest and
  icons copied byte for byte.
- `vite.config.content.ts` builds `content.ts` into `dist/content.js`.

The icons are generated: `node scripts/render-brand.ts` from the repo root
renders them from the licensed Suisse Intl, along with the web app's favicons
and the outlines in `packages/ui/src/brand.ts`.

## Test

```sh
pnpm --filter @attentionawareness/extension test   # vitest
pnpm --filter @attentionawareness/extension e2e    # playwright, needs a build
```

The unit tests cover the settings merge, host matching, the CSS the builder
composes, and that every rule file parses with zero errors. A rule file that
does not parse is one the browser drops silently, leaving the feed where it
was.

The smoke test is the real thing: it launches Chromium with `dist` loaded
unpacked, serves YouTube's Shorts markup from an intercepted route, asserts the
shelf is hidden, flips the master switch from the extension's own page, and
asserts it comes back.
