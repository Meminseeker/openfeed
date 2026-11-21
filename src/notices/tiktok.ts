// English templates for notices raised by the tiktok server code. Keys start
// with "tiktok."; {name} placeholders are filled from Notice.params.
// {end} is the punctuation that follows a failure inside "TikTok refresh
// failed: …" (";" between failures, "." after the last, "" when standalone).
export const tiktokNotices = {
  "tiktok.invalidUrl": "Use a TikTok username or HTTPS profile URL.",
  "tiktok.videoUrl": "Use a TikTok profile URL, not a video URL.",
  "tiktok.invalidUsername":
    "Enter a valid TikTok username (up to 24 characters).",
  "tiktok.profileNoVideos":
    "TikTok did not expose public videos. The profile may be empty, private, or blocked by TikTok. Try refreshing later; existing posts are kept.{end}",
  "tiktok.profileCoverage":
    "TikTok imports the recent videos exposed by its public profile; a complete timeline is not guaranteed.",
  "tiktok.embedNoList":
    "TikTok creator embed did not return a public video list.{end}",
  "tiktok.embedNoUsable":
    "TikTok creator embed contained no usable public videos for this account.{end}",
  "tiktok.embedCoverage":
    "TikTok creator embeds expose up to 10 recent videos; dates are estimated from video IDs.",
  "tiktok.privateAccount": "Private TikTok accounts are not supported.",
  "tiktok.httpStatus": "HTTP {status}{end}",
  "tiktok.blocked": "TikTok blocked the request{end}",
  "tiktok.requestFailure": "{message}{end}",
  "tiktok.refreshFailed": "TikTok refresh failed:",
  "tiktok.postsKept": "Existing posts are kept.",
} as const;
