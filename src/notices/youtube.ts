// English templates for notices raised by the youtube server code. Keys start
// with "youtube."; {name} placeholders are filled from Notice.params.
// {platform} is an untranslated site name (YouTube, Instagram or TikTok).
export const youtubeNotices = {
  "youtube.pageDataUnavailable":
    "YouTube page data unavailable. Please retry later.",
  "youtube.pageDataIncomplete": "Incomplete YouTube page data.",
  "youtube.httpStatus": "YouTube returned {status}. Try again later.",
  "youtube.invalidChannelInput":
    "Enter a YouTube channel URL, handle, or channel ID.",
  "youtube.notChannelUrl": "Use a channel URL, not a video or playlist URL.",
  "youtube.invalidHandle": "Enter a YouTube @handle or /channel/ URL.",
  "youtube.channelNotFound": "Could not find this public YouTube channel.",
  // Sync warnings: parts are joined as "A; B", so every part but the last
  // uses its "…More" form, which ends with a semicolon.
  "youtube.uploadFeedUnavailable": "Upload feed unavailable",
  "youtube.uploadFeedUnavailableMore": "Upload feed unavailable;",
  "youtube.videosTabUnavailable": "Videos tab unavailable",
  "youtube.videosTabUnavailableMore": "Videos tab unavailable;",
  "youtube.shortsTabUnavailable": "Shorts tab unavailable",
  "youtube.shortsTabUnavailableMore": "Shorts tab unavailable;",
  "youtube.communityTabUnavailable": "Community posts tab unavailable",
  "youtube.communityTabUnavailableMore": "Community posts tab unavailable;",
  // Public page fetches (server/public-page.ts).
  "youtube.pageRedirectLoop":
    "{platform} returned an incomplete or looping redirect. Try again later.",
  "youtube.pageRedirectedAway":
    "{platform} redirected away from the requested public content. It may require consent or sign-in.",
  "youtube.pageHttpStatus": "{platform} returned HTTP {status}.",
  "youtube.pageMayBeBlocking":
    "It may be blocking or limiting requests from this server.",
  "youtube.tryAgainLater": "Try again later.",
  "youtube.consentRequired":
    "YouTube requires an interactive consent choice on this server. The playlist could not be imported automatically.",
  "youtube.pageConnectFailed":
    "Could not connect to {platform} from the OpenFeed server after 3 attempts. Check the server's outbound network/DNS access and try again.",
  "youtube.pageConnectFailedCode":
    "Could not connect to {platform} from the OpenFeed server after 3 attempts ({code}). Check the server's outbound network/DNS access and try again.",
  "youtube.pageLoadFailed": "{platform} could not be loaded.",
} as const;
