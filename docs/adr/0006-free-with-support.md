# ADR-0006: Everything is free, and support is by choice

Date: 2026-10-04. Status: accepted.

## Why

The Mac app was sold: one key for one supervision, bought on Polar and checked by the app. The point of the product is that people take addictive feeds off their phones, and a price stops some of them. The work still costs time, and some readers want to give something back.

## Decision

- The Mac app, the manual guide and the browser extension are free. The Mac app drops its key step in the release that goes out with this. The site does not say free before that release is out.
- The code is public with that same release, and the site says it is open source only from then. The Mac app is under AGPL-3.0: anyone can read, use and change it, and whoever shares a changed version publishes their code too. The site, the browser extension and the shared packages stay MIT. The site names the licences in one FAQ answer and nowhere in its large lines.
- Support is a pay-what-you-want checkout on Polar. The site only links to it: from the support section, the footer and the popup after a download. `src/lib/support.ts` builds the link, and its utm campaign names the place. The site has no billing code, no webhook, no account and no key.
- The popup after a download opens every time a download starts on a computer, and keeps no state. It opens in the same press and offers two ways to support: the checkout, and sharing the site's address.
- The footer shows how many stars the repo has. The reader's browser asks GitHub's public API for it, with no token, and only once the footer is close to the window. A count GitHub gave is kept for the tab's session. A failed answer is not kept. The Worker takes no part in it.

## Consequences

- Nothing the product does waits on a payment.
- GitHub sees the address of a reader whose footer comes near the window. Its limit for requests without a token is per address and per hour. Past it, the count is left off the page.
- A sponsor on the page would be a new decision. The site no longer says it has no ads.
