// English templates for notices raised by the x server code. Keys start
// with "x."; {name} placeholders are filled from Notice.params.
export const xNotices = {
  "x.invalidProfileUrl": "Use an X username or an https://x.com profile URL.",
  "x.invalidUsername":
    "Enter a valid X username (up to 15 letters, numbers or underscores).",
  "x.timelineUnavailable":
    "X's public timeline is unavailable. Try again later or open the profile on X.",
  "x.timelineFormatChanged": "X changed its public timeline format.",
  "x.timelineHidden":
    "X did not expose this profile's public posts. Private accounts are not supported.",
  "x.privateAccount": "Private X accounts are not supported.",
  "x.accountNotFound": "X account was not found.",
  "x.refreshFailed": "X refresh failed.",
  "x.publicTimelineHttp":
    "X public timeline unavailable (HTTP {status}). Try again later.",
  "x.snapshotLimited":
    "X supplies a limited public snapshot, often with older posts; recent posts and a complete timeline are not guaranteed.",
  "x.apiHttp":
    "X API request failed (HTTP {status}). Check the bearer token, API access and usage limits.",
  "x.apiIncomplete":
    "X API returned incomplete data. Check account availability and API access.",
  "x.apiNoTimeline": "X API did not return a usable timeline.",
  "x.apiLimited":
    "X refresh is limited to 30 new posts/reposts. Older excess items were skipped to keep costs and volume down.",
  "x.socialDataBalance":
    "SocialData balance is empty. Top up at socialdata.tools to refresh X.",
  "x.socialDataKey": "SocialData rejected the API key (SOCIALDATA_API_KEY).",
  "x.socialDataHttp":
    "SocialData request failed (HTTP {status}). Try again later.",
  "x.socialDataSkipped":
    "More new X posts arrived than one refresh reads; the oldest were skipped.",
  "x.socialDataFallbackWait":
    "SocialData search is failing. The account timeline is used instead at most every 6 hours; next after {time} UTC.",
  "x.socialDataFallbackUsed":
    "SocialData search is failing, so this account's timeline was read instead (at most every 6 hours).",
  "x.socialDataNoUserId": "SocialData did not return this X account's id.",
  "x.invalidPostUrl": "Invalid X post URL.",
  "x.postUnavailable": "X post unavailable. Please try again later.",
  "x.postNotReturned": "X did not return this public post.",
} as const;
