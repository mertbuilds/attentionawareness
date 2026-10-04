---
title: 'How to block porn on an iPhone for good'
heading: 'How to block adult websites on an iPhone for good'
description: "Turn on Apple's adult website filter in Screen Time, see why it is easy to undo, and lock it on a supervised iPhone so it cannot be switched off."
og_title: 'Block adult websites on an iPhone **for good**'
slug: block-adult-websites-iphone
date: 2026-10-04
primary_keyword: 'how to block porn on iphone'
reading_minutes: 7
read_next: why-screen-time-does-not-work, block-any-app-iphone
---

To block porn on an iPhone, turn on Apple's adult website filter: open Settings, tap Screen Time, and set the web filter to Limit Adult Websites. That takes a few minutes, but anyone who knows the Screen Time passcode can switch it off again. To make the block permanent, lock the same Apple filter with a profile on a supervised iPhone. Then nobody can remove it in Settings.

## The built-in way: Limit Adult Websites in Screen Time

Apple changed the Screen Time menus in iOS 27, so the path depends on your iOS version. Check your version in Settings > General > About.

### On iOS 27

1. Open the Settings app and tap Screen Time. For a child in your Family Sharing group, tap Family and then your child's name.
2. Open Apps & Websites. Enter your Screen Time passcode if the iPhone asks for it.
3. Open Restrictions and find the website filter. Apple's page for a child's iPhone calls it Filtering, under Websites.
4. Choose Limit Adult Websites.

If you do not see these names on your own iPhone, look in Screen Time under Content & Privacy Restrictions, or type "Web Content" or "Websites" in the search field at the top of Settings.

### On iOS 26 and earlier

1. Open the Settings app.
2. Tap Screen Time.
3. Tap Content & Privacy Restrictions, then turn on Content & Privacy Restrictions.
4. Tap App Store, Media, Web, & Games.
5. Tap Web Content.
6. Select Limit Adult Websites.
7. To block one more website, tap Add Website below Never Allow and enter its address.

### Add a Screen Time passcode

Without a passcode, anyone who holds the phone can turn the filter off. In Settings, open Screen Time, then Manage Screen Time, and tap Lock Screen Time Settings. Enter a four-digit passcode.

## Why the built-in block is easy to undo

The Screen Time filter is a setting, and settings can be changed. There are three weak points.

- **You know the passcode.** If you set the passcode for yourself, you can enter it and turn the filter off in under a minute.
- **The passcode can be reset with the Apple Account.** Apple lets you reset a forgotten Screen Time passcode with the Apple Account email and password used to set it up. If that account is yours, the passcode does not stop you.
- **Time limits have an Ignore Limit button.** Time Allowances (called App Limits before iOS 27) can be dismissed with one tap on your own phone, so they do not back up the web filter.

Giving the passcode to a friend or partner helps, and it may be enough for you.

## Another way: a DNS filter

Before any app opens a website, the iPhone asks a DNS service for the website's address. A DNS filter is a DNS service that refuses to look up adult websites. So the block works for every app on the phone, not only Safari.

Two free examples:

- **Cloudflare 1.1.1.1 for Families.** The addresses that block malware and adult content are 1.1.1.3 and 1.0.0.3.
- **CleanBrowsing Family Filter.** The addresses are 185.228.168.168 and 185.228.169.168. It also blocks known VPN and proxy websites, and turns on SafeSearch in Google, Bing and YouTube.

There are two ways to set one up on an iPhone:

- **With the provider's app or profile.** Cloudflare's free app, 1.1.1.1: Faster Internet, works on Wi-Fi and on mobile data. In the app, tap the menu, then Advanced > Connection options. Under DNS settings, tap 1.1.1.1 for Families and choose the option that blocks malware and adult content. CleanBrowsing offers a profile for iOS.
- **By hand, for one Wi-Fi network.** In Settings, tap Wi-Fi, tap the "i" next to the network, tap Configure DNS, choose Manual and add the two addresses. This covers only that Wi-Fi network, not mobile data.

