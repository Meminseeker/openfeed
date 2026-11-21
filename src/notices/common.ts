// Notices shared by every server module.
export const commonNotices = {
  "common.requestFailed": "Request failed",
  "common.timeout": "The source took too long to respond. Try again later.",
  "common.network": "Could not reach the source. Try again later.",
  // Node's own message for an unparsable URL (ERR_INVALID_URL).
  "common.invalidUrl": "Invalid URL",
} as const;
