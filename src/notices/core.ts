// English templates for notices raised by the core server code. Keys start
// with "core."; {name} placeholders are filled from Notice.params.
export const coreNotices = {
  "core.hostNotAllowed": "Host or origin is not allowed.",
  "core.endpointNotFound": "Endpoint not found",
  "core.notFound": "Not Found",
  "core.invalidSyncTypes": "Invalid content types for this source.",
  "core.alreadyFollowing": "You already follow this account.",
  "core.alreadyFollowingYoutubeElsewhere":
    "You already follow this YouTube account under another creator.",
  "core.alreadyFollowingElsewhere":
    "You already follow this account under another creator.",
  "core.refreshInProgress": "A refresh is already in progress.",
  "core.xRefreshFailed": "X refresh failed.",
  "core.syncFailed": "Sync failed",
  "core.importFailed": "Import failed",
  "core.notesTooLong": "Notes must be text of at most 50,000 characters.",
  "core.videoNotFound": "Video not found.",
  "core.invalidVideoRange": "Invalid video range.",
  "core.xVideoUnavailable":
    "X video is unavailable. Try refreshing the source.",
  "core.xVideoNotVideo": "X did not return a video.",
  "core.xVideoLoadFailed": "X video could not be loaded.",
  "core.patreonCampaignHelp":
    "Patreon blocked the server's creator lookup. Enter the campaign ID in Phone sync setup.",
  "core.invalidPhoneSyncToken": "Invalid phone sync token.",
  "core.noPatreonCampaignMatch":
    "No followed Patreon creator matches this campaign.",
  "core.enterCampaignId": "Enter the numeric Patreon campaign ID.",
  "core.savePatreonFirst": "Save this Patreon account first.",
  "core.campaignIdInUse":
    "Another Patreon account already uses this campaign ID.",
  "core.invalidPushSubscription": "Invalid push notification subscription.",
} as const;
