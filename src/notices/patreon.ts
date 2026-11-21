// English templates for notices raised by the patreon server code. Keys start
// with "patreon."; {name} placeholders are filled from Notice.params.
export const patreonNotices = {
  "patreon.invalidUrl": "Use a Patreon username or HTTPS profile URL.",
  "patreon.postUrl": "Use a Patreon creator URL, not a post URL.",
  "patreon.invalidUsername": "Enter a valid Patreon creator username.",
  "patreon.blocked":
    "Patreon blocked or unavailable (HTTP {status}). Existing posts are kept.",
  "patreon.notFound": "Patreon creator not found.",
  "patreon.phoneNoData":
    "The phone sent no Patreon data. Patreon may have blocked the request or the session expired.",
  "patreon.phoneError": "Patreon returned an error on the phone: {detail}.",
  "patreon.phoneUnexpected": "The phone sent an unexpected Patreon response.",
  "patreon.campaignMismatch":
    "Campaign {campaignId} belongs to Patreon creator {vanity}, not {username}. Check the campaign ID in Phone sync setup.",
  "patreon.phoneAllLocked":
    "Every Patreon post is locked. Update the session_id in the phone shortcut.",
  "patreon.campaignUnresolved": "Patreon campaign could not be resolved.",
  "patreon.publicOnly":
    "Showing public Patreon previews only; member posts are locked.",
  "patreon.sessionExpired":
    "Patreon session expired or this membership does not unlock these posts. Update PATREON_SESSION_ID.",
  "patreon.pageCap": "Only the newest {count} Patreon posts were checked.",
  "patreon.postMissing": "Patreon did not return this post.",
} as const;
