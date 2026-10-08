---
title: 'How to block websites on an iPhone, and keep them blocked'
heading: 'How to block websites on an iPhone'
description: 'Block a website on an iPhone with Screen Time, step by step. See which browsers it covers, why it is easy to undo, and how to lock the list for good.'
og_title: 'Block a website on an iPhone, **and keep it blocked**'
slug: block-websites-iphone
date: 2026-10-08
primary_keyword: 'how to block websites on iphone'
reading_minutes: 9
read_next: block-adult-websites-iphone, block-any-app-iphone
---

To block a website on an iPhone, use Screen Time. On iOS 26 and earlier, open Settings > Screen Time > Content & Privacy Restrictions > App Store, Media, Web, & Games > Web Content. Select Limit Adult Websites, tap Add Website below Never Allow, and enter the address. On iOS 27, the website list is in Settings > Screen Time > Apps & Websites. Anyone who knows the Screen Time passcode can undo this. To keep a website blocked, put the list in a locked profile on a supervised iPhone.

## The built-in way: block a website with Screen Time

Apple changed the Screen Time menus in iOS 27, so the path depends on your iOS version. Check your version in Settings > General > About.

### On iOS 26 and earlier

1. Open the Settings app.
2. Tap Screen Time. To block websites for a child in your Family Sharing group, tap your child's name.
3. Tap Content & Privacy Restrictions, then turn on Content & Privacy Restrictions.
4. Tap App Store, Media, Web, & Games.
5. Tap Web Content.
6. Select Limit Adult Websites.
7. Tap Add Website below Never Allow and enter the address of the website you want to block. Repeat this for each website.

Limit Adult Websites also turns on Apple's filter for adult websites. That filter has its own post: [how to block adult websites on an iPhone](/blog/block-adult-websites-iphone).

### On iOS 27

1. Open the Settings app and tap Screen Time. For a child in your Family Sharing group, tap Family in Settings instead, and then your child's name.
2. Open Apps & Websites. Enter your Screen Time passcode if the iPhone asks for it.
3. Tap the Add button and enter the name of the website. Choose to block it.
4. To check the list, open the Blocked tab. To block a website that is already on the Allowed list, select it and tap Block Website, then tap again to confirm.

Apple's pages describe these steps for a child's iPhone. If you do not see these names on your own iPhone, type "Websites" in the search field at the top of Settings.

### Allow only the websites you choose

An allow list closes every website except the ones you name.

- **On iOS 27.** Open Apps & Websites, tap Restrictions, then tap Filtering under Websites. Choose Approved Websites Only.
- **On iOS 26 and earlier.** On the Web Content screen, choose Only Approved Websites and add the websites you want to keep. That is the name on iOS 26. Older versions of iOS call it Allowed Websites.

For a child under 13 with a Child Account, Apple turns on Approved Websites Only by default. On iOS 27 the child can ask for a new website, and you approve or decline. Apple calls this Ask to Browse.

### Add a Screen Time passcode

Without a passcode, anyone who holds the phone can change the list. In Settings, open Screen Time, then Manage Screen Time, and tap Lock Screen Time Settings. Enter a four-digit passcode.

## Does it work in Chrome, Firefox and inside apps?

The Screen Time list is a setting of the iPhone, not of Safari. An older version of Apple's parental controls page said the filter limits content "in Safari and other apps on your device." For iOS 27, Apple says Ask to Browse works "in Safari and other supported browser apps."

So the block works in Safari and in apps that show web pages with the iPhone's system web view. A browser or an app that loads pages another way may not follow the list. I did not find an Apple list of the browsers that follow it, so test yours: add a website to the list, then open that website in Chrome, in Firefox and from a link inside another app. If a browser gets around the list, delete that browser.

I also did not find an Apple page that says what the list does in private tabs. Open a private tab in Safari and try a blocked website. A profile on a supervised iPhone can turn private tabs off, as you will see below.

## Why the Screen Time block is easy to undo

The list is a setting, and settings can be changed. There are three weak points.

- **You know the passcode.** If you set the passcode for yourself, you can enter it and delete the website from the list in under a minute.
- **The passcode can be turned off.** In Screen Time, tap Change Screen Time Passcode, then Turn Off Screen Time Passcode, and enter the current passcode.
- **The passcode can be reset with the Apple Account.** Apple lets you reset a forgotten Screen Time passcode with the Apple Account email and password used to set it up. If that account is yours, the passcode does not stop you.

For a child's iPhone, you hold the passcode, so the list holds better. For yourself, a friend or partner can set the passcode, and that may be enough for you. More in [why Screen Time doesn't work](/blog/why-screen-time-does-not-work).

