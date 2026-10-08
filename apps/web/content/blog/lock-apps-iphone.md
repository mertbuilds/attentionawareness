---
title: 'How to lock apps on an iPhone, from others or yourself'
description: 'Lock an iPhone app with Face ID, hide it, or pin the phone to one app. Then how to lock an app away from yourself, where Face ID and Screen Time fail.'
og_title: 'Lock apps on an iPhone, **from others or yourself**'
slug: lock-apps-iphone
date: 2026-10-08
primary_keyword: 'how to lock apps on iphone'
reading_minutes: 9
read_next: block-any-app-iphone, why-screen-time-does-not-work
---

"Lock an app" means two different things. Most people want to lock an app from other people: touch and hold the app icon on the Home Screen, tap Require Face ID, then tap Require Face ID again. That works on iOS 18 and later. Some people want to lock an app away from themselves or their child, so it does not open at all. Face ID cannot do that, because you are the face.

The first half of this post is about other people. The second half is about you. Apple renamed parts of Screen Time in iOS 27. I use the iOS 27 names and give the old name the first time.

## Lock an app with Face ID, Touch ID or your passcode

Apple added this in iOS 18. A locked app asks for Face ID, Touch ID or your passcode each time it opens.

1. Go to the Home Screen and find the app.
2. Touch and hold the app icon until the menu opens.
3. Tap Require Face ID. On an iPhone without Face ID, the line says Require Touch ID or Require Passcode.
4. Tap Require Face ID again, then look at the iPhone to confirm.

To open the app, tap it and look at the iPhone. Apple says the app "locks again automatically after you quit it."

### What a locked app hides

The lock covers more than the app's first screen. Apple says that information inside a locked app does not appear in other places on the iPhone. Its examples are CarPlay, notification previews, search, Siri suggestions and your call history.

The icon stays on the Home Screen, so anyone who holds the phone can see that you have the app. To take the icon away too, hide the app.

### Which apps cannot be locked

Apple's page for iOS 18 says that some of the apps that come with iPhone cannot be locked. It names Calculator, Camera, Clock, Contacts, Find My, Maps, Shortcuts and Settings, and does not say the list is complete. Apple's page for iOS 27 does not repeat the list, so I cannot say if it changed. To check an app, touch and hold its icon. If the menu has no Require Face ID line, you cannot lock that app.

Two more limits from Apple:

- A child under 13 in a Family Sharing group cannot lock or hide apps. Apple notes that the age varies by country or region.
- The lock stays on that iPhone. Apple says the locked or hidden status of an app "doesn't sync with iCloud." Your iPad needs its own lock.

## Hide an app and require Face ID

Hiding locks the app and takes its icon off the Home Screen.

1. Touch and hold the app icon until the menu opens.
2. Tap Require Face ID.
3. Tap Hide and Require Face ID, confirm with Face ID, then tap Hide App.

Apple's page for iOS 27 says that hiding an app "removes it from the Home Screen, App Library, and search results." The app moves to a Hidden folder at the bottom of App Library. To open it, swipe left past all your Home Screen pages, tap the Hidden folder, and confirm with Face ID.

What you cannot hide: Apple says apps that come installed cannot be hidden. Only apps you download from the App Store can.

What still shows: the name of a hidden app can appear in other places. Apple's page for iOS 18 names Screen Time, the battery use list in Settings and your App Store purchase history. There is also a list in Settings > Apps > Hidden Apps, behind Face ID.

## Older ways and special cases

### Guided Access: hand the phone over with one app open

This is the opposite of locking an app. Guided Access keeps the iPhone in the app that is on the screen until you end the session. Use it when you hand your phone to a child for one video.

1. In Settings, open Accessibility, then Guided Access, and turn it on.
2. Tap Passcode Settings, then Set Guided Access Passcode. You can also turn on Face ID here to end a session.
3. Open the app. Start Guided Access with the Accessibility Shortcut, with Siri, or from Control Center if you added it there. Tap Start.

To end it, triple-click the side button (or the Home button) and enter the passcode. Apple warns that Crash Detection and emergency calls are not available during a session.

### A Screen Time limit with a passcode

Before iOS 18, people used Screen Time to put a code on an app. You set a short daily limit on the app, then set a Screen Time passcode. When the time is used up, the app asks for the passcode.

It is a weak lock against other people. The app opens freely until the time is used up. On iOS 27, Time Allowances (called App Limits before iOS 27) are set for a category of apps, not for one app. The steps for each version are in [how to block an app on an iPhone](/blog/block-any-app-iphone).