What it leaves open: you can switch off the app, remove the profile in Settings > General > VPN & Device Management, or set the Wi-Fi back to Automatic. A VPN app can send the lookups to another DNS service. So a DNS filter covers more apps than Apple's filter, but it is just as easy to switch off. The locked profile below uses Apple's filter. Once it is locked on a supervised iPhone, it cannot be removed in Settings.

## The permanent way: lock the filter on a supervised iPhone

Supervision is a mode Apple built for schools and companies. A supervised iPhone can carry a profile with rules that the person holding the phone cannot change. One of those rules is the same adult website filter from Screen Time, with no switch for it in Settings. There are two free ways to do this.

### Option 1: the free Mac app, which does not erase your iPhone

My [free Mac app](/) puts your iPhone into supervised mode without erasing it. It makes a fresh backup, changes one setting in that backup, and restores it. Your photos, messages and apps stay. Back up your iPhone first, with Finder or iCloud.

1. Download the app on a Mac with Apple silicon and macOS 14 or later, and connect the iPhone with a cable.
2. Let the app back up and restore the phone. Plan for about one afternoon.
3. Choose your rules: Apple's adult website filter, websites to block, and apps to hide.
4. Start in trial mode. You can still remove the profile in Settings, so you can test it first.
5. When you are sure, plug in one more time and lock the profile.

The app is free. It needs no account and no subscription. It installs no app on the iPhone, only a profile. The profile blocks things and reports nothing, so nobody can see or track the phone. To sign the profile, the app sends the list of what you block to this site once for each profile. The site does not store the list, and gets nothing that names you or your iPhone.

### Option 2: manually via Apple Configurator

The [manual guide](/guide) does the same with Apple Configurator, Apple's own free Mac tool. Apple Configurator erases the iPhone first. Only what syncs to iCloud comes back. You can make the profile with our [profile builder](/build).

### Which way fits you

|                               | Screen Time            | DNS filter                               | Free Mac app                                           | Manually via Apple Configurator                        |
| ----------------------------- | ---------------------- | ---------------------------------------- | ------------------------------------------------------ | ------------------------------------------------------ |
| Needs a Mac                   | No                     | No                                       | Yes                                                    | Yes                                                    |
| Erases the iPhone             | No                     | No                                       | No                                                     | Yes                                                    |
| Can be turned off in Settings | Yes, with the passcode | Yes                                      | No, once locked                                        | No, once locked                                        |
| How to undo                   | Change the setting     | Switch off the app or remove the profile | Erase the iPhone, or use a Mac with Apple Configurator | Erase the iPhone, or use a Mac with Apple Configurator |

All four are free.

## What the filter catches

The adult website filter is Apple's own filter. It works in Safari and in apps that show web pages with the iPhone's system web view. It blocks websites that Apple detects as adult websites.

## What this cannot do

It is a filter. It does not catch everything.

- **New or unknown websites can get through.** Add any website that gets through to your block list.
- **Apps with their own content are not filtered.** Social media apps, chat apps and video apps show content inside the app. A web filter does not see it.
- **Other browsers may behave differently.** A browser that does not use the system web view may not follow the filter.
- **It only covers this iPhone.** Other devices need their own setup. The Mac app supports iPhone only today.

So pair the filter with two more rules. Block the specific websites you know about, and hide the apps that are a problem for you. See [how to block any app on an iPhone](/blog/block-any-app-iphone).

A filter is a tool, not treatment. If this topic affects your daily life, a doctor or a licensed therapist can help.

## For yourself or for a child's phone

**For yourself.** The weak point is that you hold the passcode. A locked profile has no passcode.

