# Chrome Web Store listing

Every field the developer dashboard asks for, in the order it asks. Paste them
as they are. Screenshots are the PNGs next to this file; the submission order
is in `README.md`.

## Store listing

### Name

```
attention awareness
```

### Summary

Max 132 characters. This one is 111.

```
Hides the feeds that farm your attention on X, YouTube and Instagram, plus any site you write your own CSS for.
```

### Description

Plain text, max 16,000 characters. This one is 1,290.

```
attention awareness removes the surfaces built to hold you, and leaves the rest of the site alone.

What goes

X: the "For you" tab on the home timeline, and trends in the sidebar.
YouTube: every Shorts surface, which is the shelves on home, subscriptions, search and watch, the guide entries, the channel tab and the /shorts/ player itself, plus the Playables shelf.
Instagram: Reels, the Explore grid, the "Suggested for you" blocks and the "For you" tab on the home feed.

What stays

The feeds you chose, stories, messages, notifications, search and profiles. Nothing is deleted and nothing is reordered: the extension injects one stylesheet, and turning it off removes it.

Switches

One master switch turns everything off at once, and one switch per site under it.

Your own CSS

The options page takes a domain and a block of CSS and applies it on top of the built-in rules. A domain covers its subdomains, so reddit.com takes old.reddit.com. A domain outside the three above asks for that one site as you add the rule, and for nothing else.

No accounts. No tracking. No analytics. No servers: your settings live in the browser's own extension storage, and nothing ever leaves the machine.

Open source, MIT: github.com/mertbuilds/attentionawareness

Part of attentionawareness.com.
```

### Category

```
Productivity
```

### Language

```
English
```

## Privacy practices

### Single purpose description

```
attention awareness hides the attention farming feeds on X, YouTube and Instagram, and on any other site the user writes a rule for, by injecting CSS into those pages.
```

### Permission justifications

`storage`

```
The extension stores the user's own settings: the master switch, one switch per site, and the custom CSS rules the user wrote with the domains they belong to. They are kept in chrome.storage.sync so that the same settings follow the user's browser profile between their devices instead of being set up again on each one. Nothing else is stored, and nothing stored is sent anywhere.
```

`scripting`

```
Custom rules are for domains that are not known when the extension is packaged, so its content script cannot be declared for them in the manifest. When the user adds a rule for a new domain and grants access to it, the service worker calls chrome.scripting.registerContentScripts to register that same content script on that domain, and unregisters it when the rule is removed. The three built-in sites are declared statically and are skipped here.
```

Host permissions: `*://x.com/*`, `*://twitter.com/*`, `*://*.youtube.com/*`, `*://*.instagram.com/*`

```
These are the sites the extension ships rules for, and the whole of what it does is inject a stylesheet into them at document_start so the feed is never painted. The content script reads the user's settings, picks the CSS for the host and appends one style element; it does not read page content, does not touch form input, and makes no network request. twitter.com is listed because it still serves X's timeline.
```

`optional_host_permissions: ["<all_urls>"]`

```
This is never requested at install. It is requested only when the user adds a custom CSS rule for a domain of their own, and then only for that one domain: the options page calls chrome.permissions.request with the origin patterns for that host alone, inside the click or blur that committed the rule. Refuse the prompt and the rule stays off. The list is declared as <all_urls> because the domains a user will choose cannot be known in advance; the extension never holds broad access unless a user grants every domain one prompt at a time.
```

### Data usage disclosure

The form on the Privacy tab, answer by answer.

- **What user data do you plan to collect?** None. Leave every category unticked: no personally identifiable information, no health information, no financial information, no authentication information, no personal communications, no location, no web history, no user activity, no website content.
- **Does this item use remote code?** No. All CSS and JavaScript is in the uploaded package. Nothing is fetched, evaluated or injected from a server.
- **Certification 1:** I do not sell or transfer user data to third parties, outside of the approved use cases. Tick.
- **Certification 2:** I do not use or transfer user data for purposes that are unrelated to my item's single purpose. Tick.
- **Certification 3:** I do not use or transfer user data to determine creditworthiness or for lending purposes. Tick.
- Analytics: none. The extension has no telemetry, no crash reporting and no network code of its own.

### Privacy policy URL

```
https://attentionawareness.com/extension/privacy
```

The site is not live yet. Until it is, use the policy in the repo:

```
https://github.com/mertbuilds/attentionawareness/blob/main/apps/extension/PRIVACY.md
```

That URL needs the repository to be public, and the dashboard checks that the
URL answers. Whichever of the two is reachable on submission day is the one to
paste.