It has one use the Face ID lock does not have: another person can set the passcode. More on that below.

### The Shortcuts automation trick

Older guides describe a Shortcuts automation that runs when you open an app and sends you back to the Lock Screen. Apple's Shortcuts guide describes the trigger: App, with an Is Opened option that runs "when you open or switch to the selected app." I did not find the action that locks the screen in Apple's guide, so I give no steps for it. On iOS 18 and later, Require Face ID does the same job.

### Locks inside apps

Some apps have their own lock: a setting that asks for Face ID when the app opens. Banking and messaging apps are the usual places to find one. Look in the app's own settings. On iOS 17 and earlier, which has no Require Face ID, this is the way to lock one app from other people.

## The ways, side by side

| Way                                                   | Who it stops                                                                    | How it is undone                                                                  |
| ----------------------------------------------------- | ------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| Require Face ID                                       | Other people who hold your unlocked iPhone. Not someone who knows the passcode. | Touch and hold the icon, tap Don't Require Face ID.                               |
| Hide and Require Face ID                              | The same people, and they do not see the icon.                                  | In the Hidden folder, touch and hold the app, tap Don't Require Face ID.          |
| Guided Access                                         | The person you hand the phone to. They stay in one app.                         | Triple-click the side button and enter the Guided Access passcode.                |
| A Screen Time limit with a passcode                   | Anyone without the passcode, after the time is used up.                         | Enter the passcode, or reset it with the Apple Account set for recovery.          |
| A lock inside the app                                 | Other people, in that one app.                                                  | Turn it off in the app's settings.                                                |
| Blocked by app on a supervised iPhone, locked profile | Everyone, you included. The app does not open.                                  | Not on the iPhone itself. Erase the iPhone, or use a Mac with Apple Configurator. |

## How to lock an app away from yourself

Here "lock" means the app stays closed, also when you want it open. None of the ways above does that for the owner of the phone.

**Face ID lock.** It opens for your face, and your face is always with you. If Face ID fails, your passcode opens it.

**A Screen Time limit.** Apple's guide for iOS 26 says: "By default, Screen Time limits can be ignored once reached." The limit screen has an Ignore Limit button. A Screen Time passcode removes that button, but you chose the passcode.