## Other ways to block a website, and what each leaves open

### A DNS filter

A DNS filter is a DNS service that refuses to look up the addresses of some websites. It works for every app on the phone. The two free family filters I checked, Cloudflare 1.1.1.1 for Families and CleanBrowsing Family Filter, block kinds of websites, such as adult websites. Their free filters do not take a list of your own.

What it leaves open: you can switch off its app or remove its profile in Settings > General > VPN & Device Management. The setup steps are in [the post about the adult website filter](/blog/block-adult-websites-iphone).

### A content blocker in Safari

Safari on iPhone takes extensions, and Apple says extensions can "block content on websites." What such an extension blocks depends on the extension.

What it leaves open: it is a Safari extension, so it works in Safari only. You turn it off in Settings > Apps > Safari > Extensions, or you delete the app it came with.

### Blocking on the Wi-Fi router

Some home routers have a setting that blocks websites by address. Check the router's manual.

What it leaves open: the block is on the router, not on the iPhone. On mobile data, or on any other Wi-Fi network, the website opens again.

### The ways, side by side

| Way                                   | Blocks                                                            | How it is undone                                       |
| ------------------------------------- | ----------------------------------------------------------------- | ------------------------------------------------------ |
| Screen Time list                      | The websites you add, or all but the ones you allow               | Change the setting with the Screen Time passcode       |
| Free family DNS filter                | Kinds of websites, not your own list                              | Switch off the app or remove its profile               |
| Safari content blocker                | What the extension supports, in Safari only                       | Turn the extension off in Settings, or delete its app  |
| Wi-Fi router                          | Depends on the router, and only on that Wi-Fi network             | Turn off Wi-Fi and use mobile data                     |
| Locked profile on a supervised iPhone | The websites on your list, or all but the ones on your allow list | Erase the iPhone, or use a Mac with Apple Configurator |

## The permanent way: a locked website list on a supervised iPhone

Supervision is a mode Apple built for schools and companies. A supervised iPhone can carry a profile with rules that the person holding the phone cannot change. One of those rules is Apple's own web filter, with no switch for it in Settings.

The filter in the profile has two forms:

- **Block a list.** The websites on the list do not load. You can also turn on Apple's adult website filter next to it. Apple's documentation says to keep this list to no more than 500 addresses.
- **Allow only a list.** Only the websites on the list load. Apple's own websites that end in apple.com and icloud.com always stay open.

Apple's documentation says that a block for the plain address of a website covers the whole website, with all its subdomains. It also says the filter drops a "www" at the start of an address. Apple's example: a block for www.test.com also blocks m.test.com. So enter the plain address, such as reddit.com.

The profile can also make Safari keep its history. Then Safari has no private tabs, and history cannot be cleared. Apple lists this setting for iOS 26 and later.

There are two free ways to set this up.

### Option 1: the free Mac app, which does not erase your iPhone

My [free Mac app](/) puts your iPhone into supervised mode without erasing it. It sends a small set of settings to the iPhone and restarts it. Your photos, messages and apps stay. Back up your iPhone first, with Finder or iCloud. It works on iOS 27 and earlier. The iOS 27 steps are in [how to supervise an iPhone on iOS 27 without erasing it](/blog/supervise-iphone-ios-27-without-erasing).

1. Download the app on a Mac with Apple silicon and macOS 14 or later, and connect the iPhone with a cable.
2. Let the app supervise the phone. It takes a few minutes. The iPhone restarts and asks to trust the Mac again.
3. Add the websites to block. You can also turn on the adult website filter and hide apps.
4. Start in trial mode. You can still remove the profile in Settings, so you can test it first.
5. When you are sure, plug in one more time and lock the profile.

The app is free. It needs no account and installs no app on the iPhone, only a profile. Nobody can see or track the phone. To sign the profile, the app sends the list of what you block to this site once for each profile. The site does not store the list.

The Mac app makes a block list. For an allow list, use the profile builder in option 2.

### Option 2: manually via Apple Configurator

The [manual guide](/guide) does the same with Apple Configurator, Apple's own free Mac tool. Apple Configurator erases the iPhone first. Only what syncs to iCloud comes back. You make the profile with the free [profile builder](/build). Under Web filter, choose "Block a list" or "Allow only a list", add your websites and download the profile. Then you add it to the iPhone with Apple Configurator.

## What this cannot do

- **It blocks only what is on the list.** A website with another address stays open until you add it.
- **It does not block the app.** A blocked website and its app are two things. If you block instagram.com, the Instagram app still opens. To close both, see [how to block any app on an iPhone](/blog/block-any-app-iphone).
- **Other browsers may behave differently.** Test the browsers you keep, or hide them in the same profile.
- **A locked list cannot be made shorter.** You can add more blocks later with a new profile. You cannot take a website off a locked list. This matters most for an allow list, so stay in trial mode until the list is right.
- **It only covers this iPhone.** The Mac app supports iPhone only today.
- **It needs a Mac.** Without one, the Screen Time list is what you have.

