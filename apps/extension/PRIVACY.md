# Privacy

attention awareness collects nothing.

## What it stores

Your settings: the master switch, the four site switches, and any custom CSS
rules you wrote along with the domains they belong to. They live in the
browser's own extension storage (`chrome.storage.sync`). If you are signed into
the browser, the browser syncs them between your own profiles, the same way it
syncs bookmarks. Nobody else can read them, and neither can we.

## What it sends

Nothing. The extension has no server, no account and no network code of its
own. There is no analytics, no telemetry, no crash reporting and no remote
code: every rule it applies is a CSS file inside the package you installed.

## What it does to a page

It injects one stylesheet, which hides the elements the rules for that site
name. It does not read the page, does not touch what you type, and does not see
who you are signed in as. Turn a switch off and the stylesheet is removed.

## Custom rules

CSS you write on the options page is stored with the rest of your settings and
applied to the domain you named. It stays on your machine.

## Permissions

Host access to x.com, twitter.com, youtube.com and instagram.com is
what lets the stylesheet reach those pages. A rule for any other domain asks
for that one domain as you add it, and the extension registers its content
script only on the domains you granted.

## Contact

mert@duzgun.dev, or an issue at
<https://github.com/mertbuilds/attentionawareness/issues>.

Last updated 2026-09-12.
