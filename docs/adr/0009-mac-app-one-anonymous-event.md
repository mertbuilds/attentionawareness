# ADR-0009: The Mac app sends one anonymous event

Date: 2026-10-04. Status: accepted.

## Why

- The Mac app is free from version 0.4.0, so no purchase says that a supervision went through. The owner wants to see that supervisions finish.
- One count answers that. More than one count is not needed, so nothing more is sent.

## Decision

- The app sends one event, `supervision_finished`, when the person presses It's Supervised at the end of the job. That is the moment the supervision finished. One run sends one event.
- Nothing else is ever sent: no event at launch, none on a failure or a cancel, no heartbeat, no retry.
- The event goes to the site's PostHog project through the proxy `https://e.attentionawareness.com/i/v0/e/` (ADR-0004), with the public client key the website already ships.
- The request has a timeout of 5 seconds. A failure is silent and changes nothing in the wizard. Nothing is queued on disk.
- A debug build sends nothing. So the demo (`--demo`), the tests and the offscreen smoke (`--ui-smoke`) send nothing. Only a Release build of the real window sends.
- The app says so on the Ready screen and in the About window, and `apps/mac/README.md` shows the body.
- There is no switch to turn it off. The count names nobody, and a switch would add a setting and a stored choice to an app that stores nothing else. Anyone who wants none can block `e.attentionawareness.com` or build from source.

## The body

```json
{
  "api_key": "phc_DfvN33UTDFBHJfUfC46o4aKL33aGLR7qEmEJYfWjh9gi",
  "event": "supervision_finished",
  "distinct_id": "<a new random UUID for every event>",
  "properties": {
    "app_version": "0.4.0",
    "method": "full_copy",
    "ios_major": 26,
    "macos_major": 15,
    "$process_person_profile": false,
    "$geoip_disable": true
  }
}
```

- `method` is `full_copy` or `fast`.
- `ios_major` is the first number of the iOS version. It is left out when the iPhone gave no version.
- `distinct_id` is made new for each event and is not stored, so two events cannot be tied to each other or to a person.
- `$process_person_profile: false` tells PostHog to make no person profile. `$geoip_disable: true` tells PostHog to work out no place from the address of the request.

## What is never sent

- Nothing that names the iPhone: no UDID, no serial number, no name, no model, no full iOS version.
- Nothing about the restrictions: no apps, no sites, no counts of them.
- Nothing that names the Mac or the person: no stored id, no email, no user name.

## What we cannot promise

- Every request carries the IP address of the Mac. The proxy and PostHog see it in transit.
- Whether PostHog stores that address with the event is a setting of the PostHog project ("IP data capture"), not something the app controls. It must be set to discard for the count to hold no address.