**For a child's phone.** Start with Apple's parental controls. On iOS 27, open Settings, tap Family, then your child's name, then Apps & Websites. Under Restrictions, open the website filter. Apple turns on Limit Adult Websites by default for Child Accounts under 18. You hold the passcode, so this works better than it does for an adult. If your child keeps finding ways around it, a locked profile is the next step. More in [iPhone parental controls kids cannot turn off](/blog/iphone-parental-controls-kids-cannot-turn-off).

## How to undo it

A locked profile cannot be removed on the iPhone itself. To remove it, erase the iPhone: Settings > General > Transfer or Reset iPhone > Erase All Content and Settings. Restoring a backup made before supervision does the same. A Mac with Apple Configurator can also remove a profile from a supervised iPhone. Decide before you lock, and use trial mode first.

## FAQ

### How do I block porn on my iPhone without an app?

Use Screen Time. On iOS 27, open Settings, tap Screen Time, then Apps & Websites, and choose Limit Adult Websites in the website filter under Restrictions. On iOS 26 and earlier, go to Settings > Screen Time > Content & Privacy Restrictions > App Store, Media, Web, & Games > Web Content and select Limit Adult Websites.

### Is there a free porn blocker for iPhone?

Yes. Apple's adult website filter is built into every iPhone. My Mac app, which locks that filter so it cannot be switched off, is also free.

### Can I block websites on an iPhone permanently?

Yes, on a supervised iPhone. A locked profile with a list of blocked websites cannot be removed on the iPhone itself. Removing it takes erasing the iPhone, or a Mac with Apple Configurator.

### Does the filter work in Chrome and other browsers?

It works in Safari and in apps that use the iPhone's system web view. Browsers and apps that load content another way may not follow it. If a browser gets around the filter, hide that browser app.

## Start with the built-in filter, then lock it

Turn on Limit Adult Websites in Screen Time today. If you find yourself turning it off, lock it with the [free Mac app](/), which does not erase your iPhone, or do it [manually via Apple Configurator](/guide).

## Schema

```json
{
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "BlogPosting",
      "@id": "https://attentionawareness.com/blog/block-adult-websites-iphone#article",
      "headline": "How to block porn on an iPhone for good",
      "alternativeHeadline": "How to block adult websites on an iPhone for good",
      "description": "Turn on Apple's adult website filter in Screen Time, see why it is easy to undo, and lock it on a supervised iPhone so it cannot be switched off.",
      "image": "https://attentionawareness.com/og/blog/block-adult-websites-iphone.png",
      "url": "https://attentionawareness.com/blog/block-adult-websites-iphone",
      "mainEntityOfPage": "https://attentionawareness.com/blog/block-adult-websites-iphone",
      "datePublished": "2026-10-04",
      "dateModified": "2026-10-05",
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
      }
    },
    {
      "@type": "HowTo",
      "@id": "https://attentionawareness.com/blog/block-adult-websites-iphone#howto",
      "name": "Turn on Limit Adult Websites on an iPhone (iOS 26 and earlier)",
      "tool": [{ "@type": "HowToTool", "name": "iPhone" }],
      "step": [
        {
          "@type": "HowToStep",
          "position": 1,
          "name": "Open Settings",
          "text": "Open the Settings app."
        },
        {
          "@type": "HowToStep",
          "position": 2,
          "name": "Open Screen Time",
          "text": "Tap Screen Time."
        },
        {
          "@type": "HowToStep",
          "position": 3,
          "name": "Turn on restrictions",
          "text": "Tap Content & Privacy Restrictions, then turn on Content & Privacy Restrictions."
        },
        {
          "@type": "HowToStep",
          "position": 4,
          "name": "Open content settings",
          "text": "Tap App Store, Media, Web, & Games."
        },
        {
          "@type": "HowToStep",
          "position": 5,
          "name": "Open Web Content",
          "text": "Tap Web Content."
        },
        {
          "@type": "HowToStep",
          "position": 6,
          "name": "Limit adult websites",
          "text": "Select Limit Adult Websites."
        },
        {
          "@type": "HowToStep",
          "position": 7,
          "name": "Block extra websites",
          "text": "To block one more website, tap Add Website below Never Allow and enter its address."
        }
      ]
    },
    {
      "@type": "FAQPage",
      "@id": "https://attentionawareness.com/blog/block-adult-websites-iphone#faq",
      "mainEntity": [
        {
          "@type": "Question",
          "name": "How do I block porn on my iPhone without an app?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "Use Screen Time. On iOS 27, open Settings, tap Screen Time, then Apps & Websites, and choose Limit Adult Websites in the website filter under Restrictions. On iOS 26 and earlier, go to Settings > Screen Time > Content & Privacy Restrictions > App Store, Media, Web, & Games > Web Content and select Limit Adult Websites."
          }
        },
        {
          "@type": "Question",
          "name": "Is there a free porn blocker for iPhone?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "Yes. Apple's adult website filter is built into every iPhone. The attention awareness Mac app, which locks that filter so it cannot be switched off, is also free."
          }
        },
        {
          "@type": "Question",
          "name": "Can I block websites on an iPhone permanently?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "Yes, on a supervised iPhone. A locked profile with a list of blocked websites cannot be removed on the iPhone itself. Removing it takes erasing the iPhone, or a Mac with Apple Configurator."
          }
        },
        {
          "@type": "Question",
          "name": "Does the filter work in Chrome and other browsers?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "It works in Safari and in apps that use the iPhone's system web view. Browsers and apps that load content another way may not follow it. If a browser gets around the filter, hide that browser app."
          }
        }
      ]
    }
  ]
}
```