## How to undo it

In trial mode, remove the profile in Settings > General > VPN & Device Management.

A locked profile cannot be removed on the iPhone itself. To remove it, erase the iPhone: Settings > General > Transfer or Reset iPhone > Erase All Content and Settings. Then set it up as new, or restore a backup made before supervision. A Mac with Apple Configurator can also remove a profile from a supervised iPhone.

## FAQ

### How do I block a website on Safari on my iPhone?

Use the Screen Time list. On iOS 26 and earlier, go to Settings > Screen Time > Content & Privacy Restrictions > App Store, Media, Web, & Games > Web Content, select Limit Adult Websites and tap Add Website below Never Allow. On iOS 27, open Settings > Screen Time > Apps & Websites, tap the Add button and block the website. The list is not for Safari only. It also works in apps that use the iPhone's system web view.

### Can I block a website on an iPhone without Screen Time?

Yes. A Safari extension can block content in Safari, and some home routers can block a website on the home Wi-Fi network. Both are easy to switch off. A locked profile on a supervised iPhone blocks websites without Screen Time, and it cannot be removed in Settings.

### How do I block websites on my child's iPhone?

On iOS 27, open Settings on your own iPhone, tap Family, then your child's name, then Apps & Websites. Tap the Add button to block a website. To allow only the websites you approve, tap Restrictions, then Filtering under Websites, and choose Approved Websites Only. Set a Screen Time passcode that your child does not know.

### Does the block work in Chrome?

It works in Safari and in apps that use the iPhone's system web view. A browser that loads pages another way may not follow it. Add a website to the list and open it in Chrome to test. If a browser gets around the list, delete that browser.

### Can I block YouTube's website but keep the YouTube app?

Yes. The website list and the app are two things. Add youtube.com to the list and keep the app. Then check that the app still works the way you need. To block the app too, see how to block any app on an iPhone.

### Can I block all websites except a few?

Yes. In Screen Time, choose Approved Websites Only on iOS 27, or Only Approved Websites on iOS 26. Older versions of iOS call it Allowed Websites. On a supervised iPhone, a locked profile with an allow list does the same, and it cannot be switched off in Settings.

## Start with the Screen Time list, then lock it

Add the website to the Screen Time list today. If you find yourself taking it off the list again, lock the list with the [free Mac app](/), which does not erase your iPhone, or do it [manually via Apple Configurator](/guide).

If the website has an app, block that too: [how to block any app on an iPhone](/blog/block-any-app-iphone). For a child's phone, see [iPhone parental controls kids cannot turn off](/blog/iphone-parental-controls-kids-cannot-turn-off).

## Schema

