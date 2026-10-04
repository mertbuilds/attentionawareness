# ADR-0004: PostHog through our own proxy domain

Date: 2026-10-03. Status: accepted. Supersedes the `/ingest/*` reverse proxy in ADR-0001 and amends ADR-0003. Amended on 2026-10-04: replay masks text only where visitor choices show.

## Why

Page views do not say which steps of the Mac download and the `/build` profile builder visitors take. PostHog Cloud EU gives events, heatmaps, error tracking and replay in one project. A blocker that lists `posthog.com` drops its requests, so the events go through a domain of our own. ADR-0001 planned a Worker route at `/ingest/*` for that; the route left on 2026-09-15 with the move to OpenPanel, and PostHog's managed proxy needs no Worker code.

## Decision

- The project lives in PostHog Cloud EU. The site sends to PostHog's managed reverse proxy at `https://e.attentionawareness.com`, a CNAME in the attentionawareness.com Cloudflare zone, DNS only, so PostHog serves it end to end. `ui_host` stays `https://eu.posthog.com`.
- No Worker route proxies PostHog, and the old `/ingest/*` route does not come back.
- Key and host are build-time values: `VITE_POSTHOG_KEY` and `VITE_POSTHOG_HOST`, GitHub repository variables that `deploy.yml` passes to the build, since Vite bakes them into the bundle. The key is a public project token, so a variable is enough. Locally they come from `.env`. Without both, no provider renders and nothing is sent; previews and CI build without them.
- The provider sits in `src/routes/__root.tsx`.
- `/build` shows the apps and sites a visitor blocks, and none of that may reach PostHog:
  - Autocapture: `mask_all_element_attributes` and `mask_all_text`, so no `attr__*` and no `$el_text`. An element is named by its tag, classes and position.
  - Replay: the options are `posthogReplay` in `src/lib/replay.ts`. Inputs are masked everywhere. Text is masked only inside elements marked `data-replay-mask` (`maskTextSelector: '[data-replay-mask], [data-replay-mask] *'`): the `<main>` of `/build`, and the tip that lists every blocked app and site, which opens in a portal. Inside a marked element, `maskAttributeFn` replaces `alt`, `aria-label` and `title` with `*`; it gets the element as its third argument and checks `closest('[data-replay-mask]')`. App Store icons (`img[src*="mzstatic.com"]`) are blocked and App Store requests (`itunes.apple.com`, `mzstatic.com`) dropped from network capture everywhere. `class` stays visible: `maskAllElementAttributes` would mask it too, and a StyleX page replays unstyled without it.
  - Masking follows marked elements, not the address, so a portal opened from `/build` stays covered. rrweb checks the marker on ancestors for text that changes later, so new text inside a marked element stays masked.
  - On other pages text is readable: they show only the site's own copy. Options set in `posthog.init` win over the project's "Privacy and masking" settings.
  - Custom events carry counts and modes, never the apps or sites themselves.
- The project discards client IP data (project setting "Discard client IP data", checked 2026-10-04: on, and no stored event has an address). PostHog first reads the country, the city, the postal code and rough coordinates from the address, keeps those on the event, and drops the address. The Countries tile on `/open` (ADR-0007) needs that.

## Consequences

- PostHog replay runs alongside OpenPanel's 10% replay (ADR-0003) for now. Removing OpenPanel is a planned follow-up.
- A new element that shows visitor choices, or a portal opened from one, needs `{...replayMask}`. One that shows them in another attribute, or an image from another host, also needs its own mask in `src/lib/replay.ts`.
- A new proxy domain is a new `VITE_POSTHOG_HOST` value and a deploy.
