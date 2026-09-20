import Foundation

/// The iPhones, profiles and backups the demo says are there.
///
/// It turns one `DemoConditions` into the values the wizard reads: the phones
/// on the cable, what MCInstall would say about them, the profiles they list
/// and the folders this Mac is holding. Every one of them is made here out of
/// nothing, so the window can be driven into any state without a cable.
///
/// Nothing is read and nothing is written. The backup folder is a path, built
/// the way a run would build it, and no demo ever opens it.
enum DemoWorld {
    /// The iPhone the demo runs are about.
    static let udid = "00008130-000A4D3E0C30001C"
    /// The second phone, for the state where the Connect step has to ask which
    /// one the run is about.
    static let secondUdid = "00008120-001A25E40C88802E"

    /// Where a run would have put the backup. It is only ever shown, never
    /// opened: the demo reads no disk.
    static var backupFolder: URL {
        BackupFolder.applicationSupportRoot.appendingPathComponent(udid)
    }

    /// Where the patch would have put the untouched copy of that backup. It is
    /// shown by the Patch step and nothing more.
    static var pristineFolder: URL {
        SupervisionPatch.pristineRoot(forBackupRoot: BackupFolder.applicationSupportRoot)
            .appendingPathComponent("\(udid)-20260918-074412")
    }

    // MARK: - The phones

    static func devices(_ conditions: DemoConditions) -> [ConnectedDevice] {
        switch conditions.phones {
        case .none:
            return []
        case .one:
            return [phone(conditions)]
        case .two:
            return [phone(conditions), secondPhone]
        }
    }

    /// What MCInstall would answer for each phone on the cable.
    static func cloudConfigurations(_ conditions: DemoConditions) -> [String: CloudConfiguration] {
        var answers = [
            udid: CloudConfiguration(
                isSupervised: conditions.supervised,
                organizationName: conditions.supervised ? "attentionawareness" : nil,
                raw: "<dict/>"
            ),
        ]
        if conditions.phones == .two {
            answers[secondUdid] = CloudConfiguration(isSupervised: false, organizationName: nil, raw: "<dict/>")
        }
        return answers
    }

    /// The configuration profiles each phone lists. Only ours is ever there,
    /// because that is the one the Profile step asks about.
    static func installedProfiles(_ conditions: DemoConditions) -> [String: [InstalledProfile]] {
        guard conditions.profileInstalled else { return [udid: []] }
        return [udid: [ourProfile]]
    }

    private static func phone(_ conditions: DemoConditions) -> ConnectedDevice {
        ConnectedDevice(
            udid: udid,
            name: "iPhone",
            productType: "iPhone17,3",
            marketingName: "iPhone 16 Pro",
            iosVersion: "26.6.2",
            findMyOn: conditions.findMyOn,
            backupEncrypted: conditions.backupsEncrypted,
            dataCapacity: 128_000_000_000,
            dataAvailable: 59_000_000_000,
            pairingState: .paired
        )
    }

    /// The second iPhone. It is trusted and says nothing interesting, so the
    /// row next to it is the choice itself rather than a second problem.
    private static let secondPhone = ConnectedDevice(
        udid: secondUdid,
        name: "Work iPhone",
        productType: "iPhone15,2",
        marketingName: "iPhone 14 Pro",
        iosVersion: "26.5.1",
        findMyOn: false,
        backupEncrypted: false,
        dataCapacity: 256_000_000_000,
        dataAvailable: 141_000_000_000,
        pairingState: .paired
    )

    private static let ourProfile = InstalledProfile(
        id: "com.attentionawareness.4f1c9d6a-8f2e-4f0b-9f5c-2a6d0b3e7c11",
        displayName: "attentionawareness",
        organization: "attentionawareness",
        description: "attentionawareness",
        isActive: true,
        removalDisallowed: true,
        uuid: "4f1c9d6a-8f2e-4f0b-9f5c-2a6d0b3e7c11"
    )

    // MARK: - The App Store

