import { translate, type Locale } from "./i18n";
export function relativeTime(
  published: string,
  now = Date.now(),
  locale: Locale = "en",
) {
  const date = Date.parse(published);
  if (!Number.isFinite(date)) return translate(locale, "time.unavailable");
  const seconds = Math.max(0, Math.floor((now - date) / 1000));
  if (seconds < 60) return translate(locale, "time.justNow");
  for (const [size, key] of [
    [31536000, "time.y"],
    [2592000, "time.mo"],
    [86400, "time.d"],
    [3600, "time.h"],
    [60, "time.m"],
  ] as const) {
    if (seconds >= size)
      return translate(locale, key, { count: Math.floor(seconds / size) });
  }
  return translate(locale, "time.justNow");
}