## Sources

- [Apple, "Block features or content with Screen Time on iPhone" (iOS 27)](https://support.apple.com/guide/iphone/block-features-or-content-with-screen-time-iph3ff83f3b1/27/ios/27)
- [Apple, "Block apps, app downloads, websites, and purchases on iPhone" (iOS 26)](https://support.apple.com/guide/iphone/iph3ff83f3b1/26/ios/26)
- [Apple, "Set up parental controls to manage your child's iPhone or iPad"](https://support.apple.com/en-us/105121)
- [Apple, "Block or allow access to apps and websites on your child's device"](https://support.apple.com/guide/child-safety/block-or-allow-access-to-apps-and-websites-jymj24zqwaek/27/web/1.0)
- [Apple, "Create, change, or remove a Screen Time passcode on iPhone"](https://support.apple.com/guide/iphone/create-change-remove-a-screen-time-passcode-iph272b4c4bd/27/ios/27)
- [Apple, "Change your Screen Time passcode on an iPhone or iPad"](https://support.apple.com/en-us/102677)
- [Apple, "Set up Screen Time for yourself on iPhone"](https://support.apple.com/guide/iphone/set-up-screen-time-for-yourself-iphbfa595995/27/ios/27)
- [Apple, "Erase iPhone"](https://support.apple.com/guide/iphone/erase-iphone-iph7a2a9399b/27/ios/27)
- [Apple, "Install or remove configuration profiles on iPhone"](https://support.apple.com/guide/iphone/install-or-remove-configuration-profiles-iph6c493b19/ios)
- [Cloudflare, "Set up 1.1.1.1 on iOS"](https://developers.cloudflare.com/1.1.1.1/setup/ios/)
- [Cloudflare, "Set up Cloudflare 1.1.1.1 resolver" (1.1.1.1 for Families)](https://developers.cloudflare.com/1.1.1.1/setup/)
- [CleanBrowsing, "Free DNS Filters"](https://cleanbrowsing.org/filters/)
- [Apple, "Web Content Filter device management payload settings"](https://support.apple.com/guide/deployment/web-content-filter-payload-settings-depc77c9609/web)
- [Apple, "Add or remove configuration profiles in Apple Configurator for Mac"](https://support.apple.com/guide/apple-configurator-mac/add-or-remove-configuration-profiles-cadb67fcd4f/mac)
