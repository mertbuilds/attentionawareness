---
title: 'Free Apple MDM, or no MDM: lock down work iPhones'
heading: 'Lock down work iPhones without an MDM server, free'
description: "Apple's own MDM is now free. Here is when a small business needs it, and how to lock 1 to 20 work iPhones by cable with no MDM server at all."
og_title: 'Lock down work iPhones **without an MDM server**, free'
slug: work-iphones-without-mdm
date: 2026-10-04
primary_keyword: 'apple mdm free'
reading_minutes: 6
read_next: block-any-app-iphone, why-screen-time-does-not-work
---

You have two free ways to lock down company iPhones. The first is Apple's own MDM, which is built into Apple Business and has been free since April 2026. The second needs no MDM server and no account: you supervise each iPhone once by cable and install a locked profile that blocks the apps and websites you choose.

This post is for an owner or office manager with 1 to 20 company iPhones and no IT department.

## What MDM is

MDM means mobile device management. It is a server that sends settings to your phones over the internet. With an MDM you can change rules from your desk, install apps on every phone, see a list of all devices, and lock or erase a phone that is lost.

## When a real MDM is the right answer

Use a real MDM if one of these is true:

- You have many phones, or the number grows every month.
- You need to change rules often, without collecting the phones.
- You must erase a lost or stolen phone from far away.
- You need to install and update work apps on every phone.

Your options, named in no order:

- **Apple Business.** Apple's own platform. It replaced Apple Business Manager and Apple Business Essentials on April 14, 2026, and it has device management built in. Apple lists it as free. Extra iCloud storage and AppleCare+ cost money.
- **Jamf Now, SimpleMDM, Mosyle.** Apple-only tools made for small teams.
- **Microsoft Intune.** Common in offices that already use Microsoft 365.

Check current pricing and free plan limits on each site. They change.

An MDM is also more work: an account, company verification, and a dashboard to learn. If you only want phones that are for work, the cable way is smaller.

## Start with the built-in settings

Every iPhone has Screen Time. In Settings, open Screen Time. These are its parts on iOS 27:

1. Content & Privacy Restrictions blocks content and built-in features.
2. Time Allowances (called App Limits before iOS 27) sets daily time for categories like social apps and games.
3. Screen Time Schedule (called Downtime before iOS 27) chooses when those apps are available.
4. Manage Screen Time, then Lock Screen Time Settings, sets a four-digit passcode.

This is enough if you trust the team and only want a light rule. It is weak as a company policy. The passcode can be reset with the Apple Account that is signed in on the phone, and that is usually the employee's account. You also set it by hand on every phone.

## What a supervised iPhone is

Supervision is Apple's mode for devices that a company or school owns. Apple says supervision "generally denotes that the device is owned by the organization, which provides additional control over its configuration and restrictions."

A supervised iPhone accepts restrictions that a normal iPhone refuses. It also accepts a profile that the user cannot remove in Settings. Most people get supervision through an MDM. You can also turn it on by cable from a Mac, with no MDM server.

## What you can do without a server

You supervise each iPhone once, by cable. Then you install one locked profile. The profile can:

