import type { Post } from "./types";
export function postLabel(p: Post) {
  const platform = p.platform || "youtube";
  if (platform === "x") return p.repost ? "X Repost" : "X Post";
  if (platform === "instagram")
    return p.kind === "short"
      ? "Instagram Reel"
      : p.kind === "video"
        ? "Instagram Video"
        : "Instagram Post";
  if (platform === "tiktok") return "TikTok Video";
  if (platform === "patreon") return "Patreon Post";
  return p.kind === "short"
    ? "YouTube Shorts"
    : p.kind === "community"
      ? "YouTube Community"
      : "YouTube Video";
}
