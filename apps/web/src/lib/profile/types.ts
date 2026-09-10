/** One app to hide from the home screen. Supervised devices only. */
export type BlockedApp = {
  bundleId: string;
  name: string;
  /** Apple's developer website, kept so the app's sites can be derived. */
  sellerUrl?: string | undefined;
};

export type ProfileConfig = {
  /** `allowAppInstallation`: whether the App Store stays available. */
  allowAppStore: boolean;
  /** Inverse of `SafariHistoryRetentionEnabled` (iOS 26 key). */
  allowPrivateBrowsing: boolean;
  /** `AutoFilterEnabled`: Apple's adult-content heuristic. Deny mode only. */
  autoFilterAdult: boolean;
  /** `blockedAppBundleIDs`. Supervised devices only. */
  blockedApps: Array<BlockedApp>;
  /** `PayloadDisplayName`. */
  displayName: string;
  /** Reverse-domain `PayloadIdentifier`. Reinstalling the same one updates in place. */
  identifier: string;
  /** `PayloadRemovalDisallowed`: keeps the profile from being deleted on device. */
  lockRemoval: boolean;
  /** `PayloadOrganization`, shown in Settings. */
  organization: string;
  /** `off` emits no filter payload at all. */
  webFilter:
    | { deniedUrls: Array<string>; mode: 'deny'; permittedUrls: Array<string> }
    | { allowedUrls: Array<string>; mode: 'allow' }
    | { mode: 'off' };
};
