// English templates for notices raised by the library server code. Keys start
// with "library."; {name} placeholders are filled from Notice.params.
export const libraryNotices = {
  "library.invalidUrl": "Invalid URL",
  "library.httpsLinkRequired":
    "Paste an HTTPS link from YouTube, X, Instagram, TikTok or LinkedIn.",
  "library.unsupportedLink":
    "Use a public YouTube video, X post, Instagram post/Reel, TikTok video, or LinkedIn post link.",
  "library.youtubeVideoLinkRequired":
    "Paste a YouTube video link. Use Playlists for playlist links.",
  "library.invalidTikTokRedirect": "Invalid TikTok redirect.",
  "library.youtubeCommunityUnavailable":
    "YouTube did not expose this community post.",
  "library.instagramNotExposed":
    "Instagram did not expose this public post. Private or login-only content cannot be imported.",
  "library.instagramUnavailable": "Instagram content unavailable.",
  "library.tiktokNotExposed":
    "TikTok did not expose this video. It may be unavailable or require login.",
  "library.playlistLinkRequired": "Paste a public YouTube playlist link.",
  "library.playlistPagesFailed":
    "Some playlist pages could not load. Refresh this playlist to retry.",
  "library.playlistPageLimit":
    "Only the first 21 pages were imported. This playlist exceeds the import limit.",
  "library.playlistEmpty":
    "No playable videos found. Use a public or unlisted YouTube playlist.",
  "library.playlistDatesMissing":
    "Exact publication dates unavailable for {count} videos; their chronological order may be approximate. Refresh to retry.",
} as const;
