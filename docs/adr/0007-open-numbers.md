# ADR-0007: The site's numbers are public, on `/open`

Date: 2026-10-04. Status: accepted. Amends ADR-0006, which left a sponsor as a new decision.

## Why

The Mac app is free (ADR-0006), so the site earns nothing by itself. If the traffic is good, a brand or a person can sponsor the site. A sponsor wants to see the traffic first, and a reader should see what the site counts about them. Both are answered by one page that shows the real numbers to everyone.

## Decision

- `/open` shows the numbers, says what the site tracks, and asks a sponsor to write. The link is a `mailto:`, and a click on it is the PostHog event `sponsor_clicked` (`placement`: open). No sponsor is on the site yet; the first one is still a decision of its own.
- The numbers are a shared PostHog dashboard in a frame: "attentionawareness open numbers" (dashboard 995524 in the EU project). Its address is `VITE_OPEN_DASHBOARD_URL`, `https://eu.posthog.com/embedded/<token>`, a build-time value wired like the PostHog key: a GitHub repository variable that `deploy.yml` passes to the build, `.env` locally. The sharing token is public by design. Without the value the page says the numbers are not public yet.
- Every insight on the dashboard is a count over the last 30 days, filtered to the host `attentionawareness.com`: visitors, page views, both by day, referring domains, paths, countries, `mac_download_started`, `support_clicked`, and guide and blog reads. No person properties, no addresses, no replays, and nothing from the profile builder's events. A new insight on that dashboard is public the moment it is added, so it has to meet the same rule.
- `OpenNumbers` (`src/components/open-numbers.tsx`) is the only code that knows of the frame. It passes the page's theme as `?theme=`, takes its height from the `posthog:dimensions` message the dashboard posts, and treats that message as the sign that the frame loaded. A frame that stays silent for ten seconds gives way to a line with a link to the dashboard, since a blocker that lists posthog.com stops the frame.

## Options

- A server function on the Worker that asks PostHog's query API with a personal API key, cached at the edge, drawn with the site's own components. It looks native and no blocker stops it. It needs a secret on the Worker, a cache, and charts of our own, and the site stays client-first (AGENTS.md). Not now.
- The frame. No server code, no secret, live, and PostHog draws the charts. It is another site's frame: it does not wear the site's type, and a blocker can stop it.

The frame is the simplest thing that works. The page around `OpenNumbers` knows nothing of PostHog, so the first option can take its place later without a change to the route.

## Consequences

- A reader with a blocker sees a link, not numbers.
- The frame loads from eu.posthog.com, so PostHog sees the address of a reader who opens `/open`.
- The route is its own chunk, and the frame is only on that page, so no other page loads more for it.
- The sponsor address in `src/routes/open.tsx` has to be a mailbox that is read.
