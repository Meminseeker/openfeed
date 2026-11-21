// English templates for notices raised by the instagram server code. Keys start
// with "instagram."; {name} placeholders are filled from Notice.params.
export const instagramNotices = {
  "instagram.invalidProfileUrl":
    "Use an Instagram username or HTTPS profile URL.",
  "instagram.invalidUsername":
    "Enter a valid Instagram profile username (up to 30 characters).",
  "instagram.noPublicPosts":
    "Instagram did not expose public posts. The profile may be private, have embeds disabled, or require sign-in. No authenticated access is attempted.",
  "instagram.privateAccount": "Private Instagram accounts are not supported.",
  "instagram.embedNoPosts":
    "Instagram's public profile embed did not expose any posts.",
  "instagram.embedPreviewOnly":
    "Instagram profile embeds expose only a small recent preview (usually 6 posts); a complete timeline is not guaranteed.",
  "instagram.videoDetailsUnavailable":
    "Some video details were unavailable; use Open source.",
  "instagram.apiCredentialsMissing":
    "Set both INSTAGRAM_ACCESS_TOKEN and INSTAGRAM_USER_ID for Meta Business Discovery.",
  "instagram.apiVersionMissing":
    "Set INSTAGRAM_GRAPH_VERSION to the Graph API version configured for your Meta app (for example v24.0).",
  "instagram.apiUnavailable":
    "Instagram API unavailable (HTTP {status}). Check Meta permissions, token and public professional account eligibility.",
  "instagram.apiNoPosts":
    "Meta did not return this account's public posts. Only eligible public Business/Creator accounts are supported.",
  "instagram.apiLatestOnly":
    "Instagram imports the latest 30 items only; there is no archive backfill.",
  "instagram.profileUnavailable":
    "Instagram public profile unavailable (HTTP {status}).",
  "instagram.postUnavailable": "Instagram post unavailable (HTTP {status}).",
  "instagram.postMediaMissing": "Instagram did not expose this post's media.",
} as const;
