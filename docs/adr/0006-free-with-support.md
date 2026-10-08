# ADR-0006: Everything is free, and support is by choice

Date: 2026-10-04. Status: accepted.

## Why

The Mac app was sold: one key for one supervision, bought on Polar and checked by the app. The point of the product is that people take addictive feeds off their phones, and a price stops some of them. The work still costs time, and some readers want to give something back.

## Decision

- The Mac app, the manual guide and the browser extension are free. The Mac app dropped its key step in version 0.4.0, which went out with this.
- The code became public with that same release (ADR-0008), in `apps/mac`. The Mac app is under AGPL-3.0: anyone can read, use and change it, and whoever shares a changed version publishes their code too. The site, the browser extension and the shared packages stay MIT. The site names the licences in one FAQ answer and nowhere in its large lines.
- Support is a pay-what-you-want checkout on Polar. The site only links to it: from the support section, the footer and the popup after a download. `src/lib/support.ts` builds the link, and its utm campaign names the place. The site has no billing code, no webhook, no account and no key.
- The popup after a download opens every time a download starts on a computer, and keeps no state. It opens in the same press and offers two ways to support: the checkout, and sharing the site's address.
- After a payment the checkout sends the reader back to `/?thanks=1`. The home page opens a thank-you popup once, with one button to share the site, sends the event `support_completed` with no amount and no id, and takes the mark off the address. The checkout's own marks (`checkout_id`, `customer_session_token`) are taken off the address before any analytics load. The site still knows nothing about the payment itself.

## Consequences

- Nothing the product does waits on a payment.
- A sponsor on the page would be a new decision. The site no longer says it has no ads.