    /// The store the demo answers app searches from.
    ///
    /// It is a written down page of results rather than Apple's, so the
    /// Profile step can be built and walked through on a Mac with no network.
    /// The rows cover what the step has to draw: apps the curated table names
    /// the sites of, apps it does not, which leaves their sites to the
    /// developer link, and one of Apple's own, which is never offered. They
    /// carry no artwork, because the demo downloads nothing, so every row is
    /// drawn by its initial.
    static let storeApps: [AppResult] = [
        app("com.zhiliaoapp.musically", "TikTok - Videos, Music & LIVE", "TikTok Ltd."),
        app("com.google.ios.youtube", "YouTube", "Google LLC", "https://www.youtube.com"),
        app("com.burbn.instagram", "Instagram", "Instagram, Inc."),
        app("com.atebits.Tweetie2", "X", "X Corp."),
        app("com.reddit.Reddit", "Reddit — Dive into anything", "Reddit, Inc."),
        app("com.toyopagroup.picaboo", "Snapchat", "Snap, Inc."),
        app("com.hammerandchisel.discord", "Discord - Talk, Play, Hang Out", "Discord, Inc."),
        app("com.netflix.Netflix", "Netflix", "Netflix, Inc."),
        app("tv.twitch", "Twitch: Live Game Streaming", "Twitch Interactive, Inc."),
        app("com.spotify.client", "Spotify: Music and Podcasts", "Spotify", "https://www.spotify.com"),
        app("com.duolingo.DuolingoMobile", "Duolingo - Language Lessons", "Duolingo", "https://www.duolingo.com"),
        app("com.strava.stravaride", "Strava: Run, Bike, Hike", "Strava, Inc.", "https://www.strava.com"),
        app("com.apple.store.Jolly", "Apple Store", "Apple"),
    ]

    /// The rows one term matches, the way a store answers: by name, or by the
    /// developer who made it.
    static func appResults(for term: String) -> [AppResult] {
        let query = KnownApps.fold(term)
        guard !query.isEmpty else { return [] }
        return storeApps
            .filter {
                KnownApps.fold($0.name).contains(query)
                    || KnownApps.fold($0.developer).contains(query)
            }
            .prefix(AppSearch.defaultLimit)
            .map { $0 }
    }

    /// What the store knows about apps that are already on a list. Ids it does
    /// not carry are simply absent, the way Apple's lookup leaves them out.
    static func appDetails(for bundleIds: [String]) -> [AppResult] {
        let asked = Set(bundleIds)
        return storeApps.filter { asked.contains($0.bundleId) }
    }

    private static func app(
        _ bundleId: String,
        _ name: String,
        _ developer: String,
        _ sellerUrl: String? = nil
    ) -> AppResult {
        AppResult(
            bundleId: bundleId,
            developer: developer,
            iconUrl: "",
            // Apple's track id. Nothing in the window draws it, and a made up
            // one would name a real app, so the demo carries none.
            id: 0,
            name: name,
            sellerUrl: sellerUrl
        )
    }

    // MARK: - The backups

    /// The folders this Mac is holding. The first row is the one the run is
    /// about, when the demo says there is one; the second is an older phone,
    /// so the last step always has a list to draw.
    static func backups(_ conditions: DemoConditions) -> [StoredBackup] {
        var rows: [StoredBackup] = []
        switch conditions.holding {
        case .nothing:
            break
        case .whole:
            rows.append(
                StoredBackup(
                    url: backupFolder,
                    udid: udid,
                    deviceName: "iPhone",
                    productType: "iPhone17,3",
                    iosVersion: "26.6.2",
                    date: Date(timeIntervalSinceNow: -2 * 24 * 3600),
                    isEncrypted: conditions.backupsEncrypted,
                    snapshotState: BackupStatus.finishedSnapshot,
                    sizeInBytes: 67_882_442_752,
                    pristineURL: pristineFolder,
                    pristineSizeInBytes: 67_612_016_960
                )
            )
        case .unfinished:
            rows.append(
                StoredBackup(
                    url: backupFolder,
                    udid: udid,
                    deviceName: "iPhone",
                    productType: "iPhone17,3",
                    iosVersion: "26.6.2",
                    date: Date(timeIntervalSinceNow: -3 * 3600),
                    isEncrypted: conditions.backupsEncrypted,
                    snapshotState: "uploading",
                    sizeInBytes: 14_203_889_152,
                    pristineURL: nil,
                    pristineSizeInBytes: nil
                )
            )
        }
        rows.append(olderBackup)
        return rows
    }

    private static let olderBackup = StoredBackup(
        url: BackupFolder.applicationSupportRoot.appendingPathComponent(secondUdid),
        udid: secondUdid,
        deviceName: "Work iPhone",
        productType: "iPhone15,2",
        iosVersion: "26.5.1",
        date: Date(timeIntervalSince1970: 1_788_372_600),
        isEncrypted: false,
        snapshotState: BackupStatus.finishedSnapshot,
        sizeInBytes: 41_203_889_152,
        pristineURL: nil,
        pristineSizeInBytes: nil
    )
}
