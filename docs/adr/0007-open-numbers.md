# ADR-0007: The site's numbers are public, on `/open`

Date: 2026-10-04. Status: accepted. Amends ADR-0006, which left a sponsor as a new decision.

## Why

The Mac app is free (ADR-0006), so the site earns nothing by itself. If the traffic is good, a brand or a person can sponsor the site. A sponsor wants to see the traffic first, and a reader should see what the site counts about them. Both are answered by one page that shows the real numbers to everyone.

## Decision

- `/open` shows the numbers, says what the site tracks, and asks a sponsor to write. The link is a `mailto:`, and a click on it is the PostHog event `sponsor_clicked` (`placement`: open). No sponsor is on the site yet; the first one is still a decision of its own.
- The site draws the numbers itself, from what the Worker reads from PostHog. The first version showed a shared PostHog dashboard in a frame; the owner did not want PostHog's own look inside the site, so the frame left the same day.
- The read is one HogQL query to PostHog's query API (`src/lib/open-numbers.server.ts`), with a personal API key that can only read queries of the site's project: the Worker secret `POSTHOG_PERSONAL_API_KEY`. The key never leaves the Worker. The route's loader calls a server function (`src/lib/open-numbers-fn.ts`), so the page arrives with its numbers in it and works without scripts.
- The query counts what the public dashboard "attentionawareness open numbers" (995524 in the EU project) counts, with its filters: page views on the host `attentionawareness.com`, from the first second of the day 30 days ago to now, in UTC, and visitors as distinct persons. It adds `mac_download_started`, guide and blog reads, and the bounce rate and average length of the visits that hold those page views, from PostHog's `sessions` table. Support clicks and the Mac app's `supervision_finished` are still sent but no longer shown (2026-10-05). Totals only: no person, no address, nothing from the profile builder's events. The referrer list leaves out the site itself and PostHog's own pages, which the dashboard shows.
- PostHog is asked at most once in fifteen minutes. The answer is held by the isolate and in the Cache API of its data centre, and requests that arrive during an ask wait for that one. A failed ask serves the answer from before for another fifteen minutes. With none to serve, the page says the numbers did not load and links to the dashboard, and PostHog is asked again after a minute. No KV namespace: the Cache API does the job.
- Under the numbers the page says how old they are and links to the shared dashboard, so anyone can check them against PostHog: `https://eu.posthog.com/shared/<token>`, a constant in `src/lib/open-numbers.ts`. The sharing token is public by design. A click is the event `open_dashboard_clicked` (`placement`: numbers or failed). A new insight on that dashboard is public the moment it is added, so it has to hold counts only.
- The chart is two lines of inline SVG drawn by our own code, with the same values in a table for a reader who cannot see it. No chart library.

## Consequences

- The site has a third piece of server code, beside the OpenPanel proxy and the profile signer, and one more secret that has to be set before `cf deploy`.
- The cache is per data centre, so "once in fifteen minutes" holds for each one. The site's traffic is far under PostHog's query limits either way.
- The numbers are up to fifteen minutes old, and older while PostHog does not answer. The page says how old.
- The route is its own chunk, so no other page loads more for it.
- The sponsor address is `hi@attentionawareness.com`, which Cloudflare Email Routing forwards to the owner's inbox. The site sends no mail of its own.
