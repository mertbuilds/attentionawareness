---
title: 'Supervise an iPhone on iOS 27 without erasing it'
description: 'iOS 27 ignores supervision that arrives in a restored backup. The steps that supervise an iPhone on iOS 27 and keep its data, and how the fix works.'
og_title: 'Supervise an iPhone on iOS 27 **without erasing it**'
slug: supervise-iphone-ios-27-without-erasing
date: 2026-10-05
primary_keyword: 'supervise iphone ios 27 without erasing'
reading_minutes: 8
read_next: block-any-app-iphone, why-screen-time-does-not-work
---

You can supervise an iPhone on iOS 27 without erasing it. The way that worked on iOS 26 and earlier does not work on iOS 27, because iOS 27 ignores supervision that arrives in a restored backup. The fix has two parts: a small restore that puts the iPhone into its setup screens with the data in place, then one request over USB that turns supervision on. Our [free Mac app](/) does both.

We tested it on 2026-10-05 on one iPhone SE (2nd generation) with iOS 27.2. Photos, apps, Safari tabs and the Apple Account were kept.

This post has two parts. The first part is for you if you want to do it: the steps on the Mac and the iPhone. The second part is for developers: what changed in iOS 27 and how the fix works.

## What you need

- A Mac with Apple silicon and macOS 14 or later.
- A cable.
- An iPhone on iOS 27. iOS 28 and later are not supported.
- The iPhone's passcode and your Apple Account password.
- A few minutes.

## The steps on the Mac and the iPhone

1. **Back up your iPhone.** Use Finder or iCloud. In our test nothing was lost, but things can go wrong, and the backup is the way back.
2. **Turn off Find My.** On the iPhone, go to Settings > your name > Find My. Tap Find My iPhone and turn it off. The restore needs it off.
3. **Open the Mac app and plug in the iPhone.** If the iPhone asks to trust the Mac, tap Trust and enter the passcode.
4. **Let the app supervise the iPhone.** The app sends a small set of settings to the iPhone. The iPhone restarts by itself.
5. **Unlock the iPhone.** The first screen says "Press home to upgrade". Press the Home button, or swipe up on an iPhone without a Home button. Then enter the passcode.
6. **Trust the Mac again.** In some runs the iPhone asks to trust the Mac one more time. Tap Trust and enter the passcode.
7. **Wait on the "Restore Completed" screen.** The iPhone shows a setup screen that says "Restore Completed", with a Continue button. Do not tap Continue yet. The app turns supervision on while this screen is open. When the app has done that, tap Continue. In some runs this screen never shows. That is fine.
8. **Choose what to block.** Pick the apps and websites in the Mac app. The app installs the profile. Start in trial mode. In trial mode you can remove the profile in Settings.
9. **Turn Find My on again.** Go to Settings > your name > Find My and turn Find My iPhone on.

## What to expect after

- The iPhone asks for your Apple Account password one time. The account stays signed in.
- A blocked app is not on the Home Screen and cannot be opened. On iOS 27.2 the iPhone shows no popup for it.
- Website blocking and the adult content filter work as before.
- Your photos, apps and Safari tabs are where they were.

## What we tested and what we did not

We tested on 2026-10-05, on one iPhone SE (2nd generation) with iOS 27.2. We ran it many times in both directions: supervising the iPhone and taking supervision off. In every run with the final steps, photos, apps, Safari tabs and the Apple Account were kept.

We did not test:

- other iPhone models
- iOS 27.0

iOS 28 and later are not supported.

## What changed in iOS 27

This part is for developers and for people who maintain a similar tool.

### How it worked on iOS 26 and earlier

1. The app makes a small backup that holds one file, `CloudConfigurationDetails.plist`, with `IsSupervised` set to true. The file is in the domain `SysSharedContainerDomain-systemgroup.com.apple.configurationprofiles`, under `Library/ConfigurationProfiles/`.
2. The app restores that backup over USB with the `mobilebackup2` service. With `idevicebackup2` this is `restore --system`.
3. The iPhone restarts. It comes back supervised, with its data.

### Change 1: iOS 27 ignores supervision in a restore

Apple's deployment guide says that on iOS 27, "backups don't include device management information such as the enrollment profile, management configuration, and supervision status."

The guide's page about restores says the same from the other side. On iOS 26 and earlier, a restore to the same device brings the management configuration back. For iOS 27, the page describes only one way back to management: a device that is in Apple School Manager or Apple Business enrolls again by itself after the restore. An iPhone that is not in one of those comes back from a restore without supervision.

So the supervision file in the small backup has no effect on iOS 27.

### Change 2: a restore with system files drops data

We found the second change by test. On iOS 27, a restore that sends `RestoreSystemFiles` set to true with a partial backup makes the iPhone drop system data that is not in the backup. `RestoreSystemFiles` is what the `--system` flag sets.

