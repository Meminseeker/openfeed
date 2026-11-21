import { translate, type Locale, type MessageKey } from "./i18n";
import type { Post } from "./types";
function labelKey(p: Post): MessageKey {
  const platform = p.platform || "youtube";
  if (platform === "x") return p.repost ? "label.xRepost" : "label.xPost";
  if (platform === "instagram")
    return p.kind === "short"
      ? "label.instagramReel"
      : p.kind === "video"
        ? "label.instagramVideo"
        : "label.instagramPost";
  if (platform === "tiktok") return "label.tiktokVideo";
  if (platform === "patreon") return "label.patreonPost";
  if (platform === "linkedin") return "label.linkedinPost";
  return p.kind === "short"
    ? "label.youtubeShorts"
    : p.kind === "community"
      ? "label.youtubeCommunity"
      : "label.youtubeVideo";
}
export function postLabel(p: Post, locale: Locale = "en") {
  return translate(locale, labelKey(p));
}
