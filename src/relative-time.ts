export function relativeTime(published: string, now = Date.now()) {
  const date = Date.parse(published);
  if (!Number.isFinite(date)) return "Date unavailable";
  const seconds = Math.max(0, Math.floor((now - date) / 1000));
  if (seconds < 60) return "just now";
  for (const [size, label] of [
    [31536000, "y"],
    [2592000, "mo"],
    [86400, "d"],
    [3600, "h"],
    [60, "m"],
  ] as const) {
    if (seconds >= size) return `${Math.floor(seconds / size)}${label} ago`;
  }
  return "just now";
}
