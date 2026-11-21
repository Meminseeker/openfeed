// English templates for notices raised by the linkedin server code. Keys start
// with "linkedin."; {name} placeholders are filled from Notice.params.
export const linkedinNotices = {
  "linkedin.invalidUrl": "Invalid URL",
  "linkedin.profileNameOrUrl":
    "Use a LinkedIn profile name or HTTPS profile URL.",
  "linkedin.personalProfilesOnly":
    "Only personal LinkedIn profiles (linkedin.com/in/…) are supported.",
  "linkedin.profileUrlNotPost":
    "Use a LinkedIn profile URL, not a post or other page.",
  "linkedin.invalidProfileName": "Enter a valid LinkedIn profile name.",
  "linkedin.invalidProfileNameHint":
    "Enter a valid LinkedIn profile name (the part after linkedin.com/in/).",
  "linkedin.noPublicProfile":
    "LinkedIn did not return a public profile. The profile may be private, hidden from logged-out visitors, or blocked for this server. Existing posts are kept.",
  "linkedin.limitedCoverage":
    "LinkedIn shows logged-out visitors only a few recent posts (usually 5); reposts and comments are not included.",
  "linkedin.postNotExposed":
    "LinkedIn did not expose this post. It may be private, deleted, or visible to members only.",
  "linkedin.postHttpError": "LinkedIn returned HTTP {status} for this post.",
  "linkedin.noPublicEmbed": "LinkedIn did not return a public post embed.",
  "linkedin.signInWall":
    "LinkedIn asked for sign-in instead of showing the public profile. It may be limiting this server; existing posts are kept.",
  "linkedin.profileNotFound": "LinkedIn profile not found.",
  "linkedin.refused":
    "LinkedIn refused the request (HTTP {status}). The profile may not exist, or LinkedIn is limiting requests from this server. Existing posts are kept.",
  "linkedin.refreshFailed":
    "LinkedIn refresh failed (HTTP {status}). Existing posts are kept.",
  "linkedin.pastePostLink": "Paste a LinkedIn post link.",
} as const;
