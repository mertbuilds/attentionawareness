# ADR-0003: Session replay

Date: 2026-10-02. Status: accepted.

## Why

Page views say where visitors drop off, not why. A recording of the visit shows what they read and where they stopped.

## Decision

- OpenPanel session replay is on for 10% of visits (`sampleRate: 0.1`), with `maskAllInputs` and `maskAllText`. The options sit in the `init` call in `src/routes/__root.tsx`.
- The recorder loads through the `/op` proxy (`src/routes/op.$.ts`) as `/op/op1-replay.js`, for the same reason as `op1.js`: a blocker that knows the vendor's host drops the script.
- The proxy fetches the recorder from jsDelivr, pinned to `@openpanel/web@1.4.1` (`dist/src/replay.global.js`), and answers with `cache-control: public, max-age=14400`, as the self-host does for `op1.js`. The self-host at `analytics.vinena.studio` answers `/op1-replay.js` with a 307 to `/login`, and the `openpanel.dev` copy is unpinned latest, sent with `max-age=0` and never revalidated through the proxy, so every sampled page load fetched 185 KB.
- Replay chunks go through `/op/track` like every other event, with the same crawler filter.

## Compatibility

- The self-host serves the `@openpanel/web` 1.1.0 tracker as `op1.js`. It loads the recorder and calls `window.__openpanel_replay.startReplayRecorder(options, onChunk)`, the same interface the 1.4.1 bundle exposes.
- Masking needs a recorder at 1.3.0 or newer: the 1.1.0 bundle ignores `maskAllText`. A version bump must keep that floor.
- Attributes such as `alt` and `aria-label` are not masked. They hold static site copy, not visitor data.

## Consequences

- Recordings stay on the self-host for 30 days. Lower it to 7 if storage grows.
- A new recorder version is a deliberate edit of the pinned URL, never a silent upstream change.
