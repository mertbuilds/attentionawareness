# ADR-0003: Session replay

Date: 2026-10-02. Status: accepted.

Amended by ADR-0004: PostHog replay runs alongside this one, and on `/build` attributes do carry visitor data (the apps and sites they block), which this recorder cannot mask. Amended on 2026-10-04: text is readable outside the parts that show visitor choices, and this recorder leaves those parts out.

## Why

Page views say where visitors drop off, not why. A recording of the visit shows what they read and where they stopped.

## Decision

- OpenPanel session replay is on for 10% of visits (`sampleRate: 0.1`). The options are `openPanelReplay` in `src/lib/replay.ts`; the `init` call in `src/routes/__root.tsx` writes them in.
- Inputs are masked everywhere (`maskAllInputs`).
- Text is not masked (`maskAllText: false`). Outside `/build` the site shows only its own copy, and a masked replay could not be read.
- Every element that shows the apps or sites a visitor chose carries `data-replay-mask`: the `<main>` of `/build`, and the tip that lists all of them, which opens in a portal outside `<main>`. This recorder cannot mask attributes, so `blockSelector` leaves those elements out: the replay shows an empty box of the same size, and no text, attribute, icon or later change inside it is recorded. App Store icons are blocked anywhere.
- Masking follows marked elements, not the address, so a portal opened from `/build` stays covered.
- The recorder loads through the `/op` proxy (`src/routes/op.$.ts`) as `/op/op1-replay.js`, for the same reason as `op1.js`: a blocker that knows the vendor's host drops the script.
- The proxy fetches the recorder from jsDelivr, pinned to `@openpanel/web@1.4.1` (`dist/src/replay.global.js`), and answers with `cache-control: public, max-age=14400`, as the self-host does for `op1.js`. The self-host at `analytics.vinena.studio` answers `/op1-replay.js` with a 307 to `/login`, and the `openpanel.dev` copy is unpinned latest, sent with `max-age=0` and never revalidated through the proxy, so every sampled page load fetched 185 KB.
- Replay chunks go through `/op/track` like every other event, with the same crawler filter.

## Compatibility

- The self-host serves the `@openpanel/web` tracker as `op1.js` (1.1.0 when this was written; it reported 1.4.1 on 2026-10-04). Both load the recorder and call `window.__openpanel_replay.startReplayRecorder(this.options.sessionReplay, onChunk)`, so every `sessionReplay` key reaches the recorder untouched.
- The 1.4.1 recorder reads `maskAllInputs`, `maskAllText`, `unmaskTextSelector`, `blockSelector`, `blockClass` and `ignoreSelector`, and passes `blockSelector` to rrweb as is. It takes no `maskTextSelector` of its own (with `maskAllText: false` it is fixed to `[data-openpanel-replay-mask]`) and no attribute mask, which is why the marked parts are blocked rather than masked.
- Masking needs a recorder at 1.3.0 or newer: the 1.1.0 bundle ignores `maskAllText`. A version bump must keep that floor and keep `blockSelector`.
- Outside the marked parts, attributes such as `alt` and `aria-label` are not masked. They hold static site copy, not visitor data.

## Consequences

- Recordings stay on the self-host for 30 days. Lower it to 7 if storage grows.
- A new recorder version is a deliberate edit of the pinned URL, never a silent upstream change.
- OpenPanel replays of `/build` show the layout around an empty page. PostHog records that page with its text masked.
- A new element that shows visitor choices, or a new portal opened from one, needs `{...replayMask}` from `src/lib/replay.ts`. `src/lib/replay.test.ts` pins the options and the marks on `/build`.