In our test the Apple Account was signed out and the photos were gone. Apps and Safari tabs stayed.

iOS 26 needs that flag, because the supervision file is a system file. On iOS 27 the flag is the cause of the data loss.

## How the fix works

1. **Restore the same small backup, without system files.** Set `RestoreSystemFiles` to false. With `idevicebackup2` this is `restore --skip-apps --remove --reboot`, with no `--system`. The backup holds the one configuration profiles domain and nothing else. Let the restore restart the iPhone itself.
2. **The iPhone restarts into setup.** The first screen says "Press home to upgrade". Then comes the passcode, then in some runs a Trust prompt, then the setup screen "Restore Completed" with a Continue button. Nobody taps Continue yet.
3. **Pair again.** The pairing from before the restore is no longer valid. The Mac pairs again, and that is the Trust prompt.
4. **Send the supervision setting live over USB.** While the iPhone is still in setup, send the request `SetCloudConfiguration` to the service `com.apple.mobile.MCInstall`, with the cloud configuration dictionary and `IsSupervised` set to true. It goes to the same service Apple Configurator uses when it prepares a device. Apple Configurator erases the iPhone to get it into setup. The small restore gets it there with the data in place. Retry for a short time: right after the restart, the service can fail for some seconds.
5. **Read it back.** Send `GetCloudConfiguration` and check that `IsSupervised` is true.
6. **Tap Continue on the iPhone.** In some runs the screen never shows. We think the setting arrives first and tells setup to skip that screen.
7. **Install the configuration profile with the blocks**, as before.

## The test that found the cause

Each run changed one thing from the working set. The working set is the restore from step 1 above.

| The one change                                                                       | What happened                                                      |
| ------------------------------------------------------------------------------------ | ------------------------------------------------------------------ |
| Nothing changed                                                                      | All data kept                                                      |
| Remove off (`RemoveItemsNotRestored` set to false)                                   | All data kept                                                      |
| A second file in the backup that marks setup as done (`com.apple.purplebuddy.plist`) | All data kept                                                      |
| System files on (`RestoreSystemFiles` set to true)                                   | Apple Account signed out, photos gone. Apps and Safari tabs stayed |

Only the system files option lost data. One thing we did not test alone is who restarts the iPhone, the restore or the app. Before these runs we had two runs with system files on, one with each way of restarting, and both lost data.

## What this cannot do

- It does not work on iOS 28 or later.
- It is not tested on other iPhone models, or on iOS 27.0.
- It does not work with Find My on. Turn Find My off before the run and on again after.
- It needs a Mac. The app runs on a Mac with Apple silicon and macOS 14 or later.

## Questions about iOS 27

### Can I supervise an iPhone on iOS 27 without erasing it?

Yes. The free Mac app from attention awareness supervises an iPhone on iOS 27 and keeps its data. We tested it on one iPhone SE (2nd generation) with iOS 27.2. Back up first.

### Why did supervising without erasing stop working on iOS 27?

On iOS 26 and earlier, supervision could arrive in a small restored backup. iOS 27 ignores supervision that arrives in a restore. Apple's deployment guide says backups on iOS 27 do not include the supervision status.

### Does it work on every iPhone with iOS 27?

We do not know yet. We tested one iPhone SE (2nd generation) with iOS 27.2. Other iPhone models and iOS 27.0 are not tested. Back up first.

### Why do I need to turn off Find My?

The restore needs Find My off. Turn it off before the run and turn it on again after. The iPhone asks for your Apple Account password one time after the run, and the account stays.

### Does it work on iOS 28?

No. iOS 28 and later are not supported.

## Next steps

Back up your iPhone, turn off Find My, and run the [free Mac app](/). If you want to erase the iPhone and start clean, do it [manually via Apple Configurator](/guide). To pick what to block, see [how to block an app on an iPhone](/blog/block-any-app-iphone).

## Schema

