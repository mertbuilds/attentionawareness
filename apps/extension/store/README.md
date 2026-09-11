# Chrome Web Store submission

Everything the dashboard asks for is in `listing.md`, in the order it asks.
This is the order to do it in.

## Before

```sh
pnpm --filter @attentionawareness/extension build
pnpm --filter @attentionawareness/extension store:shots
pnpm --filter @attentionawareness/extension zip
```

`zip` builds again on its own and writes
`apps/extension/attentionawareness-extension-<version>.zip` next to `dist`.
That file is the upload. The screenshots are the three `shot-*.png` here,
1280x800 each.

Bump `version` in `src/manifest.json` before packing anything the store has
already seen. The store refuses an upload whose version is not higher than the
one published.

## Checklist

1. **Developer account.** <https://chrome.google.com/webstore/devconsole>, a
   one time $5 registration fee, paid with a Google account. Do this first: the
   fee clears before anything can be uploaded, and the account is also what a
   reviewer writes back to.
2. **Upload the zip.** New item, then the zip the block above wrote. The
   manifest sits at the root of the archive, which is what the store expects.
3. **Paste the listing fields.** Store listing tab: name, summary, description,
   category (Productivity), language (English). Every one of them is a code
   block in `listing.md`.
4. **Upload the screenshots.** Up to five; there are three here. Order them
   `shot-1-popup.png`, `shot-2-youtube.png`, `shot-3-options.png`: the popup is
   the one that explains the extension in a glance, so it goes first and is the
   tile the store shows.
5. **Set the privacy policy URL.** Privacy tab. The URL in `listing.md`, and it
   has to answer when the reviewer opens it.
6. **Fill the data usage form.** Same tab: no data collected, no remote code,
   and the three certification boxes. The answers are in `listing.md`.
7. **Submit for review.** Publishing is automatic on approval unless it is set
   to manual, which is worth setting if the site should go live first.

## After

Review takes one to three days for most items.

Expect this one to take the long end of that, or to come back with a question.
It asks for host access to four sites and declares
`optional_host_permissions: ["<all_urls>"]`, and broad host access is what
sends an extension to a human reviewer. The justification for every permission
is written out in `listing.md`, one paragraph each, in the words the form
wants: paste them rather than writing them again, and if a reviewer asks, the
answer is that `<all_urls>` is never requested at install and only ever granted
one domain at a time, by the reader, as they add a rule.
