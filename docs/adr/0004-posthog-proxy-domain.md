# ADR-0004: PostHog through our own proxy domain

Date: 2026-10-03. Status: accepted. Supersedes the `/ingest/*` reverse proxy in ADR-0001 and amends ADR-0003.

## Why

Page views do not say which steps of the Mac download and the `/build` profile builder visitors take. PostHog Cloud EU gives events, heatmaps, error tracking and replay in one project. A blocker that lists `posthog.com` drops its requests, so the events go through a domain of our own. ADR-0001 planned a Worker route at `/ingest/*` for that; the route left on 2026-09-15 with the move to OpenPanel, and PostHog's managed proxy needs no Worker code.

## Decision

- The project lives in PostHog Cloud EU. The site sends to PostHog's managed reverse proxy at `https://e.attentionawareness.com`, a CNAME in the attentionawareness.com Cloudflare zone, DNS only, so PostHog serves it end to end. `ui_host` stays `https://eu.posthog.com`.
- No Worker route proxies PostHog, and the old `/ingest/*` route does not come back.
- Key and host are build-time values: `VITE_POSTHOG_KEY` and `VITE_POSTHOG_HOST`, GitHub repository variables that `deploy.yml` passes to the build, since Vite bakes them into the bundle. The key is a public project token, so a variable is enough. Locally they come from `.env`. Without both, no provider renders and nothing is sent; previews and CI build without them.
- The provider sits in `src/routes/__root.tsx`.
- `/build` shows the apps and sites a visitor blocks, and none of that may reach PostHog:
  - Autocapture: `mask_all_element_attributes` and `mask_all_text`, so no `attr__*` and no `$el_text`. An element is named by its tag, classes and position.
  - Replay: inputs and all text masked; `alt`, `aria-label` and `title` replaced by `*` through `maskAttributeFn`; App Store icons (`img[src*="mzstatic.com"]`) blocked; App Store requests (`itunes.apple.com`, `mzstatic.com`) dropped from network capture. `class` stays visible: `maskAllElementAttributes` would mask it too, and a StyleX page replays unstyled without it.
  - Custom events carry counts and modes, never the apps or sites themselves.

## Consequences

- PostHog replay runs alongside OpenPanel's 10% replay (ADR-0003) for now. Removing OpenPanel is a planned follow-up.
- A new element that shows visitor data in another attribute, or an image from another host, needs its own mask in the provider options.
- A new proxy domain is a new `VITE_POSTHOG_HOST` value and a deploy.