```json
{
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "BlogPosting",
      "@id": "https://attentionawareness.com/blog/supervise-iphone-ios-27-without-erasing#article",
      "headline": "Supervise an iPhone on iOS 27 without erasing it",
      "description": "iOS 27 ignores supervision that arrives in a restored backup. The steps that supervise an iPhone on iOS 27 and keep its data, and how the fix works.",
      "image": "https://attentionawareness.com/og/blog/supervise-iphone-ios-27-without-erasing.png",
      "url": "https://attentionawareness.com/blog/supervise-iphone-ios-27-without-erasing",
      "mainEntityOfPage": "https://attentionawareness.com/blog/supervise-iphone-ios-27-without-erasing",
      "datePublished": "2026-10-05",
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
      },
      "about": ["iPhone", "iOS 27", "Supervised mode", "Device restore"]
    },
    {
      "@type": "HowTo",
      "@id": "https://attentionawareness.com/blog/supervise-iphone-ios-27-without-erasing#howto",
      "name": "How to supervise an iPhone on iOS 27 without erasing it",
      "description": "Supervise an iPhone on iOS 27 with the free attention awareness Mac app and keep its data.",
      "step": [
        {
          "@type": "HowToStep",
          "position": 1,
          "name": "Back up your iPhone",
          "text": "Use Finder or iCloud. In our test nothing was lost, but things can go wrong, and the backup is the way back."
        },
        {
          "@type": "HowToStep",
          "position": 2,
          "name": "Turn off Find My",
          "text": "On the iPhone, go to Settings > your name > Find My. Tap Find My iPhone and turn it off. The restore needs it off."
        },
        {
          "@type": "HowToStep",
          "position": 3,
          "name": "Open the Mac app and plug in the iPhone",
          "text": "If the iPhone asks to trust the Mac, tap Trust and enter the passcode."
        },
        {
          "@type": "HowToStep",
          "position": 4,
          "name": "Let the app supervise the iPhone",
          "text": "The app sends a small set of settings to the iPhone. The iPhone restarts by itself."
        },
        {
          "@type": "HowToStep",
          "position": 5,
          "name": "Unlock the iPhone",
          "text": "The first screen says \"Press home to upgrade\". Press the Home button, or swipe up on an iPhone without a Home button. Then enter the passcode."
        },
        {
          "@type": "HowToStep",
          "position": 6,
          "name": "Trust the Mac again",
          "text": "In some runs the iPhone asks to trust the Mac one more time. Tap Trust and enter the passcode."
        },
        {
          "@type": "HowToStep",
          "position": 7,
          "name": "Wait on the \"Restore Completed\" screen",
          "text": "The iPhone shows a setup screen that says \"Restore Completed\", with a Continue button. Do not tap Continue yet. The app turns supervision on while this screen is open. When the app has done that, tap Continue. In some runs this screen never shows. That is fine."
        },
        {
          "@type": "HowToStep",
          "position": 8,
          "name": "Choose what to block",
          "text": "Pick the apps and websites in the Mac app. The app installs the profile. Start in trial mode. In trial mode you can remove the profile in Settings."
        },
        {
          "@type": "HowToStep",
          "position": 9,
          "name": "Turn Find My on again",
          "text": "Go to Settings > your name > Find My and turn Find My iPhone on."
        }
      ]
    },
    {
      "@type": "FAQPage",
      "@id": "https://attentionawareness.com/blog/supervise-iphone-ios-27-without-erasing#faq",
      "mainEntity": [
        {
          "@type": "Question",
          "name": "Can I supervise an iPhone on iOS 27 without erasing it?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "Yes. The free Mac app from attention awareness supervises an iPhone on iOS 27 and keeps its data. We tested it on one iPhone SE (2nd generation) with iOS 27.2. Back up first."
          }
        },
        {
          "@type": "Question",
          "name": "Why did supervising without erasing stop working on iOS 27?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "On iOS 26 and earlier, supervision could arrive in a small restored backup. iOS 27 ignores supervision that arrives in a restore. Apple's deployment guide says backups on iOS 27 do not include the supervision status."
          }
        },
        {
          "@type": "Question",
          "name": "Does it work on every iPhone with iOS 27?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "We do not know yet. We tested one iPhone SE (2nd generation) with iOS 27.2. Other iPhone models and iOS 27.0 are not tested. Back up first."
          }
        },
        {
          "@type": "Question",
          "name": "Why do I need to turn off Find My?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "The restore needs Find My off. Turn it off before the run and turn it on again after. The iPhone asks for your Apple Account password one time after the run, and the account stays."
          }
        },
        {
          "@type": "Question",
          "name": "Does it work on iOS 28?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "No. iOS 28 and later are not supported."
          }
        }
      ]
    }
  ]
}
```

## Sources

- [Apple, "Back up managed Apple devices"](https://support.apple.com/guide/deployment/back-up-managed-apple-devices-depd44f04xc3/web)
- [Apple, "Restore managed Apple devices"](https://support.apple.com/guide/deployment/restore-managed-apple-devices-depd44f04xc4/web)
- [Apple, "About Apple device supervision"](https://support.apple.com/guide/deployment/about-device-supervision-dep1d89f0bff/web)
- [Apple, "Turn off Find My on iPhone"](https://support.apple.com/guide/iphone/turn-off-find-my-iph4a8b98f75/ios)
- [libimobiledevice, idevicebackup2 manual page](https://manpages.debian.org/unstable/libimobiledevice-utils/idevicebackup2.1.en.html)
- [libimobiledevice, idevicebackup2 source](https://github.com/libimobiledevice/libimobiledevice/blob/master/tools/idevicebackup2.c)
