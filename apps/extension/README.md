# @attentionawareness/extension

The browser extension. It removes the surfaces that farm attention: the "For
you" tab on X, every Shorts shelf on YouTube, Reels and Explore on Instagram.
Nothing else goes. Feeds you chose, messages, notifications and profiles stay
where they are.

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

One content script. It reads the settings, picks the rule file for the host,
appends the reader's own rules for it, and injects a single
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
- On a host reached through a custom rule alone the script injects that CSS and
  nothing else: no path attribute, no poll, no note. There is no site there to
  keep in step with.

## Custom CSS

The options page (the popup's "Custom CSS" link, or the extension's Details
page) is a list of rules: a domain, a switch, and a block of CSS. A domain
covers the host and everything under it, the same match the four built-in
sites use, so `reddit.com` takes `old.reddit.com`. Rules apply on top of the
built-in ones and are stored under `custom`, which is why settings are written
key by key: `storage.sync` caps one item at 8KB, and this is the key that
grows.

- Whatever is typed into the domain field is reduced to the host inside it:
  `https://Reddit.com/r/x` is stored as `reddit.com`. Anything that is not a
  host is refused with a line under the row and never written.
- **A domain outside the four sites asks for that site once.** The manifest
  declares `optional_host_permissions: ["<all_urls>"]` and the page calls
  `chrome.permissions.request` straight out of the blur or the click that
  committed the rule, because the browser only grants one inside a user
  gesture. Refuse it and the rule stays off, saying so under the row; grant it
  and it is granted for good.
- `src/background.ts` is the service worker the grant needs afterwards. On install, on
  startup, when `custom` changes and when a permission is added, it reconciles
  one dynamic registration (`aa-custom`) whose matches are every granted custom
  host, through `chrome.scripting.registerContentScripts`. It skips the four
  static hosts, which the manifest already covers and which would otherwise get
  the script twice, and it skips hosts whose permission is not held, because
  one bad match rejects the whole call. `desiredMatches` in
  `src/lib/registration.ts` is that decision as a pure function, and is what
  the tests cover.
- Edits are debounced 300ms and then written whole; "Saved" appears when the
  write lands. Remove takes two clicks, the second within three seconds, the
  same as the site's own rows.

## The popup

React 19 and StyleX, the same versions and the same unplugin the web app runs,
drawing the shared tokens, the shared theme and the licensed Suisse Intl. 320px
wide: the brand, the master switch, one row per site saying what goes with it,
and two quiet links out. It follows the system colour scheme and nothing else,
because a popup this size has no room to argue about themes.

- Under the footer it says how many custom rules are on, when any are.
- The switches are ours: `<button role="switch" aria-checked>`, named by the row
  they sit in. A checkbox cannot be a switch to a screen reader, and the native
  one paints its off state gray, which the dark theme reads as already off. On
  is the accent orange, shared with the site through
  `@attentionawareness/ui/accent.stylex`.
- Writes are optimistic: the switch moves, then `setSettings` writes the one key
  it changed. `onSettingsChange` keeps the popup level with any other window,
  and corrects it if a write does not land.
- Strings live in `src/lib/strings.ts`, English and sentence case. Paraglide is
  not wired here; one file is all a second language would need.

## Build

Three Vite builds, because neither a content script nor a service worker is a
module: each has to arrive as one self-contained IIFE, and Vite takes one
output format per build.

- `vite.config.ts` builds `popup.html` and `options.html` through React and
  StyleX, plus the manifest and icons copied byte for byte. The two pages share
  one stylesheet (`cssCodeSplit: false`, both importing `src/page.css`): StyleX
  appends its CSS to a single asset of the build's, and split per page one of
  them would come out unstyled.
- `vite.config.content.ts` builds `content.ts` into `dist/content.js`.
- `vite.config.background.ts` builds `background.ts` into `dist/background.js`.

The icons are generated: `node scripts/render-brand.ts` from the repo root
renders them from the licensed Suisse Intl, along with the web app's favicons
and the outlines in `packages/ui/src/brand.ts`.

## Pack it

```sh
pnpm --filter @attentionawareness/extension zip
```

Builds, then writes `attentionawareness-extension-<manifest version>.zip` next
to `dist` — the file a store upload takes. It is packed from inside `dist` with
the system `zip`, so the manifest sits at the root of the archive, and it is
gitignored: the zip is build output, cut fresh from whatever `dist` holds.

## Store

```sh
pnpm --filter @attentionawareness/extension build
pnpm --filter @attentionawareness/extension store:shots
```

`store/` is the Chrome Web Store submission: `listing.md` is every field the
dashboard asks for, ready to paste, `store/README.md` is the order to do it in,
and the three `shot-*.png` are the screenshots the listing takes, 1280x800
each. The policy they point at is `PRIVACY.md`, next to this file.

`store:shots` launches Chromium with `dist` loaded unpacked and writes the
three. The build is not chained: it shoots whatever `dist` holds, so build
first. Two of them are composed, the popup at its own 320px and the options
page at 720px laid on a black canvas, because a store screenshot is 1280x800
and anything narrower comes out stretched. The third is youtube.com itself, and
is the one that can come back thin: the consent wall is a page of Google's, so
the script tries it in English, says what happened and moves on rather than
shooting the wall. A signed out home feed is empty on a fresh profile too, so
when no video tile comes back the shot is taken on search instead, which is
populated signed out and is one of the surfaces the Shorts shelf comes off.

## Test

No automated tests yet. After a build, load `dist` unpacked and walk YouTube,
X and Instagram by hand, then add a custom rule for a new domain and
accept the host prompt.