```json
{
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "BlogPosting",
      "@id": "https://attentionawareness.com/blog/block-websites-iphone#article",
      "headline": "How to block websites on an iPhone, and keep them blocked",
      "alternativeHeadline": "How to block websites on an iPhone",
      "description": "Block a website on an iPhone with Screen Time, step by step. See which browsers it covers, why it is easy to undo, and how to lock the list for good.",
      "image": "https://attentionawareness.com/og/blog/block-websites-iphone.png",
      "url": "https://attentionawareness.com/blog/block-websites-iphone",
      "mainEntityOfPage": "https://attentionawareness.com/blog/block-websites-iphone",
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
      "about": ["iPhone", "Screen Time", "Supervised mode", "Website blocking"]
    },
    {
      "@type": "HowTo",
      "@id": "https://attentionawareness.com/blog/block-websites-iphone#howto",
      "name": "Block a website on an iPhone with Screen Time (iOS 26 and earlier)",
      "tool": [
        {
          "@type": "HowToTool",
          "name": "iPhone"
        }
      ],
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
          "text": "Tap Screen Time. To block websites for a child in your Family Sharing group, tap your child's name."
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
          "name": "Add the website",
          "text": "Tap Add Website below Never Allow and enter the address of the website you want to block. Repeat this for each website."
        }
      ]
    },
    {
      "@type": "FAQPage",
      "@id": "https://attentionawareness.com/blog/block-websites-iphone#faq",
      "mainEntity": [
        {
          "@type": "Question",
          "name": "How do I block a website on Safari on my iPhone?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "Use the Screen Time list. On iOS 26 and earlier, go to Settings > Screen Time > Content & Privacy Restrictions > App Store, Media, Web, & Games > Web Content, select Limit Adult Websites and tap Add Website below Never Allow. On iOS 27, open Settings > Screen Time > Apps & Websites, tap the Add button and block the website. The list is not for Safari only. It also works in apps that use the iPhone's system web view."
          }
        },
        {
          "@type": "Question",
          "name": "Can I block a website on an iPhone without Screen Time?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "Yes. A Safari extension can block content in Safari, and some home routers can block a website on the home Wi-Fi network. Both are easy to switch off. A locked profile on a supervised iPhone blocks websites without Screen Time, and it cannot be removed in Settings."
          }
        },
        {
          "@type": "Question",
          "name": "How do I block websites on my child's iPhone?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "On iOS 27, open Settings on your own iPhone, tap Family, then your child's name, then Apps & Websites. Tap the Add button to block a website. To allow only the websites you approve, tap Restrictions, then Filtering under Websites, and choose Approved Websites Only. Set a Screen Time passcode that your child does not know."
          }
        },
        {
          "@type": "Question",
          "name": "Does the block work in Chrome?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "It works in Safari and in apps that use the iPhone's system web view. A browser that loads pages another way may not follow it. Add a website to the list and open it in Chrome to test. If a browser gets around the list, delete that browser."
          }
        },
        {
          "@type": "Question",
          "name": "Can I block YouTube's website but keep the YouTube app?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "Yes. The website list and the app are two things. Add youtube.com to the list and keep the app. Then check that the app still works the way you need. To block the app too, see how to block any app on an iPhone."
          }
        },
        {
          "@type": "Question",
          "name": "Can I block all websites except a few?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "Yes. In Screen Time, choose Approved Websites Only on iOS 27, or Only Approved Websites on iOS 26. Older versions of iOS call it Allowed Websites. On a supervised iPhone, a locked profile with an allow list does the same, and it cannot be switched off in Settings."
          }
        }
      ]
    }
  ]
}
```

## Sources

- [Apple, "Block apps, app downloads, websites, and purchases on iPhone" (iOS 26)](https://support.apple.com/guide/iphone/iph3ff83f3b1/26/ios/26)
- [Apple, "Block features or content with Screen Time on iPhone" (iOS 27)](https://support.apple.com/guide/iphone/block-features-or-content-with-screen-time-iph3ff83f3b1/27/ios/27)
- [Apple, "Block or allow access to apps and websites on your child's device"](https://support.apple.com/guide/child-safety/block-or-allow-access-to-apps-and-websites-jymj24zqwaek/27/web/1.0)
- [Apple, "Set up parental controls to manage your child's iPhone or iPad"](https://support.apple.com/en-us/105121)
- [Apple, "Use parental controls on your child's iPhone and iPad" (2024 version, Internet Archive)](https://web.archive.org/web/20240602093755/https://support.apple.com/en-us/105121)
- [Apple, "Use parental controls to manage your child's iPhone or iPad" (April 2026 version, for iOS 26, Internet Archive)](https://web.archive.org/web/20260801053326/https://support.apple.com/en-us/105121)
- [Apple, "Use Ask to Browse to approve the websites your child can access"](https://support.apple.com/en-us/127512)
- [Apple, "Create, change, or remove a Screen Time passcode on iPhone"](https://support.apple.com/guide/iphone/create-change-remove-a-screen-time-passcode-iph272b4c4bd/27/ios/27)
- [Apple, "Change your Screen Time passcode on an iPhone or iPad"](https://support.apple.com/en-us/102677)
- [Apple, "Get extensions to customize Safari on iPhone"](https://support.apple.com/guide/iphone/get-extensions-iphab0432bf6/ios)
- [Cloudflare, "Set up Cloudflare 1.1.1.1 resolver" (1.1.1.1 for Families)](https://developers.cloudflare.com/1.1.1.1/setup/)
- [CleanBrowsing, "Free DNS Filters"](https://cleanbrowsing.org/filters/)
- [Apple, "Install or remove configuration profiles on iPhone"](https://support.apple.com/guide/iphone/install-or-remove-configuration-profiles-iph6c493b19/ios)
- [Apple, "About Apple device supervision"](https://support.apple.com/guide/deployment/about-device-supervision-dep1d89f0bff/web)
- [Apple, "Web Content Filter device management payload settings"](https://support.apple.com/guide/deployment/web-content-filter-payload-settings-depc77c9609/web)
- [Apple Developer, "WebContentFilter"](https://developer.apple.com/documentation/devicemanagement/webcontentfilter)
- [Apple, "Add or remove configuration profiles in Apple Configurator for Mac"](https://support.apple.com/guide/apple-configurator-mac/add-or-remove-configuration-profiles-cadb67fcd4f/mac)