**A passcode a friend sets.** This is the strongest setup Screen Time has. It holds until you reset the passcode with your Apple Account, which Apple allows when Screen Time Passcode Recovery is set up with your account. The full list of ways out is in [why Screen Time doesn't work](/blog/why-screen-time-does-not-work).

Each of these locks is opened by something you have: your face, your passcode or your Apple Account. A lock holds against you only when nothing on the iPhone opens it.

## The permanent way: remove the app on a supervised iPhone

Supervised mode is the Apple mode that schools and companies use for their iPhones. A supervised iPhone accepts a profile with a list of blocked apps. Apple's documentation says: "the device hides only the apps you specify and prevents them from running."

- The app is not on the Home Screen and cannot be opened. It asks for no face and no passcode.
- The app's data stays on the phone.
- You can keep the App Store. A blocked app can still download from the App Store, but it stays hidden and does not open.
- The same profile can block the app's website, so Safari is closed too.
- You can lock the profile. Then nobody can remove it on the iPhone itself.

There are two free ways to set this up.

**The free Mac app.** [attention awareness](/) supervises your iPhone over a cable without erasing it. It sends a small set of settings to the iPhone and restarts it. Your photos, messages and apps stay. Back up your iPhone first, with Finder or iCloud. Then you pick the apps and websites, and the app installs the profile. You need a Mac with Apple silicon and macOS 14 or later. It works on iOS 27 and earlier. It is open source, with no account and no app on the iPhone.

**Manually via Apple Configurator.** The [manual guide](/guide) does the same with Apple Configurator on a Mac. It erases the iPhone first. Only what syncs to iCloud comes back.

Start in trial mode. In trial mode you can remove the profile in Settings. When the list is right, plug in once more to lock it.

I use this on my own iPhone. If you want to remove most apps, not one, see [how to turn an iPhone into a dumbphone](/blog/turn-iphone-into-dumbphone). For a child's iPhone, start with [iPhone parental controls kids cannot turn off](/blog/iphone-parental-controls-kids-cannot-turn-off).

## What this cannot do

- Require Face ID does not stop a person who knows your iPhone passcode. The passcode opens every locked app.
- Some built-in apps cannot be locked, and built-in apps cannot be hidden.
- A supervised block has no hours. A blocked app is closed all day, every day.
- A locked profile cannot be removed for one evening. If you want that, stay in trial mode.
- The permanent way needs a Mac.
- It is not a treatment. It only removes the app.

## How to undo each lock

- **Require Face ID:** touch and hold the app icon, tap Don't Require Face ID, then confirm with Face ID.
- **A hidden app:** open App Library, tap the Hidden folder and confirm with Face ID. Touch and hold the app, then tap Don't Require Face ID.
- **Guided Access:** triple-click the side button (or the Home button) and enter the Guided Access passcode.
- **A Screen Time limit:** change or remove the limit in Settings > Screen Time. If a passcode is set, the iPhone asks for it first.
- **A supervised block in trial mode:** remove the profile in Settings.
- **A supervised block with a locked profile:** it cannot be undone on the iPhone itself. Erase the iPhone, then set it up as new or restore a backup from before you supervised it. Or remove the profile with Apple Configurator on a Mac.

## FAQ

### Can I lock apps on an iPhone without Face ID?

Yes. On an iPhone with Touch ID, the menu says Require Touch ID. If neither is set up, it says Require Passcode. The app then asks for your iPhone passcode each time it opens. This needs iOS 18 or later.

### Can I lock Photos or Messages on an iPhone?

Apple's page for iOS 18 names the apps that cannot be locked: Calculator, Camera, Clock, Contacts, Find My, Maps, Shortcuts and Settings, among others. Photos and Messages are not named. Touch and hold the icon. If the menu shows Require Face ID, you can lock the app.

### Does locking an app hide its notifications?

It hides what is inside them. Apple says information from a locked app does not appear in notification previews, search, Siri suggestions or your call history.

### How do I lock apps on a child's iPhone?

Not with Require Face ID. A child under 13 in a Family Sharing group cannot lock or hide apps, and a lock the child sets opens for the child. Use Screen Time from your own phone with a passcode your child does not know. If your child gets around it, block the app on a supervised iPhone.

### Can I lock an app for certain hours only?

Not with Require Face ID. It has no clock. Use a Screen Time Schedule, called Downtime before iOS 27, to close apps at set hours. On iOS 26 and earlier, the phone only reminds you that it is Downtime, and you can keep using the apps. To block them, set a Screen Time passcode and turn on Block at Downtime. Then the apps cannot be opened during those hours. Whoever knows the passcode can turn the schedule off.

## Pick the lock that fits

To keep other people out of an app, touch and hold its icon and tap Require Face ID. That is all most people need.

To keep yourself out of an app, [get the free Mac app](/) and start in trial mode. For the Screen Time steps in between, see [how to block an app on an iPhone](/blog/block-any-app-iphone) and [why Screen Time doesn't work](/blog/why-screen-time-does-not-work).

## Schema

```json
{
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "BlogPosting",
      "@id": "https://attentionawareness.com/blog/lock-apps-iphone#article",
      "headline": "How to lock apps on an iPhone, from others or yourself",
      "description": "Lock an iPhone app with Face ID, hide it, or pin the phone to one app. Then how to lock an app away from yourself, where Face ID and Screen Time fail.",
      "image": "https://attentionawareness.com/og/blog/lock-apps-iphone.png",
      "url": "https://attentionawareness.com/blog/lock-apps-iphone",
      "mainEntityOfPage": "https://attentionawareness.com/blog/lock-apps-iphone",
      "datePublished": "2026-10-08",
      "dateModified": "2026-10-08",
      "inLanguage": "en",
      "author": {
        "@type": "Person",
        "name": "Mert Duzgun",
        "url": "https://mertbuilds.com"
      },
      "publisher": {
        "@type": "Organization",
        "name": "attention awareness",
        "url": "https://attentionawareness.com",
        "logo": {
          "@type": "ImageObject",
          "url": "https://attentionawareness.com/icon-512.png"
        }
      },
      "about": ["iPhone", "Face ID", "Screen Time", "Supervised mode", "App locking"]
    },
    {
      "@type": "HowTo",
      "@id": "https://attentionawareness.com/blog/lock-apps-iphone#howto",
      "name": "Lock an app with Face ID on an iPhone (iOS 18 and later)",
      "tool": [{ "@type": "HowToTool", "name": "iPhone" }],
      "step": [
        {
          "@type": "HowToStep",
          "position": 1,
          "name": "Find the app",
          "text": "Go to the Home Screen and find the app."
        },
        {
          "@type": "HowToStep",
          "position": 2,
          "name": "Open the menu",
          "text": "Touch and hold the app icon until the menu opens."
        },
        {
          "@type": "HowToStep",
          "position": 3,
          "name": "Tap Require Face ID",
          "text": "Tap Require Face ID. On an iPhone without Face ID, the line says Require Touch ID or Require Passcode."
        },
        {
          "@type": "HowToStep",
          "position": 4,
          "name": "Confirm",
          "text": "Tap Require Face ID again, then look at the iPhone to confirm."
        }
      ]
    },
    {
      "@type": "FAQPage",
      "@id": "https://attentionawareness.com/blog/lock-apps-iphone#faq",
      "mainEntity": [
        {
          "@type": "Question",
          "name": "Can I lock apps on an iPhone without Face ID?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "Yes. On an iPhone with Touch ID, the menu says Require Touch ID. If neither is set up, it says Require Passcode. The app then asks for your iPhone passcode each time it opens. This needs iOS 18 or later."
          }
        },
        {
          "@type": "Question",
          "name": "Can I lock Photos or Messages on an iPhone?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "Apple's page for iOS 18 names the apps that cannot be locked: Calculator, Camera, Clock, Contacts, Find My, Maps, Shortcuts and Settings, among others. Photos and Messages are not named. Touch and hold the icon. If the menu shows Require Face ID, you can lock the app."
          }
        },
        {
          "@type": "Question",
          "name": "Does locking an app hide its notifications?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "It hides what is inside them. Apple says information from a locked app does not appear in notification previews, search, Siri suggestions or your call history."
          }
        },
        {
          "@type": "Question",
          "name": "How do I lock apps on a child's iPhone?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "Not with Require Face ID. A child under 13 in a Family Sharing group cannot lock or hide apps, and a lock the child sets opens for the child. Use Screen Time from your own phone with a passcode your child does not know. If your child gets around it, block the app on a supervised iPhone."
          }
        },
        {
          "@type": "Question",
          "name": "Can I lock an app for certain hours only?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "Not with Require Face ID. It has no clock. Use a Screen Time Schedule, called Downtime before iOS 27, to close apps at set hours. On iOS 26 and earlier, the phone only reminds you that it is Downtime, and you can keep using the apps. To block them, set a Screen Time passcode and turn on Block at Downtime. Then the apps cannot be opened during those hours. Whoever knows the passcode can turn the schedule off."
          }
        }
      ]
    }
  ]
}
```

## Sources

- [Apple, "Lock or hide an app on iPhone" (iOS 27)](https://support.apple.com/guide/iphone/lock-or-hide-an-app-iph00f208d05/ios)
- [Apple, "Lock or hide an app on iPhone" (iOS 18)](https://support.apple.com/guide/iphone/lock-or-hide-an-app-iph00f208d05/18.0/ios/18.0)
- [Apple, "Lock or hide apps on your iPhone" (Personal Safety User Guide)](https://support.apple.com/guide/personal-safety/lock-or-hide-apps-on-your-iphone-ipsd0be4c185/web)
- [Apple, "Lock iPhone to one app with Guided Access"](https://support.apple.com/guide/iphone/lock-iphone-to-one-app-iph7fad0d10/ios)
- [Apple, "Set Screen Time Schedules and Time Allowances" (iOS 27)](https://support.apple.com/guide/iphone/set-schedules-with-screen-time-iphb0c7313c9/ios)
- [Apple, "Set schedules with Screen Time" (iOS 26)](https://support.apple.com/guide/iphone/set-schedules-with-screen-time-iphb0c7313c9/26/ios/26)
- [Apple, "Create, change, or remove a Screen Time passcode on iPhone" (iOS 27)](https://support.apple.com/guide/iphone/create-change-remove-a-screen-time-passcode-iph272b4c4bd/ios)
- [Apple, "Setting triggers in Shortcuts on iPhone or iPad"](https://support.apple.com/guide/shortcuts/setting-triggers-apde31e9638b/ios)
- [Apple, "Allow and deny apps and binaries on Apple devices"](https://support.apple.com/guide/deployment/allow-and-deny-apps-and-binaries-dep001044b08/web)
- [Apple, "About Apple device supervision"](https://support.apple.com/guide/deployment/about-device-supervision-dep1d89f0bff/web)
- [Apple, "Web Content Filter device management payload settings"](https://support.apple.com/guide/deployment/web-content-filter-payload-settings-depc77c9609/web)
- [Apple, "Add or remove configuration profiles in Apple Configurator for Mac"](https://support.apple.com/guide/apple-configurator-mac/add-or-remove-configuration-profiles-cadb67fcd4f/mac)