- [Block the apps you choose](/blog/block-any-app-iphone), such as social, games, betting and shopping apps. They stay blocked even if someone installs them.
- Block the websites you choose.
- Turn on [Apple's adult website filter](/blog/block-adult-websites-iphone). It works in Safari and in apps that use the system web view. It is a filter and does not catch everything.

Phone, Messages, Mail, Maps, the camera and your work apps keep working. The App Store stays on.

A locked profile cannot be removed on the iPhone itself. Undoing it takes erasing the iPhone, or a Mac with Apple Configurator.

## The two free ways to do it

|                   | The free Mac app                                                | Manually via Apple Configurator                    |
| ----------------- | --------------------------------------------------------------- | -------------------------------------------------- |
| Data on the phone | Stays, on iOS 26 and older. The app does not support iOS 27 yet | Erased first. Only what syncs to iCloud comes back |
| Good for          | Phones already in use                                           | New company phones, where erasing is normal        |
| You need          | Mac with Apple silicon, macOS 14 or later, a cable              | Mac, Apple Configurator (free from Apple), a cable |
| Effort            | The app does the steps                                          | You follow a written guide                         |
| Account           | None                                                            | None                                               |

The Mac app is at [attentionawareness.com](/). The manual steps are in [the manual guide](/guide), and the profile builder is at [/build](/build).

## How this compares to an MDM

|                                  | Cable and locked profile                            | MDM                           |
| -------------------------------- | --------------------------------------------------- | ----------------------------- |
| Change the rules                 | You need the phone and the cable again              | From your desk                |
| Erase a lost phone               | No. Use Find My with the Apple Account on the phone | Yes                           |
| List of all devices              | No                                                  | Yes                           |
| Install work apps for everyone   | No                                                  | Yes                           |
| Set up many phones at once       | No. One phone at a time                             | Yes                           |
| See or track the phone           | Nobody can                                          | The admin sees device details |
| MDM server, account, monthly fee | None                                                | An account, sometimes a fee   |

With no MDM server, nothing on the phone reports back to you or to me. The phone is limited, and the employee keeps their privacy.

## Set up 5 phones, step by step

1. **Write the list.** Decide which apps and websites to block. Keep one list for all phones.
2. **Tell the team.** Say what will be blocked and why, before you touch a phone.
3. **Get ready.** You need the Mac, a good cable, each phone's passcode and its Apple Account password.
4. **Pick the way.** Use the Mac app for phones with data on iOS 26 and older. Use Apple Configurator for new phones in the box and for phones on iOS 27.
5. **Do one phone first, in trial mode.** A trial profile can be removed in Settings. Give the phone back for a day and check that every work app opens.
6. **Fix the list.** Remove anything that blocked real work.
7. **Do the other four.** Plug in, supervise, install the profile. Each phone takes a few minutes. It restarts and asks to trust the Mac again.
8. **Lock it.** Plug in each phone once more and make the profile permanent.
9. **Keep a note.** Write down the date and the list for each phone.

## What this cannot do

- It does not change anything from a distance. Adding a block needs the cable. Removing a block from a locked phone means erasing the phone and setting it up again.
- It does not erase, find, or list phones.
- It does not block everything. Only the apps and websites on your list are blocked, and the adult filter misses some sites.
- It does not install or update apps for you.
- It is iPhone only today, and you need a Mac.

## The people side

Do this only on phones the company owns, and tell employees in writing before you do it. This is not legal advice, and rules differ by country, so ask a lawyer if you are unsure.

## FAQ

### Is there a free Apple MDM?

Yes. Apple Business has device management built in, and Apple lists it as free in more than 200 countries and regions. Some other MDM tools have free plans with limits. Check each website for current terms.

### Can I supervise an iPhone without MDM?

Yes. Apple Configurator on a Mac can supervise an iPhone by cable with no MDM. Apple says this erases the device. The free Mac app from attention awareness supervises an iPhone on iOS 26 and older and keeps its data.

### Can an employee remove the locked profile?

Not on the iPhone itself. An employee who erases the iPhone removes it, and so does restoring a backup made before supervision. A Mac with Apple Configurator can remove it too.

### Can I see what employees do on the phone?

No. The phone is not enrolled in an MDM server, so nobody can see or track it. If you need device reports, you need an MDM.

### What happens when an employee leaves?

Erase the iPhone. Then supervise it again and install the profile for the next person.

## Next step

Start with one phone and trial mode. Back up each phone first. Get [the free Mac app](/) if the phones have data on them, or do it [manually via Apple Configurator](/guide) for new phones.

## Schema

```json
{
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "BlogPosting",
      "@id": "https://attentionawareness.com/blog/work-iphones-without-mdm#article",
      "headline": "Free Apple MDM, or no MDM: lock down work iPhones",
      "alternativeHeadline": "Lock down work iPhones without an MDM server, free",
      "description": "Apple's own MDM is now free. Here is when a small business needs it, and how to lock 1 to 20 work iPhones by cable with no MDM server at all.",
      "image": "https://attentionawareness.com/og/blog/work-iphones-without-mdm.png",
      "url": "https://attentionawareness.com/blog/work-iphones-without-mdm",
      "mainEntityOfPage": "https://attentionawareness.com/blog/work-iphones-without-mdm",
      "datePublished": "2026-10-04",
      "dateModified": "2026-10-04",
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
      "about": ["Mobile device management", "iPhone supervision", "Apple Configurator"]
    },
    {
      "@type": "HowTo",
      "@id": "https://attentionawareness.com/blog/work-iphones-without-mdm#howto",
      "name": "Lock down 5 work iPhones without an MDM server",
      "tool": [
        { "@type": "HowToTool", "name": "A Mac" },
        { "@type": "HowToTool", "name": "An iPhone cable" },
        {
          "@type": "HowToTool",
          "name": "The free attention awareness Mac app, or Apple Configurator"
        }
      ],
      "step": [
        {
          "@type": "HowToStep",
          "position": 1,
          "name": "Write the list",
          "text": "Decide which apps and websites to block. Keep one list for all phones."
        },
        {
          "@type": "HowToStep",
          "position": 2,
          "name": "Tell the team",
          "text": "Say what will be blocked and why, before you touch a phone."
        },
        {
          "@type": "HowToStep",
          "position": 3,
          "name": "Get ready",
          "text": "You need the Mac, a good cable, each phone's passcode and its Apple Account password."
        },
        {
          "@type": "HowToStep",
          "position": 4,
          "name": "Pick the way",
          "text": "Use the Mac app for phones with data on iOS 26 and older. Use Apple Configurator for new phones in the box and for phones on iOS 27."
        },
        {
          "@type": "HowToStep",
          "position": 5,
          "name": "Do one phone first, in trial mode",
          "text": "A trial profile can be removed in Settings. Give the phone back for a day and check that every work app opens."
        },
        {
          "@type": "HowToStep",
          "position": 6,
          "name": "Fix the list",
          "text": "Remove anything that blocked real work."
        },
        {
          "@type": "HowToStep",
          "position": 7,
          "name": "Do the other four",
          "text": "Plug in, supervise, install the profile. Each phone takes a few minutes. It restarts and asks to trust the Mac again."
        },
        {
          "@type": "HowToStep",
          "position": 8,
          "name": "Lock it",
          "text": "Plug in each phone once more and make the profile permanent."
        },
        {
          "@type": "HowToStep",
          "position": 9,
          "name": "Keep a note",
          "text": "Write down the date and the list for each phone."
        }
      ]
    },
    {
      "@type": "FAQPage",
      "@id": "https://attentionawareness.com/blog/work-iphones-without-mdm#faq",
      "mainEntity": [
        {
          "@type": "Question",
          "name": "Is there a free Apple MDM?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "Yes. Apple Business has device management built in, and Apple lists it as free in more than 200 countries and regions. Some other MDM tools have free plans with limits. Check each website for current terms."
          }
        },
        {
          "@type": "Question",
          "name": "Can I supervise an iPhone without MDM?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "Yes. Apple Configurator on a Mac can supervise an iPhone by cable with no MDM. Apple says this erases the device. The free Mac app from attention awareness supervises an iPhone on iOS 26 and older and keeps its data."
          }
        },
        {
          "@type": "Question",
          "name": "Can an employee remove the locked profile?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "Not on the iPhone itself. An employee who erases the iPhone removes it, and so does restoring a backup made before supervision. A Mac with Apple Configurator can remove it too."
          }
        },
        {
          "@type": "Question",
          "name": "Can I see what employees do on the phone?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "No. The phone is not enrolled in an MDM server, so nobody can see or track it. If you need device reports, you need an MDM."
          }
        },
        {
          "@type": "Question",
          "name": "What happens when an employee leaves?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "Erase the iPhone. Then supervise it again and install the profile for the next person."
          }
        }
      ]
    }
  ]
}
```

## Sources

- [Apple, "About Apple device supervision"](https://support.apple.com/guide/deployment/about-device-supervision-dep1d89f0bff/web)
- [Apple, "Intro to configuration profiles"](https://support.apple.com/guide/deployment/intro-to-mdm-profiles-depc0aadd3fe/web)
- [Apple Configurator for Mac, "Supervise devices"](https://support.apple.com/guide/apple-configurator-mac/supervise-devices-cad99bc2a859/mac)
- [Apple Newsroom, "Introducing Apple Business" (March 24, 2026)](https://www.apple.com/newsroom/2026/03/introducing-apple-business-a-new-all-in-one-platform-for-businesses-of-all-sizes/)
- [Apple Business User Guide, "Intro to device management services"](https://support.apple.com/guide/business/intro-to-device-management-services-axm659f6bd48/web)
- [Apple Business User Guide, "Add devices using Apple Configurator"](https://support.apple.com/guide/business/add-devices-using-apple-configurator-axm200a54d59/web)
- [Apple, "Set Screen Time Schedules and Time Allowances" (iOS 27)](https://support.apple.com/guide/iphone/set-schedules-and-time-allowances-iphb0c7313c9/ios)
- [Apple, "Block features or content with Screen Time" (iOS 27)](https://support.apple.com/guide/iphone/block-features-or-content-with-screen-time-iph3ff83f3b1/ios)
- [Apple, "Create, change, or remove a Screen Time passcode" (iOS 27)](https://support.apple.com/guide/iphone/create-change-remove-a-screen-time-passcode-iph272b4c4bd/ios)
- [Jamf Now](https://www.jamf.com/products/jamf-now/)
- [SimpleMDM for small business](https://simplemdm.com/use-case/smb/)
- [Apple, "Add or remove configuration profiles in Apple Configurator for Mac"](https://support.apple.com/guide/apple-configurator-mac/add-or-remove-configuration-profiles-cadb67fcd4f/mac)
